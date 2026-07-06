/**
 * recommendation-ranking.service — production-grade multi-signal candidate scorer.
 *
 * Surface-agnostic: works for celebrity page, product-page SAME_CELEBRITY/SAME_BRAND,
 * cold-start, and any surface that needs personalized ranking without CF or embeddings.
 *
 * Signals + default weights (authenticated users, sum = 1.00):
 *   celebrity  0.20  — normalized celebrity affinity from UserFeatureStore
 *   category   0.17  — normalized category affinity
 *   brand      0.10  — normalized brand affinity
 *   color      0.10  — Jaccard(product.colorPalette, user's top-8 preferred colors)  ← NEW
 *   occasion   0.08  — normalized occasion preference                                 ← NEW
 *   popularity 0.20  — viewCount + orderCount×5 + wishlistCount×2, normalized
 *   freshness  0.10  — exp(−daysSincePublish / 60) — 60-day half-life
 *   wishlist   0.05  — wishlistAffinity for product.category
 *
 * Anonymous weights: popularity=0.70, freshness=0.30, rest=0.
 *
 * Performance contract:
 *   – One batched prisma.product.findMany() per call (no N+1).
 *   – All scoring is pure computation after the batch load.
 *   – Target: <20 ms for 200 candidates after DB round-trip completes.
 *
 * PgBouncer-safe: single-statement queries only.
 * LLM-free: fully deterministic.
 */

import { prisma } from "../lib/prisma.js";
import { EXPLANATION_TEXT } from "./explanation.service.js";
import type { UserFeatures } from "./feature.service.js";

// ── Weights ───────────────────────────────────────────────────────────────────

export interface RankingWeightsV2 {
  celebrity:  number;
  category:   number;
  brand:      number;
  color:      number;
  occasion:   number;
  popularity: number;
  freshness:  number;
  wishlist:   number;
}

export const AUTHENTICATED_WEIGHTS: RankingWeightsV2 = {
  celebrity:  0.20,
  category:   0.17,
  brand:      0.10,
  color:      0.10,
  occasion:   0.08,
  popularity: 0.20,
  freshness:  0.10,
  wishlist:   0.05,
};

export const ANONYMOUS_WEIGHTS: RankingWeightsV2 = {
  celebrity:  0,
  category:   0,
  brand:      0,
  color:      0,
  occasion:   0,
  popularity: 0.70,
  freshness:  0.30,
  wishlist:   0,
};

// ── Score breakdown (returned per candidate) ──────────────────────────────────

