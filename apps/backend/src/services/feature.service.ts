/**
 * feature.service — Feature Store computation for users and products.
 *
 * Reads from AnalyticsEvent, Order, Wishlist, Cart, and Product tables.
 * Results are persisted to UserFeatureStore / ProductFeatureStore and
 * cached in the in-memory cache layer.
 *
 * All DB reads are single-statement Prisma queries (PgBouncer-safe).
 */

import { prisma } from "../lib/prisma.js";
import { cacheService, CacheKey, TTL } from "../lib/cache.service.js";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

type AffinityMap = Record<string, number>;

export interface UserFeatures {
  categoryAffinity:   AffinityMap;
  celebrityAffinity:  AffinityMap;
  brandAffinity:      AffinityMap;
  pricePreference:    { min: number; max: number; avg: number };
  colorPreference:    AffinityMap;
  occasionPreference: AffinityMap;
  purchaseFrequency:  number;
  recencyScore:       number;
  monetaryScore:      number;
  wishlistAffinity:   AffinityMap;
  cartAffinity:       AffinityMap;
  searchAffinity:     AffinityMap;
}

export interface ProductFeatures {
  ctr:             number;
  conversionRate:  number;
  wishlistRate:    number;
  addToCartRate:   number;
  returnRate:      number;
  popularityScore: number;
  trendingScore:   number;
  freshnessScore:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOOKBACK_MS = {
  short:  7  * 86_400_000,
  medium: 30 * 86_400_000,
  long:   90 * 86_400_000,
};

const EVENT_WEIGHTS: Partial<Record<string, number>> = {
  PRODUCT_VIEW:     1,
  ADD_TO_WISHLIST:  2,
  ADD_TO_CART:      3,
  PURCHASE:         5,
};

function addToAffinity(map: AffinityMap, key: string | null | undefined, weight: number): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + weight;
}

function sortedSlice(map: AffinityMap, limit = 20): AffinityMap {
  return Object.fromEntries(
    Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
  );
}

function recencyDecay(lastOrderDate: Date | null): number {
  if (!lastOrderDate) return 0;
  const daysSince = (Date.now() - lastOrderDate.getTime()) / 86_400_000;
  return Math.exp(-daysSince / 30); // half-life ~30 days
}

// ── User feature computation ──────────────────────────────────────────────────

