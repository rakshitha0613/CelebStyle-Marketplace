/**
 * RankingRefreshWorker — rebuilds cached ranked recommendation lists.
 *
 * Modes:
 *   userId    → recompute and cache rankings for a single user
 *   (neither) → batch sweep of recently-active users
 *
 * BullMQ-ready: data shape matches BullMQ job.data.
 */

import { prisma } from "../lib/prisma.js";
import { rankForUser, invalidateRankingCache } from "../services/ranking.service.js";

export interface RankingRefreshWorkerData {
  userId?:     string;
  lookbackMs?: number;
}

export interface RankingRefreshResult {
  usersRefreshed: number;
  errors:         number;
}

export const rankingRefreshWorker = {
  name: "ranking-refresh",

  async run(data?: RankingRefreshWorkerData): Promise<RankingRefreshResult> {
    let usersRefreshed = 0;
    let errors         = 0;

    // ── Single-user mode ──────────────────────────────────────────────────────
    if (data?.userId) {
      try {
        invalidateRankingCache(data.userId);
        await rankForUser(data.userId, { limit: 20 });
        usersRefreshed++;
      } catch (err) {
        console.error(`[RankingRefreshWorker] user ${data.userId}:`, (err as Error).message);
        errors++;
      }
      return { usersRefreshed, errors };
    }

    // ── Batch sweep mode ──────────────────────────────────────────────────────
    const lookbackMs = data?.lookbackMs ?? 24 * 60 * 60_000;
    const since      = new Date(Date.now() - lookbackMs);

    const activeUserRows = await prisma.analyticsEvent.findMany({
      where:    { userId: { not: null }, createdAt: { gte: since } },
      select:   { userId: true },
      distinct: ["userId"],
      take:     200,
    });

    for (const { userId } of activeUserRows) {
      if (!userId) continue;
      try {
        invalidateRankingCache(userId);
        await rankForUser(userId, { limit: 20 });
        usersRefreshed++;
      } catch (err) {
        console.error(`[RankingRefreshWorker] user ${userId}:`, (err as Error).message);
        errors++;
      }
    }

    return { usersRefreshed, errors };
  },
};
