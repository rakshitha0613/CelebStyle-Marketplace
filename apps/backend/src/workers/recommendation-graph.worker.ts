/**
 * RecommendationGraphWorker — builds and caches recommendation graph edges.
 *
 * Modes:
 *   userId    → build full user graph (u2u + u2p) and cache cold-start if needed
 *   productId → build p2p edges for this product
 *   (neither) → batch sweep: recently-active users + products
 *
 * BullMQ-ready: data shape matches BullMQ job.data.
 */

import { prisma } from "../lib/prisma.js";
import {
  buildUserGraph,
  getProductToProductEdges,
  getColdStartForUser,
} from "../services/recommendation-graph.service.js";
import { invalidateUserCFCache } from "../services/collaborative-filtering.service.js";

export interface RecommendationGraphWorkerData {
  userId?:     string;
  productId?:  string;
  lookbackMs?: number;
}

export interface RecommendationGraphResult {
  usersProcessed:    number;
  productsProcessed: number;
  coldStartBuildCount: number;
  errors:            number;
}

export const recommendationGraphWorker = {
  name: "recommendation-graph",

  async run(data?: RecommendationGraphWorkerData): Promise<RecommendationGraphResult> {
    let usersProcessed    = 0;
    let productsProcessed = 0;
    let coldStartBuildCount = 0;
    let errors            = 0;

    // ── Single-entity modes ───────────────────────────────────────────────────

    if (data?.userId) {
      try {
        const graph = await buildUserGraph(data.userId, 20);
        usersProcessed++;
        if (graph.coldStart) coldStartBuildCount++;
      } catch (err) {
        console.error(`[RecommendationGraphWorker] user ${data.userId}:`, (err as Error).message);
        errors++;
      }
      return { usersProcessed, productsProcessed, coldStartBuildCount, errors };
    }

    if (data?.productId) {
      try {
        await getProductToProductEdges(data.productId, 10);
        productsProcessed++;
      } catch (err) {
        console.error(`[RecommendationGraphWorker] product ${data.productId}:`, (err as Error).message);
        errors++;
      }
      return { usersProcessed, productsProcessed, coldStartBuildCount, errors };
    }

    // ── Batch sweep mode ──────────────────────────────────────────────────────

    const lookbackMs = data?.lookbackMs ?? 24 * 60 * 60_000;
    const since      = new Date(Date.now() - lookbackMs);

    // Pre-warm global cold-start cache (shared across new users)
    try {
      await getColdStartForUser(20);
      coldStartBuildCount++;
    } catch (err) {
      console.error("[RecommendationGraphWorker] cold-start pre-warm:", (err as Error).message);
      errors++;
    }

    // Recently-active users
    const activeUserRows = await prisma.analyticsEvent.findMany({
      where:    { userId: { not: null }, createdAt: { gte: since } },
      select:   { userId: true },
      distinct: ["userId"],
      take:     150,
    });

    for (const { userId } of activeUserRows) {
      if (!userId) continue;
      try {
        // Invalidate stale CF cache before rebuilding graph
        invalidateUserCFCache(userId);
        const graph = await buildUserGraph(userId, 20);
        usersProcessed++;
        if (graph.coldStart) coldStartBuildCount++;
      } catch (err) {
        console.error(`[RecommendationGraphWorker] user ${userId}:`, (err as Error).message);
        errors++;
      }
    }

    // Recently-active products
    const activeProductRows = await prisma.analyticsEvent.findMany({
      where:    { productId: { not: null }, createdAt: { gte: since } },
      select:   { productId: true },
      distinct: ["productId"],
      take:     150,
    });

    for (const { productId } of activeProductRows) {
      if (!productId) continue;
      try {
        await getProductToProductEdges(productId, 10);
        productsProcessed++;
      } catch (err) {
        console.error(`[RecommendationGraphWorker] product ${productId}:`, (err as Error).message);
        errors++;
      }
    }

    return { usersProcessed, productsProcessed, coldStartBuildCount, errors };
  },
};
