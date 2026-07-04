/**
 * TrendingWorker — computes trending scores for all products and
 * upserts them into the TrendingProduct table + cache.
 *
 * BullMQ-ready: the run() method signature matches what a BullMQ
 * processor function receives. Add `import { Worker } from "bullmq"` and
 * wrap run() in `new Worker("trending", run, { connection })` to go async.
 *
 * Scoring formula:
 *   score = w_v7 * views7d + w_p7 * purchases7d + w_wl * wishlist30d
 *   Weights: views=0.35, purchases=0.45, wishlist=0.20
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { randomUUID } from "node:crypto";

export interface TrendingWorkerData {
  window?: "7d" | "30d";
}

export interface TrendingResult {
  processed:  number;
  windowUsed: string;
  topRanked:  Array<{ productId: string; score: number; rank: number }>;
}

const WEIGHTS = { views: 0.35, purchases: 0.45, wishlist: 0.20 };

export const trendingWorker = {
  name: "trending",

  async run(data?: TrendingWorkerData): Promise<TrendingResult> {
    const window = data?.window ?? "7d";
    const now    = Date.now();
    const d7     = new Date(now - 7  * 86_400_000);
    const d30    = new Date(now - 30 * 86_400_000);
    const since  = window === "7d" ? d7 : d30;

    // Aggregate views per product in the window
    const viewRows = await prisma.analyticsEvent.groupBy({
      by:    ["productId"],
      where: {
        type:      "PRODUCT_VIEW",
        createdAt: { gte: since },
        productId: { not: null },
      },
      _count: { productId: true },
    });

    // Aggregate purchases (OrderItem counts) in the window
    const purchaseRows = await prisma.orderItem.groupBy({
      by:    ["productId"],
      where: { order: { createdAt: { gte: since } } },
      _count: { productId: true },
    });

    // Aggregate wishlists in the window
    const wishlistRows = await prisma.analyticsEvent.groupBy({
      by:    ["productId"],
      where: {
        type:      "ADD_TO_WISHLIST",
        createdAt: { gte: d30 },
        productId: { not: null },
      },
      _count: { productId: true },
    });

    // Build score map
    const scoreMap = new Map<string, number>();

    for (const row of viewRows) {
      if (!row.productId) continue;
      scoreMap.set(row.productId, (scoreMap.get(row.productId) ?? 0) + row._count.productId * WEIGHTS.views);
    }
    for (const row of purchaseRows) {
      scoreMap.set(row.productId, (scoreMap.get(row.productId) ?? 0) + row._count.productId * WEIGHTS.purchases);
    }
    for (const row of wishlistRows) {
      if (!row.productId) continue;
      scoreMap.set(row.productId, (scoreMap.get(row.productId) ?? 0) + row._count.productId * WEIGHTS.wishlist);
    }

    // Sort and rank
    const ranked = [...scoreMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([productId, score], i) => ({ productId, score, rank: i + 1 }));

    // Upsert TrendingProduct rows (individual statements — PgBouncer-safe)
    for (const { productId, score, rank } of ranked) {
      await prisma.trendingProduct.upsert({
        where:  { productId },
        update: { score, rank, window, updatedAt: new Date() },
        create: { id: randomUUID(), productId, score, rank, window },
      });
    }

    // Remove stale entries (products no longer trending)
    const activePids = new Set(ranked.map((r) => r.productId));
    const stale = await prisma.trendingProduct.findMany({
      where: { productId: { notIn: [...activePids] } },
      select: { productId: true },
    });
    if (stale.length > 0) {
      await prisma.trendingProduct.deleteMany({
        where: { productId: { in: stale.map((s) => s.productId) } },
      });
    }

    const topRanked = ranked.slice(0, 20);
    cacheService.setTrending(window, topRanked);

    return { processed: ranked.length, windowUsed: window, topRanked };
  },
};