export async function computeUserFeatures(userId: string): Promise<UserFeatures> {
  const now  = Date.now();
  const d90  = new Date(now - LOOKBACK_MS.long);
  const d30  = new Date(now - LOOKBACK_MS.medium);

  // ── Engagement events (last 90 days) ──
  const events = await prisma.analyticsEvent.findMany({
    where: {
      userId,
      createdAt: { gte: d90 },
      type: { in: ["PRODUCT_VIEW", "ADD_TO_CART", "PURCHASE", "ADD_TO_WISHLIST"] },
      productId: { not: null },
    },
    include: {
      product: {
        select: {
          category:      true,
          occasion:      true,
          colorPalette:  true,
          basePrice:     true,
          celebrity:     { select: { id: true } },
          brand:         { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    2000,
  });

  const categoryAffinity:   AffinityMap = {};
  const celebrityAffinity:  AffinityMap = {};
  const brandAffinity:      AffinityMap = {};
  const colorPreference:    AffinityMap = {};
  const occasionPreference: AffinityMap = {};
  const prices: number[] = [];

  for (const ev of events) {
    if (!ev.product) continue;
    const w = EVENT_WEIGHTS[ev.type] ?? 1;
    const p = ev.product;

    addToAffinity(categoryAffinity,   p.category,          w);
    addToAffinity(occasionPreference, p.occasion,          w);
    addToAffinity(colorPreference,    p.colorPalette || null, w);
    addToAffinity(celebrityAffinity,  p.celebrity?.id,     w);
    addToAffinity(brandAffinity,      p.brand?.id,         w);

    if (ev.type === "PURCHASE" || ev.type === "PRODUCT_VIEW") {
      prices.push(p.basePrice);
    }
  }

  const pricePreference =
    prices.length === 0
      ? { min: 0, max: 0, avg: 0 }
      : {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round(prices.reduce((s, v) => s + v, 0) / prices.length),
        };

  // ── Orders (last 90 days) ──
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status:    { in: ["DELIVERED", "PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY"] },
      createdAt: { gte: d90 },
    },
    select: { total: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const orders30d = orders.filter((o) => o.createdAt >= d30);
  const purchaseFrequency = orders30d.length; // orders in last 30 days
  const monetaryScore     = orders.reduce((s, o) => s + o.total, 0);
  const recencyScore      = recencyDecay(orders[0]?.createdAt ?? null);

  // ── Wishlist affinity ──
  const wishlistItems = await prisma.wishlistItem.findMany({
    where:   { wishlist: { userId } },
    include: { product: { select: { category: true } } },
    take:    200,
  });

  const wishlistAffinity: AffinityMap = {};
  for (const item of wishlistItems) {
    addToAffinity(wishlistAffinity, item.product?.category, 1);
  }

  // ── Cart affinity ──
  const cartItems = await prisma.cartItem.findMany({
    where:   { cart: { userId } },
    include: { product: { select: { category: true } } },
  });

  const cartAffinity: AffinityMap = {};
  for (const item of cartItems) {
    addToAffinity(cartAffinity, item.product?.category, 1);
  }

  // ── Search affinity ──
  const searchEvents = await prisma.analyticsEvent.findMany({
    where:  { userId, type: "SEARCH", createdAt: { gte: d90 } },
    select: { searchQuery: true },
    take:   500,
  });

  const searchAffinity: AffinityMap = {};
  for (const ev of searchEvents) {
    addToAffinity(searchAffinity, ev.searchQuery, 1);
  }

  return {
    categoryAffinity:   sortedSlice(categoryAffinity),
    celebrityAffinity:  sortedSlice(celebrityAffinity),
    brandAffinity:      sortedSlice(brandAffinity),
    pricePreference,
    colorPreference:    sortedSlice(colorPreference),
    occasionPreference: sortedSlice(occasionPreference),
    purchaseFrequency,
    recencyScore:       parseFloat(recencyScore.toFixed(6)),
    monetaryScore,
    wishlistAffinity:   sortedSlice(wishlistAffinity),
    cartAffinity:       sortedSlice(cartAffinity),
    searchAffinity:     sortedSlice(searchAffinity, 30),
  };
}

// ── Product feature computation ───────────────────────────────────────────────

export async function computeProductFeatures(productId: string): Promise<ProductFeatures> {
  const now  = Date.now();
  const d7   = new Date(now - LOOKBACK_MS.short);
  const d30  = new Date(now - LOOKBACK_MS.medium);

  const [
    views,
    carts,
    wishlists,
    orders,
    impressions,
    clicks,
    returnCount,
    product,
    views7d,
    views30d,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { productId, type: "PRODUCT_VIEW" } }),
    prisma.analyticsEvent.count({ where: { productId, type: "ADD_TO_CART" } }),
    prisma.analyticsEvent.count({ where: { productId, type: "ADD_TO_WISHLIST" } }),
    prisma.orderItem.count({ where: { productId } }),
    prisma.recommendationImpression.count({ where: { productId } }),
    prisma.recommendationImpression.count({ where: { productId, wasClicked: true } }),
    prisma.returnItem.count({ where: { orderItem: { productId } } }),
    prisma.product.findUnique({
      where:  { id: productId },
      select: { publishedAt: true, viewCount: true, wishlistCount: true, orderCount: true },
    }),
    prisma.analyticsEvent.count({ where: { productId, type: "PRODUCT_VIEW", createdAt: { gte: d7 } } }),
    prisma.analyticsEvent.count({ where: { productId, type: "PRODUCT_VIEW", createdAt: { gte: d30 } } }),
  ]);

  const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

  const ctr            = safeDiv(clicks, impressions);
  const conversionRate = safeDiv(orders, views);
  const wishlistRate   = safeDiv(wishlists, views);
  const addToCartRate  = safeDiv(carts, views);
  const returnRate     = safeDiv(returnCount, orders);

  // Popularity: weighted combination of denormalized product counters
  const viewC     = product?.viewCount    ?? views;
  const wishC     = product?.wishlistCount ?? wishlists;
  const orderC    = product?.orderCount    ?? orders;
  const maxScore  = Math.max(viewC + wishC * 3 + orderC * 5, 1);
  const popularityScore = (viewC + wishC * 3 + orderC * 5) / maxScore;

  // Trending: 7d velocity vs prior 23d
  const views30dPrior = views30d - views7d;
  const trendingScore = safeDiv(views7d, Math.max(views30dPrior, 1));

  // Freshness: exponential decay from publishedAt (60-day half-life)
  const freshnessScore =
    product?.publishedAt
      ? Math.exp(-((Date.now() - product.publishedAt.getTime()) / 86_400_000) / 60)
      : 0;

  return {
    ctr:             parseFloat(ctr.toFixed(6)),
    conversionRate:  parseFloat(conversionRate.toFixed(6)),
    wishlistRate:    parseFloat(wishlistRate.toFixed(6)),
    addToCartRate:   parseFloat(addToCartRate.toFixed(6)),
    returnRate:      parseFloat(returnRate.toFixed(6)),
    popularityScore: parseFloat(popularityScore.toFixed(6)),
    trendingScore:   parseFloat(trendingScore.toFixed(6)),
    freshnessScore:  parseFloat(freshnessScore.toFixed(6)),
  };
}

// ── Persist + cache helpers ───────────────────────────────────────────────────

export async function refreshUserFeatures(userId: string): Promise<UserFeatures> {
  const features = await computeUserFeatures(userId);

  const existing = await prisma.userFeatureStore.findUnique({ where: { userId } });

  if (existing) {
    await prisma.userFeatureStore.update({
      where: { userId },
      data:  { ...features, computedAt: new Date() },
    });
  } else {
    await prisma.userFeatureStore.create({
      data: { id: randomUUID(), userId, ...features, computedAt: new Date() },
    });
  }

  cacheService.setUserFeatures(userId, features as unknown as Record<string, unknown>);
  return features;
}

export async function refreshProductFeatures(productId: string): Promise<ProductFeatures> {
  const features = await computeProductFeatures(productId);

  const existing = await prisma.productFeatureStore.findUnique({ where: { productId } });

  if (existing) {
    await prisma.productFeatureStore.update({
      where: { productId },
      data:  { ...features, computedAt: new Date() },
    });
  } else {
    await prisma.productFeatureStore.create({
      data: { id: randomUUID(), productId, ...features, computedAt: new Date() },
    });
  }

  cacheService.setProductFeatures(productId, features as unknown as Record<string, unknown>);
  return features;
}

export async function getUserFeatures(userId: string): Promise<UserFeatures | null> {
  const cached = cacheService.getUserFeatures(userId);
  if (cached) return cached as unknown as UserFeatures;

  const row = await prisma.userFeatureStore.findUnique({ where: { userId } });
  if (!row) return null;

  const features = {
    categoryAffinity:   row.categoryAffinity   as AffinityMap,
    celebrityAffinity:  row.celebrityAffinity  as AffinityMap,
    brandAffinity:      row.brandAffinity      as AffinityMap,
    pricePreference:    row.pricePreference    as { min: number; max: number; avg: number },
    colorPreference:    row.colorPreference    as AffinityMap,
    occasionPreference: row.occasionPreference as AffinityMap,
    purchaseFrequency:  row.purchaseFrequency,
    recencyScore:       row.recencyScore,
    monetaryScore:      row.monetaryScore,
    wishlistAffinity:   row.wishlistAffinity  as AffinityMap,
    cartAffinity:       row.cartAffinity      as AffinityMap,
    searchAffinity:     row.searchAffinity    as AffinityMap,
  };

  cacheService.setUserFeatures(userId, features as unknown as Record<string, unknown>);
  return features;
}

export async function getProductFeatures(productId: string): Promise<ProductFeatures | null> {
  const cached = cacheService.getProductFeatures(productId);
  if (cached) return cached as unknown as ProductFeatures;

  const row = await prisma.productFeatureStore.findUnique({ where: { productId } });
  if (!row) return null;

  const features: ProductFeatures = {
    ctr:             row.ctr,
    conversionRate:  row.conversionRate,
    wishlistRate:    row.wishlistRate,
    addToCartRate:   row.addToCartRate,
    returnRate:      row.returnRate,
    popularityScore: row.popularityScore,
    trendingScore:   row.trendingScore,
    freshnessScore:  row.freshnessScore,
  };

  cacheService.setProductFeatures(productId, features as unknown as Record<string, unknown>);
  return features;
}

export const featureService = {
  computeUserFeatures,
  computeProductFeatures,
  refreshUserFeatures,
  refreshProductFeatures,
  getUserFeatures,
  getProductFeatures,
};
