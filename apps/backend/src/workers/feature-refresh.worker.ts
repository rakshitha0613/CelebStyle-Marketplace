/**
 * FeatureRefreshWorker — sweeps users and products with recent activity
 * and refreshes their feature store entries.
 *
 * Designed to run periodically (e.g., every 15 minutes via BullMQ scheduler).
 *
 * BullMQ-ready: data shape matches BullMQ job.data.
 *   - userId / productId → refresh a single entity
 *   - (no data) → batch sweep of all recently active entities
 */

import { prisma } from "../lib/prisma.js";
import { refreshUserFeatures, refreshProductFeatures } from "../services/feature.service.js";

export interface FeatureRefreshWorkerData {
  userId?:    string;
  productId?: string;
  lookbackMs?: number;
}

export interface FeatureRefreshResult {
  usersRefreshed:    number;
  productsRefreshed: number;
  errors:            number;
}

export const featureRefreshWorker = {
  name: "feature-refresh",

  async run(data?: FeatureRefreshWorkerData): Promise<FeatureRefreshResult> {
    let usersRefreshed    = 0;
    let productsRefreshed = 0;
    let errors            = 0;

    // ── Single-entity mode ────────────────────────────────────────────────────

    if (data?.userId) {
      try {
        await refreshUserFeatures(data.userId);
        usersRefreshed++;
      } catch (err) {
        console.error(`[FeatureRefreshWorker] user ${data.userId}:`, (err as Error).message);
        errors++;
      }
      return { usersRefreshed, productsRefreshed, errors };
    }

    if (data?.productId) {
      try {
        await refreshProductFeatures(data.productId);
        productsRefreshed++;
      } catch (err) {
        console.error(`[FeatureRefreshWorker] product ${data.productId}:`, (err as Error).message);
        errors++;
      }
      return { usersRefreshed, productsRefreshed, errors };
    }

    // ── Batch sweep mode ──────────────────────────────────────────────────────

    const lookbackMs = data?.lookbackMs ?? 24 * 60 * 60_000;
    const since      = new Date(Date.now() - lookbackMs);

    // Users with events in the lookback window
    const activeUserEvents = await prisma.analyticsEvent.findMany({
      where:   { userId: { not: null }, createdAt: { gte: since } },
      select:  { userId: true },
      distinct: ["userId"],
      take:    500,
    });

    const activeUserIds = [...new Set(activeUserEvents.map((e) => e.userId as string))];

    for (const userId of activeUserIds) {
      try {
        await refreshUserFeatures(userId);
        usersRefreshed++;
      } catch (err) {
        console.error(`[FeatureRefreshWorker] user ${userId}:`, (err as Error).message);
        errors++;
      }
    }

    // Products with events in the lookback window
    const activeProductEvents = await prisma.analyticsEvent.findMany({
      where:   { productId: { not: null }, createdAt: { gte: since } },
      select:  { productId: true },
      distinct: ["productId"],
      take:    500,
    });

    const activeProductIds = [...new Set(activeProductEvents.map((e) => e.productId as string))];

    for (const productId of activeProductIds) {
      try {
        await refreshProductFeatures(productId);
        productsRefreshed++;
      } catch (err) {
        console.error(`[FeatureRefreshWorker] product ${productId}:`, (err as Error).message);
        errors++;
      }
    }

    return { usersRefreshed, productsRefreshed, errors };
  },
};
