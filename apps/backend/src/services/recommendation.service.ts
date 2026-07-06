/**
 * recommendation.service — assembles recommendation sections for all surfaces.
 *
 * Surfaces:
 *   home             — 7 sections (personalized, requires userId)
 *   product page     — 5 sections (product-based, public)
 *   celebrity page   — 1 ranked list (public)
 *   trending         — 1 ranked list (global, public)
 *   new arrivals     — 1 ranked list (global, public)
 *   recently viewed  — 1 list (authenticated, per-user)
 *   continue shopping— 1 list (authenticated, per-user)
 *   cart             — 4 sections (authenticated, cart-item-based)
 *
 * Fallback chain (graceful degradation):
 *   personalization failure → trending + popular + newest
 *
 * PgBouncer-safe: no interactive transactions.
 * LLM-free: fully deterministic.
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { getUserFeatures } from "./feature.service.js";
import { rankForUser } from "./ranking.service.js";
import {
  getCelebrityToProductEdges,
  getBrandToProductEdges,
} from "./recommendation-graph.service.js";
import { EXPLANATION_TEXT, type ExplanationKey } from "./explanation.service.js";
import { rankCandidates } from "./recommendation-ranking.service.js";
import type { ScoreBreakdown } from "./ranking.service.js";
import type { GraphEdge } from "./recommendation-graph.service.js";
import type { RankedProduct } from "./ranking.service.js";

// ── Types (exported) ──────────────────────────────────────────────────────────

export interface RecommendationItem {
  productId:      string;
  score:          number;
  reason:         string;
  confidence:     number;
  explanation:    string;
  rankingSignals: Partial<ScoreBreakdown>;
}

export type HomeSectionType =
  | "RECOMMENDED_FOR_YOU"
  | "TRENDING"
  | "POPULAR"
  | "INSPIRED_BY_CELEBRITY"
  | "RECENTLY_VIEWED"
  | "CONTINUE_SHOPPING"
  | "NEW_ARRIVALS";

export type ProductSectionType =
  | "SIMILAR_PRODUCTS"
  | "FREQUENTLY_BOUGHT_TOGETHER"
  | "COMPLETE_THE_LOOK"
  | "SAME_CELEBRITY"
  | "SAME_BRAND";

export type CartSectionType =
  | "FREQUENTLY_BOUGHT_TOGETHER"
  | "CROSS_SELL"
  | "ACCESSORIES"
  | "UPSELL";

export interface RecommendationSection<T extends string> {
  type:  T;
  title: string;
  items: RecommendationItem[];
}

// ── Section titles ────────────────────────────────────────────────────────────

const HOME_TITLES: Record<HomeSectionType, string> = {
  RECOMMENDED_FOR_YOU:    "Recommended For You",
  TRENDING:               "Trending",
  POPULAR:                "Popular",
  INSPIRED_BY_CELEBRITY:  "Inspired By Your Favourite Celebrities",
  RECENTLY_VIEWED:        "Recently Viewed",
  CONTINUE_SHOPPING:      "Continue Shopping",
  NEW_ARRIVALS:           "New Arrivals",
};

const PRODUCT_TITLES: Record<ProductSectionType, string> = {
  SIMILAR_PRODUCTS:           "Similar Products",
  FREQUENTLY_BOUGHT_TOGETHER: "Frequently Bought Together",
  COMPLETE_THE_LOOK:          "Complete The Look",
  SAME_CELEBRITY:             "Same Celebrity",
  SAME_BRAND:                 "Same Brand",
};

const CART_TITLES: Record<CartSectionType, string> = {
  FREQUENTLY_BOUGHT_TOGETHER: "Frequently Bought Together",
  CROSS_SELL:                 "You Might Also Like",
  ACCESSORIES:                "Complete Your Look",
  UPSELL:                     "Upgrade Your Style",
};

// ── Edge-type → explanation mapping ──────────────────────────────────────────

const EDGE_MAP: Record<string, { reason: string; explanation: string }> = {
  TRENDING:              { reason: "TRENDING_THIS_WEEK",          explanation: EXPLANATION_TEXT.TRENDING_THIS_WEEK },
  POPULAR:               { reason: "POPULAR_RIGHT_NOW",           explanation: EXPLANATION_TEXT.POPULAR_RIGHT_NOW },
  NEWEST:                { reason: "NEW_ARRIVAL",                 explanation: EXPLANATION_TEXT.NEW_ARRIVAL },
  HYBRID_CF:             { reason: "POPULAR_AMONG_SIMILAR_USERS", explanation: EXPLANATION_TEXT.POPULAR_AMONG_SIMILAR_USERS },
  EMBEDDING_SIMILARITY:  { reason: "SIMILAR_PRODUCTS",            explanation: EXPLANATION_TEXT.SIMILAR_PRODUCTS },
  CELEBRITY_PRODUCT:     { reason: "FAVOURITE_CELEBRITY",         explanation: EXPLANATION_TEXT.FAVOURITE_CELEBRITY },
  BRAND_PRODUCT:         { reason: "FAVOURITE_BRAND",             explanation: EXPLANATION_TEXT.FAVOURITE_BRAND },
  CO_PURCHASE:           { reason: "FREQUENTLY_BOUGHT_TOGETHER",  explanation: EXPLANATION_TEXT.FREQUENTLY_BOUGHT_TOGETHER },
  CO_VIEW:               { reason: "SIMILAR_PRODUCTS",            explanation: EXPLANATION_TEXT.SIMILAR_PRODUCTS },
  SAME_CELEBRITY:        { reason: "FAVOURITE_CELEBRITY",         explanation: EXPLANATION_TEXT.FAVOURITE_CELEBRITY },
  SAME_BRAND:            { reason: "FAVOURITE_BRAND",             explanation: EXPLANATION_TEXT.FAVOURITE_BRAND },
  SAME_CATEGORY:         { reason: "MATCHES_YOUR_STYLE",          explanation: EXPLANATION_TEXT.MATCHES_YOUR_STYLE },
  EMBEDDING:             { reason: "SIMILAR_PRODUCTS",            explanation: EXPLANATION_TEXT.SIMILAR_PRODUCTS },
  USER_SIMILARITY:       { reason: "POPULAR_AMONG_SIMILAR_USERS", explanation: EXPLANATION_TEXT.POPULAR_AMONG_SIMILAR_USERS },
};

// Reverse map: human-readable label → ExplanationKey
const LABEL_TO_KEY = new Map<string, string>(
  (Object.entries(EXPLANATION_TEXT) as [ExplanationKey, string][]).map(([k, v]) => [v, k])
);

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const TTL = {
  HOME:         5  * 60_000,
  PRODUCT:      10 * 60_000,
  TRENDING:     5  * 60_000,
  NEW_ARRIVALS: 10 * 60_000,
  RECENTLY:     2  * 60_000,
  CONTINUE:     5  * 60_000,
  CART:         5  * 60_000,
  CELEBRITY:    10 * 60_000,
  POPULAR:      5  * 60_000,
};

const KEY = {
  home:              (uid: string)               => `recs:home:${uid}`,
  product:           (pid: string)               => `recs:prod:${pid}`,
  celebrity:         (cid: string)               => `recs:celeb-page:${cid}`,
  celebrityPersonal: (uid: string, cid: string)  => `recs:celeb-pers:${uid}:${cid}`,
  trending:          ()                          => "recs:trending",
  newArrivals:       ()                          => "recs:new-arrivals",
  popular:           ()                          => "recs:popular",
  recent:            (uid: string)               => `recs:recent:${uid}`,
  cont:              (uid: string)               => `recs:cont:${uid}`,
  cart:              (uid: string)               => `recs:cart:${uid}`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function guardPublished(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const rows = await prisma.product.findMany({
    where:  { id: { in: productIds }, isPublished: true, deletedAt: null },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

function edgeToItem(edge: GraphEdge): RecommendationItem {
  const mapped = EDGE_MAP[edge.edgeType] ?? {
    reason:      "POPULAR_RIGHT_NOW",
    explanation: EXPLANATION_TEXT.POPULAR_RIGHT_NOW,
  };
  return {
    productId:      edge.targetId,
    score:          parseFloat(Math.max(0, Math.min(edge.weight, 1)).toFixed(6)),
    reason:         mapped.reason,
    confidence:     parseFloat(Math.min(Math.max(edge.weight, 0), 1).toFixed(4)),
    explanation:    mapped.explanation,
    rankingSignals: {},
  };
}

function fromRanked(r: RankedProduct): RecommendationItem {
  const reason = LABEL_TO_KEY.get(r.rankingReason) ?? "POPULAR_RIGHT_NOW";
  return {
    productId:      r.productId,
    score:          r.finalScore,
    reason,
    confidence:     r.confidence,
    explanation:    r.rankingReason,
    rankingSignals: r.scoreBreakdown,
  };
}

function makeItem(
  productId:   string,
  score:       number,
  reason:      string,
  explanation: string,
  confidence   = 0.3
): RecommendationItem {
  return {
    productId,
    score:          parseFloat(Math.max(0, score).toFixed(6)),
    reason,
    confidence:     parseFloat(Math.min(Math.max(confidence, 0), 1).toFixed(4)),
    explanation,
    rankingSignals: {},
  };
}

// ── Fallback: trending + popular + newest ─────────────────────────────────────

async function fallbackRecs(limit: number): Promise<RecommendationItem[]> {
  const third = Math.max(1, Math.ceil(limit / 3));
  const [trending, popular, newest] = await Promise.all([
    prisma.trendingProduct.findMany({
      where:   { rank: { lte: third } },
      select:  { productId: true, rank: true },
      orderBy: { rank: "asc" },
      take:    third,
    }),
    prisma.product.findMany({
      where:   { isPublished: true, deletedAt: null },
      select:  { id: true },
      orderBy: { orderCount: "desc" },
      take:    third,
    }),
    prisma.product.findMany({
      where:   { isPublished: true, deletedAt: null },
      select:  { id: true },
      orderBy: { publishedAt: "desc" },
      take:    third,
    }),
  ]);

  const seen  = new Set<string>();
  const items: RecommendationItem[] = [];

  for (const t of trending) {
    if (seen.has(t.productId)) continue;
    seen.add(t.productId);
    items.push(makeItem(
      t.productId,
      (20 - Math.min(t.rank - 1, 19)) / 20,
      "TRENDING_THIS_WEEK",
      EXPLANATION_TEXT.TRENDING_THIS_WEEK,
      0.4
    ));
  }
  for (const p of popular) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    items.push(makeItem(p.id, 0.5, "POPULAR_RIGHT_NOW", EXPLANATION_TEXT.POPULAR_RIGHT_NOW, 0.3));
  }
  for (const p of newest) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    items.push(makeItem(p.id, 0.3, "NEW_ARRIVAL", EXPLANATION_TEXT.NEW_ARRIVAL, 0.3));
  }

  return items.slice(0, limit);
}

async function withFallback<T>(fn: () => Promise<T>, fb: () => Promise<T>, ctx: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[recommendation.service] ${ctx}:`, (err as Error).message);
    return fb();
  }
}

// ── Trending (public, cached) ─────────────────────────────────────────────────
// Cache stores the full list (up to MAX_TRENDING); callers slice by limit.

const MAX_TRENDING   = 50;
const MAX_NEW_ARRIVL = 50;

export async function getTrendingRecommendations(limit = 20): Promise<RecommendationItem[]> {
  const cacheKey = KEY.trending();
  let all = cacheService.get<RecommendationItem[]>(cacheKey);

  if (!all) {
    const rows = await prisma.trendingProduct.findMany({
      where:   { rank: { lte: MAX_TRENDING } },
      select:  { productId: true, rank: true, score: true },
      orderBy: { rank: "asc" },
      take:    MAX_TRENDING,
    });

    const published = await guardPublished(rows.map((r) => r.productId));

    all = rows
      .filter((r) => published.has(r.productId))
      .map((r) =>
        makeItem(
          r.productId,
          (20 - Math.min(r.rank - 1, 19)) / 20,
          "TRENDING_THIS_WEEK",
          EXPLANATION_TEXT.TRENDING_THIS_WEEK,
          0.6
        )
      );

    cacheService.set(cacheKey, all, TTL.TRENDING);
  }

  return all.slice(0, limit);
}

// ── New arrivals (public, cached) ─────────────────────────────────────────────
// Cache stores the full 30-day list; callers slice by limit.

export async function getNewArrivalsRecommendations(limit = 20): Promise<RecommendationItem[]> {
  const cacheKey = KEY.newArrivals();
  let all = cacheService.get<RecommendationItem[]>(cacheKey);

  if (!all) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const rows = await prisma.product.findMany({
      where:   { isPublished: true, deletedAt: null, publishedAt: { gte: cutoff } },
      select:  { id: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take:    MAX_NEW_ARRIVL,
    });

    const now = Date.now();
    all = rows.map((r) => {
      const ageDays = (now - (r.publishedAt?.getTime() ?? now)) / 86_400_000;
      return makeItem(r.id, Math.max(0, 1 - ageDays / 30), "NEW_ARRIVAL", EXPLANATION_TEXT.NEW_ARRIVAL, 0.5);
    });

    cacheService.set(cacheKey, all, TTL.NEW_ARRIVALS);
  }

  return all.slice(0, limit);
}

// ── Popular products (internal + exported) ────────────────────────────────────

async function getPopularProductItems(limit: number): Promise<RecommendationItem[]> {
  const MAX_POP  = 50;
  const cacheKey = KEY.popular();
  let all        = cacheService.get<RecommendationItem[]>(cacheKey);

  if (!all) {
    const rows = await prisma.productFeatureStore.findMany({
      where:   { popularityScore: { gt: 0 } },
      orderBy: { popularityScore: "desc" },
      select:  { productId: true, popularityScore: true },
      take:    MAX_POP * 2,
    });

    const published = await guardPublished(rows.map((r) => r.productId));
    all = rows
      .filter((r) => published.has(r.productId))
      .slice(0, MAX_POP)
      .map((r) =>
        makeItem(
          r.productId,
          Math.min(r.popularityScore ?? 0, 1),
          "POPULAR_RIGHT_NOW",
          EXPLANATION_TEXT.POPULAR_RIGHT_NOW,
          0.5
        )
      );

    // Fallback when ProductFeatureStore is empty
    if (all.length === 0) {
      const fb = await prisma.product.findMany({
        where:   { isPublished: true, deletedAt: null },
        select:  { id: true, orderCount: true },
        orderBy: { orderCount: "desc" },
        take:    MAX_POP,
      });
      const maxOrders = Math.max(...fb.map((p) => p.orderCount), 1);
      all = fb.map((p) =>
        makeItem(p.id, p.orderCount / maxOrders, "POPULAR_RIGHT_NOW", EXPLANATION_TEXT.POPULAR_RIGHT_NOW, 0.4)
      );
    }

    cacheService.set(cacheKey, all, TTL.POPULAR);
  }

  const items = all.slice(0, limit);

  return items;
}

// ── Celebrity recommendations (public, personalized when userId provided) ────

export async function getCelebrityRecommendations(
  celebrityId: string,
  limit = 20,
  userId?: string
): Promise<RecommendationItem[] | null> {
  const celeb = await prisma.celebrity.findUnique({ where: { id: celebrityId }, select: { id: true } });
  if (!celeb) return null;

  // Personalized path: use multi-signal ranker when a logged-in user is present
  if (userId) {
    const cacheKey = KEY.celebrityPersonal(userId, celebrityId);
    const cached   = cacheService.get<RecommendationItem[]>(cacheKey);
    if (cached) return cached;

    const [candidateIds, userFeatures] = await Promise.all([
      prisma.product.findMany({
        where:   { celebrityId, isPublished: true, deletedAt: null },
        select:  { id: true },
        orderBy: { publishedAt: "desc" },
        take:    limit * 4,
      }).then((rows) => rows.map((r) => r.id)),
      getUserFeatures(userId).catch(() => null),
    ]);

    const negativeIds = cacheService.get<string[]>(`feedback:neg:${userId}`) ?? [];
    const ranked = await rankCandidates(candidateIds, {
      userFeatures,
      negativeFeedback: new Set(negativeIds),
    }, { limit });

    const items: RecommendationItem[] = ranked.map((r) => ({
      productId:      r.productId,
      score:          r.score,
      reason:         r.reason,
      confidence:     r.confidence,
      explanation:    r.explanation,
      rankingSignals: r.breakdown,
    }));

    cacheService.set(cacheKey, items, TTL.CELEBRITY);
    return items;
  }

  // Anonymous path: popularity-based ranking via graph edges
  const cacheKey = KEY.celebrity(celebrityId);
  const cached   = cacheService.get<RecommendationItem[]>(cacheKey);
  if (cached) return cached;

  // Use new ranker even for anonymous — but with popularity-only weights
  const candidateIds = await prisma.product.findMany({
    where:   { celebrityId, isPublished: true, deletedAt: null },
    select:  { id: true },
    orderBy: { publishedAt: "desc" },
    take:    limit * 4,
  }).then((rows) => rows.map((r) => r.id));

  const ranked = await rankCandidates(candidateIds, {}, { limit });
  const items: RecommendationItem[] = ranked.map((r) => ({
    productId:      r.productId,
    score:          r.score,
    reason:         r.reason,
    confidence:     r.confidence,
    explanation:    r.explanation,
    rankingSignals: r.breakdown,
  }));

  cacheService.set(cacheKey, items, TTL.CELEBRITY);
  return items;
}

// ── Recently viewed (authenticated) ──────────────────────────────────────────

export async function getRecentlyViewedProducts(
  userId:    string,
  sessionId?: string,
  limit = 20
): Promise<RecommendationItem[]> {
  const cacheKey = KEY.recent(userId);
  const cached   = cacheService.get<RecommendationItem[]>(cacheKey);
  if (cached) return cached;

  // Session cache (in-memory recently viewed is fast for recent views)
  const sessionItems = sessionId ? cacheService.getRecentlyViewed(sessionId) : [];

  // DB fallback: last N PRODUCT_VIEW events for this user
  const events = await prisma.analyticsEvent.findMany({
    where:   { userId, type: "PRODUCT_VIEW", productId: { not: null } },
    select:  { productId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take:    limit * 3,
  });

  const seen  = new Set<string>(sessionItems);
  const allIds: string[] = [...sessionItems];
  for (const ev of events) {
    if (ev.productId && !seen.has(ev.productId)) {
      seen.add(ev.productId);
      allIds.push(ev.productId);
    }
  }

  const published = await guardPublished(allIds);
  const now       = Date.now();
  const items     = allIds
    .filter((id) => published.has(id))
    .slice(0, limit)
    .map((id, idx) =>
      makeItem(
        id,
        Math.max(0, 1 - idx / Math.max(allIds.length, 1)),
        "SIMILAR_PRODUCTS",
        EXPLANATION_TEXT.SIMILAR_PRODUCTS,
        0.4
      )
    );

  cacheService.set(cacheKey, items, TTL.RECENTLY);
  return items;
}

// ── Continue shopping (authenticated) ─────────────────────────────────────────

export async function getContinueShoppingProducts(
  userId: string,
  limit = 20
): Promise<RecommendationItem[]> {
  const cacheKey = KEY.cont(userId);
  const cached   = cacheService.get<RecommendationItem[]>(cacheKey);
  if (cached) return cached;

  // Products viewed or carted but NOT purchased
  const [viewed, carted, purchased] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where:  { userId, type: { in: ["PRODUCT_VIEW", "ADD_TO_CART"] as any[] }, productId: { not: null } },
      select: { productId: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take:   limit * 5,
    }),
    prisma.cartItem.findMany({
      where:  { cart: { userId } },
      select: { productId: true },
    }),
    prisma.orderItem.findMany({
      where:  { order: { userId } },
      select: { productId: true },
    }),
  ]);

  const purchasedIds = new Set(purchased.map((r) => r.productId));
  const seen = new Set<string>();
  const candidates: Array<{ productId: string; weight: number }> = [];

  // Cart items get higher weight
  for (const c of carted) {
    if (!purchasedIds.has(c.productId) && !seen.has(c.productId)) {
      seen.add(c.productId);
      candidates.push({ productId: c.productId, weight: 0.8 });
    }
  }

  // Viewed items
  for (const ev of viewed) {
    if (!ev.productId) continue;
    if (!purchasedIds.has(ev.productId) && !seen.has(ev.productId)) {
      seen.add(ev.productId);
      candidates.push({ productId: ev.productId, weight: ev.type === "ADD_TO_CART" ? 0.8 : 0.5 });
    }
  }

  const published = await guardPublished(candidates.map((c) => c.productId));
  const items = candidates
    .filter((c) => published.has(c.productId))
    .slice(0, limit)
    .map((c) =>
      makeItem(c.productId, c.weight, "SIMILAR_TO_WISHLIST", EXPLANATION_TEXT.SIMILAR_TO_WISHLIST, 0.4)
    );

  cacheService.set(cacheKey, items, TTL.CONTINUE);
  return items;
}

// ── Home recommendations (authenticated, multi-section) ───────────────────────

export async function getHomeRecommendations(
  userId:     string,
  sessionId?: string,
  limit = 8
): Promise<{ sections: RecommendationSection<HomeSectionType>[] }> {
  const cacheKey = KEY.home(userId);
  const cached   = cacheService.get<{ sections: RecommendationSection<HomeSectionType>[] }>(cacheKey);
  if (cached) return cached;

  const userFeatures = await getUserFeatures(userId).catch(() => null);

  // Parallel fetch where possible
  const [ranked, trending, popular, newArrivals, recentlyViewed, continueShopping] = await Promise.all([
    withFallback(
      () => rankForUser(userId, { limit }).then((rs) => rs.map(fromRanked)),
      () => fallbackRecs(limit),
      `rankForUser(${userId})`
    ),
    getTrendingRecommendations(limit),
    getPopularProductItems(limit),
    getNewArrivalsRecommendations(limit),
    getRecentlyViewedProducts(userId, sessionId, limit),
    getContinueShoppingProducts(userId, limit),
  ]);

  // "Inspired By Celebrity" needs user features first
  let inspiredByCeleb: RecommendationItem[] = [];
  if (userFeatures && Object.keys(userFeatures.celebrityAffinity).length > 0) {
    const topCeleb = Object.entries(userFeatures.celebrityAffinity)
      .sort(([, a], [, b]) => b - a)[0];
    if (topCeleb) {
      const celebRecs = await getCelebrityRecommendations(topCeleb[0], limit).catch(() => null);
      inspiredByCeleb = celebRecs ?? [];
    }
  }
  if (inspiredByCeleb.length === 0) {
    // Fallback: trending items from top celeb in DB
    const topCelebRow = await prisma.product.findFirst({
      where:   { isPublished: true, deletedAt: null },
      select:  { celebrityId: true },
      orderBy: { orderCount: "desc" },
    });
    if (topCelebRow) {
      const edges = await getCelebrityToProductEdges(topCelebRow.celebrityId, limit);
      const pub   = await guardPublished(edges.map((e) => e.targetId));
      inspiredByCeleb = edges.filter((e) => pub.has(e.targetId)).slice(0, limit).map(edgeToItem);
    }
  }

  const sections: RecommendationSection<HomeSectionType>[] = [
    { type: "RECOMMENDED_FOR_YOU",   title: HOME_TITLES.RECOMMENDED_FOR_YOU,   items: ranked },
    { type: "TRENDING",              title: HOME_TITLES.TRENDING,               items: trending },
    { type: "POPULAR",               title: HOME_TITLES.POPULAR,                items: popular },
    { type: "INSPIRED_BY_CELEBRITY", title: HOME_TITLES.INSPIRED_BY_CELEBRITY,  items: inspiredByCeleb },
    { type: "RECENTLY_VIEWED",       title: HOME_TITLES.RECENTLY_VIEWED,        items: recentlyViewed },
    { type: "CONTINUE_SHOPPING",     title: HOME_TITLES.CONTINUE_SHOPPING,      items: continueShopping },
    { type: "NEW_ARRIVALS",          title: HOME_TITLES.NEW_ARRIVALS,           items: newArrivals },
  ];

  const result = { sections };
  cacheService.set(cacheKey, result, TTL.HOME);
  return result;
}

// ── Product page recommendations (public, multi-section) ──────────────────────

export async function getProductRecommendations(
  productId: string,
  limit = 8,
  userId?: string
): Promise<{ sections: RecommendationSection<ProductSectionType>[] } | null> {
  const product = await prisma.product.findUnique({
    where:  { id: productId },
    select: { id: true, category: true, brandId: true, celebrityId: true, basePrice: true, isPublished: true, deletedAt: true },
  });
  if (!product || !product.isPublished || product.deletedAt) return null;

  const cacheKey = KEY.product(productId);
  const cached   = cacheService.get<{ sections: RecommendationSection<ProductSectionType>[] }>(cacheKey);
  if (cached) return cached;

  // Fetch all sections in parallel
  const [similarEdges, fbtPairs, celebEdges, brandEdges] = await Promise.all([
    // Similar Products: embedding neighbors
    (async () => {
      const { findSimilarToProduct } = await import("../lib/vector.db.js");
      const rows = await findSimilarToProduct(productId, limit * 2);
      return rows.map((r) => ({
        targetId: r.productId,
        weight:   r.similarity,
        edgeType: "EMBEDDING_SIMILARITY",
      } satisfies GraphEdge));
    })(),

    // Frequently Bought Together: CoPurchasedPair
    prisma.coPurchasedPair.findMany({
      where:   { OR: [{ productAId: productId }, { productBId: productId }] },
      orderBy: { coPurchaseCount: "desc" },
      take:    limit * 2,
    }),

    // Same Celebrity
    getCelebrityToProductEdges(product.celebrityId, limit * 2),

    // Same Brand
    product.brandId
      ? getBrandToProductEdges(product.brandId, limit * 2)
      : Promise.resolve([]),
  ]);

  // "Complete The Look": same celebrity, DIFFERENT category
  const [completeLookRows, userFeatures] = await Promise.all([
    prisma.product.findMany({
      where:   {
        celebrityId: product.celebrityId,
        category:    { not: product.category },
        isPublished: true,
        deletedAt:   null,
        id:          { not: productId },
      },
      select:  { id: true, orderCount: true },
      orderBy: { orderCount: "desc" },
      take:    limit * 2,
    }),
    userId ? getUserFeatures(userId).catch(() => null) : Promise.resolve(null),
  ]);

  // Build sets and filter
  const allCandidateIds = [
    ...similarEdges.map((e) => e.targetId),
    ...fbtPairs.map((p) => (p.productAId === productId ? p.productBId : p.productAId)),
    ...completeLookRows.map((p) => p.id),
    ...celebEdges.map((e) => e.targetId),
    ...brandEdges.map((e) => e.targetId),
  ].filter((id) => id !== productId);

  const published = await guardPublished(allCandidateIds);

  const filterEdges = (edges: GraphEdge[]) =>
    edges.filter((e) => e.targetId !== productId && published.has(e.targetId));

  const fbtItems = fbtPairs
    .map((p) => {
      const partnerId = p.productAId === productId ? p.productBId : p.productAId;
      return makeItem(
        partnerId,
        Math.min(p.coPurchaseCount / 10, 1),
        "FREQUENTLY_BOUGHT_TOGETHER",
        EXPLANATION_TEXT.FREQUENTLY_BOUGHT_TOGETHER,
        0.7
      );
    })
    .filter((item) => published.has(item.productId))
    .slice(0, limit);

  const completeLookItems = completeLookRows
    .filter((p) => published.has(p.id))
    .slice(0, limit)
    .map((p, idx) =>
      makeItem(p.id, Math.max(0, 1 - idx / limit), "SAME_CELEBRITY", EXPLANATION_TEXT.FAVOURITE_CELEBRITY, 0.5)
    );

  // Sprint 8.4: use multi-signal ranker for SAME_CELEBRITY and SAME_BRAND sections
  const userCtx = { userFeatures: userFeatures ?? null };
  const celebCandidateIds = celebEdges
    .filter((e) => e.targetId !== productId && published.has(e.targetId))
    .map((e) => e.targetId);
  const brandCandidateIds = brandEdges
    .filter((e) => e.targetId !== productId && published.has(e.targetId))
    .map((e) => e.targetId);

  const [rankedCelebItems, rankedBrandItems] = await Promise.all([
    celebCandidateIds.length > 0
      ? rankCandidates(celebCandidateIds, userCtx, { excludeIds: new Set([productId]), limit })
          .then((rs) => rs.map((r) => ({
            productId:      r.productId,
            score:          r.score,
            reason:         r.reason,
            confidence:     r.confidence,
            explanation:    r.explanation,
            rankingSignals: r.breakdown,
          } as RecommendationItem)))
      : Promise.resolve(filterEdges(celebEdges).filter((e) => e.targetId !== productId).slice(0, limit).map(edgeToItem)),
    brandCandidateIds.length > 0
      ? rankCandidates(brandCandidateIds, userCtx, { excludeIds: new Set([productId]), limit })
          .then((rs) => rs.map((r) => ({
            productId:      r.productId,
            score:          r.score,
            reason:         r.reason,
            confidence:     r.confidence,
            explanation:    r.explanation,
            rankingSignals: r.breakdown,
          } as RecommendationItem)))
      : Promise.resolve(filterEdges(brandEdges).slice(0, limit).map(edgeToItem)),
  ]);

  const sections: RecommendationSection<ProductSectionType>[] = [
    {
      type:  "SIMILAR_PRODUCTS",
      title: PRODUCT_TITLES.SIMILAR_PRODUCTS,
      items: filterEdges(similarEdges).slice(0, limit).map(edgeToItem),
    },
    {
      type:  "FREQUENTLY_BOUGHT_TOGETHER",
      title: PRODUCT_TITLES.FREQUENTLY_BOUGHT_TOGETHER,
      items: fbtItems,
    },
    {
      type:  "COMPLETE_THE_LOOK",
      title: PRODUCT_TITLES.COMPLETE_THE_LOOK,
      items: completeLookItems,
    },
    {
      type:  "SAME_CELEBRITY",
      title: PRODUCT_TITLES.SAME_CELEBRITY,
      items: rankedCelebItems,
    },
    {
      type:  "SAME_BRAND",
      title: PRODUCT_TITLES.SAME_BRAND,
      items: rankedBrandItems,
    },
  ];

  const result = { sections };
  cacheService.set(cacheKey, result, TTL.PRODUCT);
  return result;
}

// ── Cart recommendations (authenticated, multi-section) ───────────────────────

export async function getCartRecommendations(
  userId:         string,
  cartProductIds?: string[],
  limit = 8
): Promise<{ sections: RecommendationSection<CartSectionType>[] }> {
  const cacheKey = KEY.cart(userId);
  const cached   = cacheService.get<{ sections: RecommendationSection<CartSectionType>[] }>(cacheKey);
  if (cached) return cached;

  // Resolve cart item IDs
  let resolvedCartIds: string[] = cartProductIds ?? [];
  if (resolvedCartIds.length === 0) {
    // Fall back to recent ADD_TO_CART events minus purchased items
    const [cartEvents, purchased] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where:  { userId, type: "ADD_TO_CART" as any, productId: { not: null } },
        select: { productId: true },
        orderBy: { createdAt: "desc" },
        take:   20,
      }),
      prisma.orderItem.findMany({
        where:  { order: { userId } },
        select: { productId: true },
      }),
    ]);
    const purchasedIds = new Set(purchased.map((r) => r.productId));
    resolvedCartIds = [...new Set(
      cartEvents.map((e) => e.productId).filter((id): id is string => !!id && !purchasedIds.has(id))
    )];
  }

  // Load cart product details for upsell + cross-sell
  const cartProducts = resolvedCartIds.length > 0
    ? await prisma.product.findMany({
        where:  { id: { in: resolvedCartIds }, isPublished: true, deletedAt: null },
        select: { id: true, category: true, basePrice: true },
      })
    : [];

  const cartCategories = new Set(cartProducts.map((p) => p.category));
  const avgCartPrice   = cartProducts.length > 0
    ? cartProducts.reduce((s, p) => s + p.basePrice, 0) / cartProducts.length
    : 0;

  // Parallel fetch of all section data
  const [fbtPairs, crossSellRows, upsellRows] = await Promise.all([
    // FBT: co-purchased pairs for any cart item
    resolvedCartIds.length > 0
      ? prisma.coPurchasedPair.findMany({
          where: {
            OR: [
              { productAId: { in: resolvedCartIds } },
              { productBId: { in: resolvedCartIds } },
            ],
          },
          orderBy: { coPurchaseCount: "desc" },
          take:    limit * 3,
        })
      : Promise.resolve([]),

    // Cross Sell: popular products in DIFFERENT categories
    prisma.product.findMany({
      where: {
        isPublished: true,
        deletedAt:   null,
        id:          { notIn: resolvedCartIds.length ? resolvedCartIds : ["__none__"] },
        ...(cartCategories.size > 0 && { category: { notIn: [...cartCategories] } }),
      },
      select:  { id: true, orderCount: true },
      orderBy: { orderCount: "desc" },
      take:    limit,
    }),

    // Upsell: same categories, higher price
    avgCartPrice > 0
      ? prisma.product.findMany({
          where: {
            isPublished: true,
            deletedAt:   null,
            id:          { notIn: resolvedCartIds.length ? resolvedCartIds : ["__none__"] },
            ...(cartCategories.size > 0 && { category: { in: [...cartCategories] } }),
            basePrice:   { gt: avgCartPrice * 1.2 },
          },
          select:  { id: true, orderCount: true, basePrice: true },
          orderBy: { orderCount: "desc" },
          take:    limit,
        })
      : Promise.resolve([]),
  ]);

  // Accessories: co-viewed products with cart items (cross-category)
  const coViewPairs = resolvedCartIds.length > 0
    ? await prisma.coviewedPair.findMany({
        where: {
          OR: [
            { productAId: { in: resolvedCartIds } },
            { productBId: { in: resolvedCartIds } },
          ],
        },
        orderBy: { coviewCount: "desc" },
        take:    limit * 3,
      })
    : [];

  // Build FBT items
  const fbtProductIds = fbtPairs
    .map((p) =>
      resolvedCartIds.includes(p.productAId) ? p.productBId : p.productAId
    )
    .filter((id) => !resolvedCartIds.includes(id));
  const coViewIds = coViewPairs
    .map((p) =>
      resolvedCartIds.includes(p.productAId) ? p.productBId : p.productAId
    )
    .filter((id) => !resolvedCartIds.includes(id));

  const allIds = [...new Set([...fbtProductIds, ...coViewIds, ...crossSellRows.map((r) => r.id), ...upsellRows.map((r) => r.id)])];
  const published = await guardPublished(allIds);

  const fbtItems = fbtPairs
    .map((p) => {
      const pid = resolvedCartIds.includes(p.productAId) ? p.productBId : p.productAId;
      return published.has(pid) && !resolvedCartIds.includes(pid)
        ? makeItem(pid, Math.min(p.coPurchaseCount / 10, 1), "FREQUENTLY_BOUGHT_TOGETHER", EXPLANATION_TEXT.FREQUENTLY_BOUGHT_TOGETHER, 0.7)
        : null;
    })
    .filter(Boolean)
    .slice(0, limit) as RecommendationItem[];

  const accessoryItems = coViewIds
    .filter((id) => published.has(id))
    .slice(0, limit)
    .map((id, idx) =>
      makeItem(id, Math.max(0, 1 - idx / limit), "FREQUENTLY_BOUGHT_TOGETHER", EXPLANATION_TEXT.FREQUENTLY_BOUGHT_TOGETHER, 0.5)
    );

  const crossSellItems = crossSellRows
    .filter((r) => published.has(r.id))
    .slice(0, limit)
    .map((r, idx) =>
      makeItem(r.id, Math.max(0, 1 - idx / limit), "MATCHES_YOUR_STYLE", EXPLANATION_TEXT.MATCHES_YOUR_STYLE, 0.4)
    );

  const upsellItems = upsellRows
    .filter((r) => published.has(r.id))
    .slice(0, limit)
    .map((r, idx) =>
      makeItem(r.id, Math.max(0, 1 - idx / limit), "POPULAR_RIGHT_NOW", EXPLANATION_TEXT.POPULAR_RIGHT_NOW, 0.4)
    );

  const sections: RecommendationSection<CartSectionType>[] = [
    { type: "FREQUENTLY_BOUGHT_TOGETHER", title: CART_TITLES.FREQUENTLY_BOUGHT_TOGETHER, items: fbtItems },
    { type: "CROSS_SELL",                 title: CART_TITLES.CROSS_SELL,                 items: crossSellItems },
    { type: "ACCESSORIES",                title: CART_TITLES.ACCESSORIES,                items: accessoryItems },
    { type: "UPSELL",                     title: CART_TITLES.UPSELL,                     items: upsellItems },
  ];

  const result = { sections };
  cacheService.set(cacheKey, result, TTL.CART);
  return result;
}

// ── Cache invalidation ────────────────────────────────────────────────────────

export function invalidateUserRecommendationsCache(userId: string): void {
  cacheService.del(KEY.home(userId));
  cacheService.del(KEY.recent(userId));
  cacheService.del(KEY.cont(userId));
  cacheService.del(KEY.cart(userId));
}

export function invalidateProductRecommendationsCache(productId: string): void {
  cacheService.del(KEY.product(productId));
}

export function invalidateGlobalRecommendationsCache(): void {
  cacheService.del(KEY.trending());
  cacheService.del(KEY.newArrivals());
  cacheService.del(KEY.popular());
}

export const recommendationService = {
  getTrendingRecommendations,
  getNewArrivalsRecommendations,
  getCelebrityRecommendations,
  getProductRecommendations,
  getHomeRecommendations,
  getRecentlyViewedProducts,
  getContinueShoppingProducts,
  getCartRecommendations,
  invalidateUserRecommendationsCache,
  invalidateProductRecommendationsCache,
  invalidateGlobalRecommendationsCache,
};

export type { HomeSectionType as _HomeSectionType, ProductSectionType as _ProductSectionType };
export { HOME_TITLES, PRODUCT_TITLES, CART_TITLES };
