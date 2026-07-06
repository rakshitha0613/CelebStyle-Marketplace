/**
 * ranking.service — multi-signal recommendation ranking engine.
 *
 * Pipeline:
 *   1. Fetch raw candidates from hybrid CF (or cold-start pool if new user)
 *   2. Batch-load product info, feature store, inventory, and embeddings
 *   3. Score each candidate across 12 signals
 *   4. Apply business rules (boosts + penalties)
 *   5. Sort by adjusted score
 *   6. Apply diversity dampening (celebrity / brand / category)
 *   7. Generate deterministic explanations
 *   8. Cache and return
 *
 * Ranking signals and default weights (sum = 1.0):
 *   cf (0.30), embedding (0.15), trending (0.10), popularity (0.08),
 *   freshness (0.05), wishlist (0.08), cart (0.07), purchase (0.05),
 *   celebrity (0.05), brand (0.04), category (0.02), price (0.01)
 *
 * LLM is not required — ranking works fully offline / deterministically.
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { embeddingService } from "../lib/embedding.service.js";
import { getUserFeatures } from "./feature.service.js";
import { getHybridRecommendations } from "./collaborative-filtering.service.js";
import { getColdStartForUser } from "./recommendation-graph.service.js";
import { getUserEmbeddingVector, getBatchProductEmbeddings } from "../lib/vector.db.js";
import { applyBusinessRules, type ProductRankingContext } from "./business-rules.service.js";
import { applyDiversity, type DiversityWeights } from "./diversity.service.js";
import { generateExplanation } from "./explanation.service.js";

// ── Types (exported for use by explanation + tests) ───────────────────────────

export interface RankingWeights {
  cf:         number;
  embedding:  number;
  trending:   number;
  popularity: number;
  freshness:  number;
  wishlist:   number;
  cart:       number;
  purchase:   number;
  celebrity:  number;
  brand:      number;
  category:   number;
  price:      number;
  color:      number;  // Jaccard(colorPalette, user.colorPreference) — Sprint 8.4
  occasion:   number;  // normAffinity(occasionPreference, product.occasion) — Sprint 8.4
}

export interface ScoreBreakdown {
  cfScore:           number;
  embeddingSim:      number;
  trendingScore:     number;
  popularityScore:   number;
  freshnessScore:    number;
  wishlistAffinity:  number;
  cartAffinity:      number;
  purchaseAffinity:  number;
  celebrityAffinity: number;
  brandAffinity:     number;
  categoryAffinity:  number;
  priceAffinity:     number;
  colorSim:          number;  // Sprint 8.4
  occasionSim:       number;  // Sprint 8.4
  businessBoost:     number;
  diversityPenalty:  number;
}

export interface RankedProduct {
  productId:      string;
  finalScore:     number;
  scoreBreakdown: ScoreBreakdown;
  rankingReason:  string;
  confidence:     number;
}

export interface RankingOptions {
  limit?:     number;
  weights?:   Partial<RankingWeights>;
  diversity?: Partial<DiversityWeights>;
}

// ── Default weights (sum = 1.0) ───────────────────────────────────────────────

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  cf:         0.27,   // -0.03 to fund color + occasion
  embedding:  0.13,   // -0.02
  trending:   0.10,
  popularity: 0.08,
  freshness:  0.04,   // -0.01
  wishlist:   0.07,   // -0.01
  cart:       0.07,
  purchase:   0.05,
  celebrity:  0.05,
  brand:      0.04,
  category:   0.02,
  price:      0.01,
  color:      0.04,   // Sprint 8.4 — NEW
  occasion:   0.03,   // Sprint 8.4 — NEW
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const RANKING_KEY  = (uid: string) => `rank:user:${uid}`;
const TTL_RANKING  = 10 * 60_000; // 10 min

// ── Helpers ───────────────────────────────────────────────────────────────────

function normAffinity(map: Record<string, number> | undefined | null, key: string): number {
  if (!map) return 0;
  const values = Object.values(map);
  if (values.length === 0) return 0;
  const max = Math.max(...values, 1e-9);
  return (map[key] ?? 0) / max;
}

// Color similarity helpers (Sprint 8.4)
function parseColorTokens(palette: string): Set<string> {
  return new Set(
    palette.toLowerCase().split(/[,\s/]+/).map((c) => c.trim()).filter((c) => c.length >= 2)
  );
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const item of a) if (b.has(item)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function computeConfidence(breakdown: Omit<ScoreBreakdown, "businessBoost" | "diversityPenalty">): number {
  const signals = [
    breakdown.cfScore,
    breakdown.embeddingSim,
    breakdown.trendingScore,
    breakdown.popularityScore,
    breakdown.freshnessScore,
    breakdown.wishlistAffinity,
    breakdown.cartAffinity,
    breakdown.purchaseAffinity,
    breakdown.celebrityAffinity,
    breakdown.brandAffinity,
    breakdown.categoryAffinity,
    breakdown.priceAffinity,
    breakdown.colorSim,    // Sprint 8.4
    breakdown.occasionSim, // Sprint 8.4
  ];
  const nonZero = signals.filter((v) => v > 1e-9).length;
  return parseFloat((nonZero / signals.length).toFixed(4));
}

// ── Main ranking function ─────────────────────────────────────────────────────

export async function rankForUser(
  userId:  string,
  options?: RankingOptions
): Promise<RankedProduct[]> {
  const cacheKey = RANKING_KEY(userId);
  const cached   = cacheService.get<RankedProduct[]>(cacheKey);
  if (cached) return cached;

  const limit   = options?.limit ?? 20;
  const weights: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS, ...options?.weights };

  // ── Step 1: Candidates from hybrid CF (or cold-start) ─────────────────────
  const cfRecs = await getHybridRecommendations(userId, limit * 3);

  let candidates: Array<{ productId: string; cfScore: number }>;
  if (cfRecs.length === 0) {
    const cold = await getColdStartForUser(limit * 2);
    // Cold-start scores are already in [0, 1] (weight from getColdStartForUser)
    const maxCold = Math.max(...cold.map((e) => e.weight), 1e-9);
    candidates = cold.map((e) => ({ productId: e.targetId, cfScore: (e.weight / maxCold) * 0.5 }));
  } else {
    const maxCF = Math.max(...cfRecs.map((r) => r.score), 1e-9);
    candidates = cfRecs.map((r) => ({ productId: r.id, cfScore: r.score / maxCF }));
  }

  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.productId);

  // Negative signals from user feedback (DISMISS/HIDE) — stored in cache by feedback.service
  const negativeIds  = cacheService.get<string[]>(`feedback:neg:${userId}`) ?? [];
  const negativeSignals = new Set(negativeIds);

  // ── Step 2: Load user context (parallel) ─────────────────────────────────
  const [userFeatures, userEmbedVec, purchasedRows] = await Promise.all([
    getUserFeatures(userId),
    getUserEmbeddingVector(userId),
    prisma.orderItem.findMany({
      where:  { order: { userId } },
      select: { productId: true },
    }),
  ]);

  const purchasedIds = new Set(purchasedRows.map((r) => r.productId));

  // ── Step 3: Load product context (parallel batch) ─────────────────────────
  const [productRows, featureRows, inventoryRows, trendingRows, prodEmbeddings] = await Promise.all([
    prisma.product.findMany({
      where:  { id: { in: candidateIds } },
      select: {
        id:           true,
        category:     true,
        basePrice:    true,
        brandId:      true,
        celebrityId:  true,
        colorPalette: true,
        occasion:     true,
        isPublished:  true,
        deletedAt:    true,
      },
    }),
    prisma.productFeatureStore.findMany({
      where:  { productId: { in: candidateIds } },
      select: {
        productId:       true,
        trendingScore:   true,
        freshnessScore:  true,
        popularityScore: true,
        conversionRate:  true,
        returnRate:      true,
      },
    }),
    prisma.inventory.groupBy({
      by:    ["productId"],
      where: { productId: { in: candidateIds } },
      _sum:  { quantity: true, reservedQuantity: true },
    }),
    prisma.trendingProduct.findMany({
      where:  { productId: { in: candidateIds } },
      select: { productId: true, rank: true },
    }),
    userEmbedVec
      ? getBatchProductEmbeddings(candidateIds)
      : Promise.resolve(new Map<string, number[]>()),
  ]);

  // Index for O(1) lookup
  const productMap    = new Map(productRows.map((p) => [p.id, p]));
  const featureMap    = new Map(featureRows.map((f) => [f.productId, f]));
  const inventoryMap  = new Map(
    inventoryRows.map((r) => [
      r.productId,
      Math.max(0, (r._sum.quantity ?? 0) - (r._sum.reservedQuantity ?? 0)),
    ])
  );
  const trendingRankMap = new Map(trendingRows.map((t) => [t.productId, t.rank]));

  // User's recently active categories (top-3 by affinity) for business-rule boost
  const recentCategories = new Set(
    userFeatures
      ? Object.entries(userFeatures.categoryAffinity)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([k]) => k)
      : []
  );

  // Sprint 8.4: user's top-8 color preference tokens for Jaccard comparison
  const userColorTokens = userFeatures
    ? new Set<string>(
        Object.entries(userFeatures.colorPreference)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .flatMap(([k]) => [...parseColorTokens(k)])
      )
    : new Set<string>();

  // ── Step 4: Score each candidate ─────────────────────────────────────────

  interface ScoredCandidate {
    productId:      string;
    adjustedScore:  number;
    breakdown:      ScoreBreakdown;
    appliedRules:   ReturnType<typeof applyBusinessRules>["appliedRules"];
    product:        (typeof productRows)[0];
  }

  const scored: ScoredCandidate[] = [];

  for (const cand of candidates) {
    const product  = productMap.get(cand.productId);
    if (!product || !product.isPublished) continue;

    const features   = featureMap.get(cand.productId);
    const stock      = inventoryMap.get(cand.productId) ?? 0;
    const trendRank  = trendingRankMap.get(cand.productId);

    // Embedding similarity: user embedding ↔ product embedding
    let embeddingSim = 0;
    if (userEmbedVec) {
      const pVec = prodEmbeddings.get(cand.productId);
      if (pVec) {
        embeddingSim = Math.max(0, embeddingService.cosineSimilarity(userEmbedVec, pVec));
      }
    }

    // Trending: from TrendingProduct rank if available, else from feature store
    const trendingScore = trendRank != null
      ? (20 - Math.min(trendRank - 1, 19)) / 20        // rank 1 → 1.0, rank 20 → 0.05
      : Math.min((features?.trendingScore ?? 0) / 10, 1); // feature store (normalize)

    const popularityScore = Math.min(features?.popularityScore ?? 0, 1);
    const freshnessScore  = features?.freshnessScore ?? 0;

    // User-product affinity signals (normalized to [0, 1])
    const wishlistAffinity  = normAffinity(userFeatures?.wishlistAffinity,   product.category);
    const cartAffinity      = normAffinity(userFeatures?.cartAffinity,        product.category);
    const categoryAffinity  = normAffinity(userFeatures?.categoryAffinity,    product.category);
    const brandAffinity     = product.brandId
      ? normAffinity(userFeatures?.brandAffinity, product.brandId)
      : 0;
    const celebrityAffinity = normAffinity(userFeatures?.celebrityAffinity,   product.celebrityId);

    // Purchase affinity: rank-based check — is this category in the user's top-5?
    const purchaseAffinity = (() => {
      if (!userFeatures) return 0;
      const topCats = Object.entries(userFeatures.categoryAffinity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([k]) => k);
      const rank = topCats.indexOf(product.category);
      return rank >= 0 ? Math.max(0, (5 - rank) / 5) : 0;
    })();

    // Price affinity: closeness to user's average price
    const priceAffinity = (() => {
      const avg = userFeatures?.pricePreference.avg ?? 0;
      if (avg === 0) return 0.5;
      return Math.max(0, 1 - Math.abs(product.basePrice - avg) / Math.max(product.basePrice, avg, 1));
    })();

    // Sprint 8.4: Color similarity (Jaccard between product colors and user's preferred colors)
    const colorSim = (() => {
      if (userColorTokens.size === 0) return 0;
      const productTokens = parseColorTokens(product.colorPalette ?? "");
      return jaccardSets(productTokens, userColorTokens);
    })();

    // Sprint 8.4: Occasion preference match
    const occasionSim = normAffinity(userFeatures?.occasionPreference, product.occasion as string);

    // Business rules
    const biz = applyBusinessRules(
      {
        productId:      cand.productId,
        category:       product.category,
        brandId:        product.brandId,
        celebrityId:    product.celebrityId,
        basePrice:      product.basePrice,
        conversionRate: features?.conversionRate ?? 0,
        returnRate:     features?.returnRate ?? 0,
        availableStock: stock,
        isDeleted:      !!product.deletedAt,
      } satisfies ProductRankingContext,
      userFeatures,
      purchasedIds,
      recentCategories
    );

    if (biz.appliedRules.includes("BLOCKED_PRODUCT")) continue;

    // Raw weighted score (Sprint 8.4: now includes color and occasion signals)
    const rawScore =
      cand.cfScore        * weights.cf         +
      embeddingSim        * weights.embedding   +
      trendingScore       * weights.trending    +
      popularityScore     * weights.popularity  +
      freshnessScore      * weights.freshness   +
      wishlistAffinity    * weights.wishlist    +
      cartAffinity        * weights.cart        +
      purchaseAffinity    * weights.purchase    +
      celebrityAffinity   * weights.celebrity   +
      brandAffinity       * weights.brand       +
      categoryAffinity    * weights.category    +
      priceAffinity       * weights.price       +
      colorSim            * (weights.color   ?? 0) +
      occasionSim         * (weights.occasion ?? 0);

    // Feedback penalty: user has explicitly dismissed or hidden this product
    const feedbackPenalty = negativeSignals.has(cand.productId) ? -0.15 : 0;
    const adjustedScore   = Math.max(0, rawScore + biz.boost + biz.penalty + feedbackPenalty);

    scored.push({
      productId:     cand.productId,
      adjustedScore,
      appliedRules:  biz.appliedRules,
      product,
      breakdown: {
        cfScore:           parseFloat(cand.cfScore.toFixed(6)),
        embeddingSim:      parseFloat(embeddingSim.toFixed(6)),
        trendingScore:     parseFloat(trendingScore.toFixed(6)),
        popularityScore:   parseFloat(popularityScore.toFixed(6)),
        freshnessScore:    parseFloat(freshnessScore.toFixed(6)),
        wishlistAffinity:  parseFloat(wishlistAffinity.toFixed(6)),
        cartAffinity:      parseFloat(cartAffinity.toFixed(6)),
        purchaseAffinity:  parseFloat(purchaseAffinity.toFixed(6)),
        celebrityAffinity: parseFloat(celebrityAffinity.toFixed(6)),
        brandAffinity:     parseFloat(brandAffinity.toFixed(6)),
        categoryAffinity:  parseFloat(categoryAffinity.toFixed(6)),
        priceAffinity:     parseFloat(priceAffinity.toFixed(6)),
        colorSim:          parseFloat(colorSim.toFixed(6)),     // Sprint 8.4
        occasionSim:       parseFloat(occasionSim.toFixed(6)),  // Sprint 8.4
        businessBoost:     parseFloat((biz.boost + biz.penalty + feedbackPenalty).toFixed(6)),
        diversityPenalty:  0, // set below
      },
    });
  }

  // Sort by adjusted score descending
  scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

  // ── Step 5: Diversity reranking ───────────────────────────────────────────

  const diversityInputs = scored.map((s) => ({
    productId:   s.productId,
    score:       s.adjustedScore,
    celebrityId: s.product.celebrityId,
    brandId:     s.product.brandId,
    category:    s.product.category,
  }));

  const diversityResults = applyDiversity(diversityInputs, options?.diversity);
  const divMap = new Map(diversityResults.map((r) => [r.productId, r]));

  // ── Step 6: Build final ranked list ──────────────────────────────────────

  const results: RankedProduct[] = scored
    .map((s) => {
      const div       = divMap.get(s.productId)!;
      const finalScore = parseFloat(div.diversifiedScore.toFixed(6));

      const breakdown: ScoreBreakdown = {
        ...s.breakdown,
        diversityPenalty: parseFloat(div.penalty.toFixed(6)),
      };

      const { label } = generateExplanation(breakdown, weights, s.appliedRules);

      return {
        productId:      s.productId,
        finalScore,
        scoreBreakdown: breakdown,
        rankingReason:  label,
        confidence:     computeConfidence(breakdown),
      };
    })
    // Re-sort by final score after diversity
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);

  cacheService.set(cacheKey, results, TTL_RANKING);
  return results;
}

// ── Cache invalidation ────────────────────────────────────────────────────────

export function invalidateRankingCache(userId: string): void {
  cacheService.del(RANKING_KEY(userId));
}

export const rankingService = { rankForUser, invalidateRankingCache, DEFAULT_RANKING_WEIGHTS };