export interface ScoreBreakdownV2 {
  celebritySim:    number;
  categorySim:     number;
  brandSim:        number;
  colorSim:        number;
  occasionSim:     number;
  popularityScore: number;
  freshnessScore:  number;
  wishlistSim:     number;
  finalScore:      number;
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface RankedCandidate {
  productId:   string;
  score:       number;
  reason:      string;
  confidence:  number;
  explanation: string;
  breakdown:   ScoreBreakdownV2;
}

// ── User context (caller populates, no extra DB queries needed inside scorer) ─

export interface UserContext {
  userFeatures?:    UserFeatures | null;
  negativeFeedback?: Set<string>;  // product IDs user dismissed/hid
  purchasedIds?:    Set<string>;   // product IDs already ordered (optionally exclude)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseColors(palette: string): Set<string> {
  return new Set(
    palette
      .toLowerCase()
      .split(/[,\s/]+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normAffinity(map: Record<string, number> | undefined | null, key: string): number {
  if (!map) return 0;
  const values = Object.values(map);
  if (values.length === 0) return 0;
  const max = Math.max(...values, 1e-9);
  return (map[key] ?? 0) / max;
}

function computeFreshness(publishedAt: Date | null | undefined): number {
  if (!publishedAt) return 0;
  const daysSince = (Date.now() - publishedAt.getTime()) / 86_400_000;
  return Math.exp(-daysSince / 60);
}

function pickExplanation(
  uf:           UserFeatures | null | undefined,
  celebSim:     number,
  catSim:       number,
  brandSim:     number,
  colorSim:     number,
  wishlistSim:  number,
  freshness:    number,
  popularity:   number
): { reason: string; explanation: string } {
  if (uf) {
    if (celebSim  > 0.6) return { reason: "FAVOURITE_CELEBRITY", explanation: EXPLANATION_TEXT.FAVOURITE_CELEBRITY };
    if (wishlistSim > 0.5) return { reason: "SIMILAR_TO_WISHLIST", explanation: EXPLANATION_TEXT.SIMILAR_TO_WISHLIST };
    if (brandSim  > 0.5) return { reason: "FAVOURITE_BRAND",     explanation: EXPLANATION_TEXT.FAVOURITE_BRAND };
    if (colorSim  > 0.3) return { reason: "MATCHES_YOUR_STYLE",  explanation: EXPLANATION_TEXT.MATCHES_YOUR_STYLE };
    if (catSim    > 0.4) return { reason: "MATCHES_YOUR_STYLE",  explanation: EXPLANATION_TEXT.MATCHES_YOUR_STYLE };
  }
  if (freshness  > 0.8)  return { reason: "NEW_ARRIVAL",       explanation: EXPLANATION_TEXT.NEW_ARRIVAL };
  if (popularity > 0.6)  return { reason: "POPULAR_RIGHT_NOW", explanation: EXPLANATION_TEXT.POPULAR_RIGHT_NOW };
  return { reason: "TRENDING_THIS_WEEK", explanation: EXPLANATION_TEXT.TRENDING_THIS_WEEK };
}

// ── Main ranking function ─────────────────────────────────────────────────────

export interface RankCandidatesOptions {
  excludeIds?: Set<string>;
  limit?:      number;
  weights?:    Partial<RankingWeightsV2>;
}

export async function rankCandidates(
  candidateIds: string[],
  userCtx:      UserContext,
  opts:         RankCandidatesOptions = {}
): Promise<RankedCandidate[]> {
  if (candidateIds.length === 0) return [];

  const limit       = opts.limit ?? candidateIds.length;
  const baseWeights = userCtx.userFeatures ? AUTHENTICATED_WEIGHTS : ANONYMOUS_WEIGHTS;
  const weights: RankingWeightsV2 = { ...baseWeights, ...opts.weights };

  // ── Batch-load product attributes (single query, no N+1) ─────────────────
  const products = await prisma.product.findMany({
    where: {
      id:          { in: candidateIds },
      isPublished: true,
      deletedAt:   null,
    },
    select: {
      id:           true,
      category:     true,
      brandId:      true,
      celebrityId:  true,
      colorPalette: true,
      occasion:     true,
      viewCount:    true,
      orderCount:   true,
      wishlistCount: true,
      publishedAt:  true,
    },
  });

  if (products.length === 0) return [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Popularity normalization base
  const rawPopScores = products.map(
    (p) => p.viewCount + p.orderCount * 5 + p.wishlistCount * 2
  );
  const maxPop = Math.max(...rawPopScores, 1);

  // User's top-8 color tokens for Jaccard comparison
  const colorPref     = userCtx.userFeatures?.colorPreference ?? {};
  const topColorKeys  = Object.entries(colorPref)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([k]) => k);
  const userColorSet  = new Set<string>(
    topColorKeys.flatMap((k) => [...parseColors(k)])
  );

  const negSet      = userCtx.negativeFeedback ?? new Set<string>();
  const uf          = userCtx.userFeatures ?? null;
  const scored: RankedCandidate[] = [];

  // ── Score each candidate ──────────────────────────────────────────────────
  for (const id of candidateIds) {
    if (opts.excludeIds?.has(id) || negSet.has(id)) continue;

    const p = productMap.get(id);
    if (!p) continue;  // not found / unpublished / deleted

    // Per-signal values
    const celebritySim  = normAffinity(uf?.celebrityAffinity,  p.celebrityId);
    const categorySim   = normAffinity(uf?.categoryAffinity,   p.category);
    const brandSim      = p.brandId ? normAffinity(uf?.brandAffinity, p.brandId) : 0;
    const wishlistSim   = normAffinity(uf?.wishlistAffinity,   p.category);
    const occasionSim   = normAffinity(uf?.occasionPreference, p.occasion as string);

    // Color similarity: Jaccard between product color tokens and user preference tokens
    const productColors = parseColors(p.colorPalette);
    const colorSim      = userColorSet.size > 0 ? jaccard(productColors, userColorSet) : 0;

    const freshnessScore  = computeFreshness(p.publishedAt);
    const rawPop          = p.viewCount + p.orderCount * 5 + p.wishlistCount * 2;
    const popularityScore = rawPop / maxPop;

    // Weighted score
    const finalScore =
      celebritySim    * weights.celebrity  +
      categorySim     * weights.category   +
      brandSim        * weights.brand      +
      colorSim        * weights.color      +
      occasionSim     * weights.occasion   +
      popularityScore * weights.popularity +
      freshnessScore  * weights.freshness  +
      wishlistSim     * weights.wishlist;

    const safeScore = Math.max(0, finalScore);

    // Explanation from dominant signal
    const { reason, explanation } = pickExplanation(
      uf, celebritySim, categorySim, brandSim, colorSim,
      wishlistSim, freshnessScore, popularityScore
    );

    // Confidence: fraction of non-zero signal components
    const signals = [
      celebritySim, categorySim, brandSim, colorSim, occasionSim,
      popularityScore, freshnessScore, wishlistSim,
    ];
    const nonZero   = signals.filter((v) => v > 1e-9).length;
    const confidence = parseFloat((nonZero / signals.length).toFixed(4));

    scored.push({
      productId:  id,
      score:      parseFloat(safeScore.toFixed(6)),
      reason,
      confidence,
      explanation,
      breakdown: {
        celebritySim:    parseFloat(celebritySim.toFixed(6)),
        categorySim:     parseFloat(categorySim.toFixed(6)),
        brandSim:        parseFloat(brandSim.toFixed(6)),
        colorSim:        parseFloat(colorSim.toFixed(6)),
        occasionSim:     parseFloat(occasionSim.toFixed(6)),
        popularityScore: parseFloat(popularityScore.toFixed(6)),
        freshnessScore:  parseFloat(freshnessScore.toFixed(6)),
        wishlistSim:     parseFloat(wishlistSim.toFixed(6)),
        finalScore:      parseFloat(safeScore.toFixed(6)),
      },
    });
  }

  // Sort descending
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export const recommendationRankingService = {
  rankCandidates,
  AUTHENTICATED_WEIGHTS,
  ANONYMOUS_WEIGHTS,
};
