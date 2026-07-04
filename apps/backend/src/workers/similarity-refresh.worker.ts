/**
 * SimilarityRefreshWorker — refreshes cached similarity matrices.
 *
 * Modes:
 *   userId    → refresh user's similar users and interaction set
 *   productId → refresh product's embedding similarity neighbors
 *   (neither) → batch sweep of recently-active users and products
 *
 * BullMQ-ready: data shape matches BullMQ job.data.
 */

import { prisma } from "../lib/prisma.js";
import {
  findSimilarUsers,
  invalidateUserCFCache,
} from "../services/collaborative-filtering.service.js";
import {
  invalidateProductSimilarityCache,
  invalidateUserInteractionCache,
} from "../services/similarity.service.js";
import { findSimilarToProduct } from "../lib/vector.db.js";
import { productSimilarityMatrix } from "../services/similarity.service.js";

export interface SimilarityRefreshWorkerData {
  userId?:     string;
  productId?:  string;
  lookbackMs?: number;
}

export interface SimilarityRefreshResult {
  usersRefreshed:    number;
  productsRefreshed: number;
  errors:            number;
}

export const similarityRefreshWorker = {
  name: "similarity-refresh",

  async run(data?: SimilarityRefreshWorkerData): Promise<SimilarityRefreshResult> {
    let usersRefreshed    = 0;
    let productsRefreshed = 0;
    let errors            = 0;

    // ── Single-entity modes ───────────────────────────────────────────────────

    if (data?.userId) {
      try {
        invalidateUserCFCache(data.userId);
        await findSimilarUsers(data.userId, 10); // recompute and cache
        usersRefreshed++;
      } catch (err) {
        console.error(`[SimilarityRefreshWorker] user ${data.userId}:`, (err as Error).message);
        errors++;
      }
      return { usersRefreshed, productsRefreshed, errors };
    }

    if (data?.productId) {
      try {
        invalidateProductSimilarityCache(data.productId);
        const neighbors = await findSimilarToProduct(data.productId, 20);
        productSimilarityMatrix.setNeighbors(
          data.productId,
          neighbors.map(({ productId, similarity }) => ({ id: productId, score: similarity }))
        );
        productsRefreshed++;
      } catch (err) {
        console.error(`[SimilarityRefreshWorker] product ${data.productId}:`, (err as Error).message);
        errors++;
      }
      return { usersRefreshed, productsRefreshed, errors };
    }

    // ── Batch sweep mode ──────────────────────────────────────────────────────

    const lookbackMs = data?.lookbackMs ?? 24 * 60 * 60_000;
    const since      = new Date(Date.now() - lookbackMs);

    // Users with recent events
    const activeUserRows = await prisma.analyticsEvent.findMany({
      where:    { userId: { not: null }, createdAt: { gte: since } },
      select:   { userId: true },
      distinct: ["userId"],
      take:     200,
    });

    for (const { userId } of activeUserRows) {
      if (!userId) continue;
      try {
        invalidateUserInteractionCache(userId);
        await findSimilarUsers(userId, 10);
        usersRefreshed++;
      } catch (err) {
        console.error(`[SimilarityRefreshWorker] user ${userId}:`, (err as Error).message);
        errors++;
      }
    }

    // Products with recent events (refresh their similarity neighbors)
    const activeProductRows = await prisma.analyticsEvent.findMany({
      where:    { productId: { not: null }, createdAt: { gte: since } },
      select:   { productId: true },
      distinct: ["productId"],
      take:     200,
    });

    for (const { productId } of activeProductRows) {
      if (!productId) continue;
      try {
        invalidateProductSimilarityCache(productId);
        const neighbors = await findSimilarToProduct(productId, 20);
        productSimilarityMatrix.setNeighbors(
          productId,
          neighbors.map(({ productId: id, similarity }) => ({ id, score: similarity }))
        );
        productsRefreshed++;
      } catch (err) {
        console.error(`[SimilarityRefreshWorker] product ${productId}:`, (err as Error).message);
        errors++;
      }
    }

    return { usersRefreshed, productsRefreshed, errors };
  },
};
