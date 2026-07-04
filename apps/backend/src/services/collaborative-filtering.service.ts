/**
 * collaborative-filtering.service — user-based and item-based CF.
 *
 * User-based CF:
 *   1. Find K similar users (using SimilarityService)
 *   2. Aggregate their product interactions, weighted by similarity
 *   3. Filter out products the target user already knows
 *
 * Item-based CF:
 *   1. Get all products the target user interacted with (weighted by interaction type)
 *   2. For each, fetch similar products via pgvector ANN
 *   3. Aggregate scores, weighted by interaction weight × embedding similarity
 *
 * Hybrid:
 *   user-based × 0.4 + item-based × 0.4 + popularity × 0.2
 *
 * All DB reads are single-statement (PgBouncer-safe).
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import {
  userHybridSimilarity,
  getUserProductSet,
  userSimilarityMatrix,
  invalidateUserInteractionCache,
  type SimilarityEntry,
} from "./similarity.service.js";
import { findSimilarToProduct } from "../lib/vector.db.js";

// ── Cache key helpers ─────────────────────────────────────────────────────────

const KEY = {
  userBasedRecs:  (id: string) => `cf:recs:user:${id}`,
  itemBasedRecs:  (id: string) => `cf:recs:item:${id}`,
  hybridRecs:     (id: string) => `cf:recs:hybrid:${id}`,
  similarUsers:   (id: string) => `cf:sim:u2u:${id}`,
};

const TTL_RECS = 15 * 60_000; // 15 min

// ── Interaction weight map ────────────────────────────────────────────────────

const INTERACTION_WEIGHTS: Record<string, number> = {
  PURCHASE:        5,
  ADD_TO_WISHLIST: 2,
  ADD_TO_CART:     3,
  PRODUCT_VIEW:    1,
};

// ── Find similar users ────────────────────────────────────────────────────────

export async function findSimilarUsers(userId: string, limit = 10): Promise<SimilarityEntry[]> {
  const matrix = userSimilarityMatrix.getNeighbors(userId);
  if (matrix) return matrix;

  const userProducts = await getUserProductSet(userId);
  if (userProducts.size === 0) return [];

  // Candidate generation: find other users who engaged with the same products
  const candidateRows = await prisma.analyticsEvent.findMany({
    where: {
      productId: { in: [...userProducts] },
      userId:    { notIn: [userId], not: null },
      type:      { in: Object.keys(INTERACTION_WEIGHTS) as any[] },
    },
    select:   { userId: true },
    distinct: ["userId"],
    take:     60,
  });

  const candidateIds = candidateRows.map((r) => r.userId as string);

  const similarities = await Promise.all(
    candidateIds.map(async (cId) => ({
      id:    cId,
      score: await userHybridSimilarity(userId, cId),
    }))
  );

  const result = similarities
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  userSimilarityMatrix.setNeighbors(userId, result);
  return result;
}

// ── User-based CF ─────────────────────────────────────────────────────────────

export async function getUserBasedRecommendations(userId: string, limit = 20): Promise<SimilarityEntry[]> {
  const cached = cacheService.get<SimilarityEntry[]>(KEY.userBasedRecs(userId));
  if (cached) return cached;

  const similarUsers = await findSimilarUsers(userId, 10);
  if (similarUsers.length === 0) return [];

  const userInteracted = await getUserProductSet(userId);
  const scoreMap = new Map<string, number>();

  for (const { id: simUserId, score: userSim } of similarUsers) {
    const products = await getUserProductSet(simUserId);
    for (const pid of products) {
      if (!userInteracted.has(pid)) {
        scoreMap.set(pid, (scoreMap.get(pid) ?? 0) + userSim);
      }
    }
  }

  const result = [...scoreMap.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  cacheService.set(KEY.userBasedRecs(userId), result, TTL_RECS);
  return result;
}

// ── Item-based CF ─────────────────────────────────────────────────────────────

async function getUserWeightedInteractions(userId: string): Promise<Map<string, number>> {
  const [orders, wishlist, cart, views] = await Promise.all([
    prisma.orderItem.findMany({
      where:  { order: { userId } },
      select: { productId: true },
    }),
    prisma.wishlistItem.findMany({
      where:  { wishlist: { userId } },
      select: { productId: true },
    }),
    prisma.cartItem.findMany({
      where:  { cart: { userId } },
      select: { productId: true },
    }),
    prisma.analyticsEvent.findMany({
      where:  { userId, type: "PRODUCT_VIEW", productId: { not: null } },
      select: { productId: true },
      take:   100,
    }),
  ]);

  const scores = new Map<string, number>();
  const upsert = (pid: string | null, w: number) => {
    if (!pid) return;
    scores.set(pid, Math.max(scores.get(pid) ?? 0, w));
  };

  for (const r of orders)   upsert(r.productId, INTERACTION_WEIGHTS.PURCHASE);
  for (const r of wishlist) upsert(r.productId, INTERACTION_WEIGHTS.ADD_TO_WISHLIST);
  for (const r of cart)     upsert(r.productId, INTERACTION_WEIGHTS.ADD_TO_CART);
  for (const r of views)    upsert(r.productId, INTERACTION_WEIGHTS.PRODUCT_VIEW);

  return scores;
}

export async function getItemBasedRecommendations(userId: string, limit = 20): Promise<SimilarityEntry[]> {
  const cached = cacheService.get<SimilarityEntry[]>(KEY.itemBasedRecs(userId));
  if (cached) return cached;

  const interactionScores = await getUserWeightedInteractions(userId);
  if (interactionScores.size === 0) return [];

  const scoreMap = new Map<string, number>();

  for (const [interactedPid, interactionW] of interactionScores) {
    const similar = await findSimilarToProduct(interactedPid, 10);
    for (const { productId, similarity } of similar) {
      if (!interactionScores.has(productId)) {
        scoreMap.set(productId, (scoreMap.get(productId) ?? 0) + interactionW * similarity);
      }
    }
  }

  const result = [...scoreMap.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  cacheService.set(KEY.itemBasedRecs(userId), result, TTL_RECS);
  return result;
}

// ── Hybrid CF ─────────────────────────────────────────────────────────────────

export async function getHybridRecommendations(userId: string, limit = 20): Promise<SimilarityEntry[]> {
  const cached = cacheService.get<SimilarityEntry[]>(KEY.hybridRecs(userId));
  if (cached) return cached;

  const [userBased, itemBased] = await Promise.all([
    getUserBasedRecommendations(userId, limit * 2),
    getItemBasedRecommendations(userId, limit * 2),
  ]);

  // Popularity boost: products in TrendingProduct get a small bonus
  const trending = await prisma.trendingProduct.findMany({
    where:   { rank: { lte: 20 } },
    select:  { productId: true, rank: true },
    orderBy: { rank: "asc" },
  });
  const trendingBonus = new Map(trending.map((t) => [t.productId, (20 - t.rank + 1) / 20]));

  const scoreMap = new Map<string, number>();
  const addScore = (id: string, score: number, weight: number) => {
    scoreMap.set(id, (scoreMap.get(id) ?? 0) + score * weight);
  };

  for (const { id, score } of userBased) addScore(id, score, 0.4);
  for (const { id, score } of itemBased) addScore(id, score, 0.4);
  for (const [id, bonus] of trendingBonus) addScore(id, bonus, 0.2);

  const result = [...scoreMap.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  cacheService.set(KEY.hybridRecs(userId), result, TTL_RECS);
  return result;
}

// ── Cache invalidation ────────────────────────────────────────────────────────

export function invalidateUserCFCache(userId: string): void {
  cacheService.del(KEY.userBasedRecs(userId));
  cacheService.del(KEY.itemBasedRecs(userId));
  cacheService.del(KEY.hybridRecs(userId));
  cacheService.del(KEY.similarUsers(userId));
  invalidateUserInteractionCache(userId);
}

export const collaborativeFilteringService = {
  findSimilarUsers,
  getUserBasedRecommendations,
  getItemBasedRecommendations,
  getHybridRecommendations,
  invalidateUserCFCache,
};
