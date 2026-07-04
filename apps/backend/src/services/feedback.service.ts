/**
 * feedback.service — records recommendation feedback events and manages
 * user-level negative signals for the ranking pipeline.
 *
 * Dedup: DISMISS/HIDE/SKIP events are idempotent within a 1-hour TTL.
 * Negative signals (DISMISS/HIDE) are stored as a cache set so ranking.service
 * can apply an additional penalty without a DB round-trip.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { invalidateUserRecommendationsCache, invalidateProductRecommendationsCache } from "./recommendation.service.js";
import { invalidateRankingCache } from "./ranking.service.js";
import type { RecommendationFeedbackType } from "@prisma/client";

const DEDUP_TTL_MS     = 60 * 60 * 1_000;       // 1 hour — dedup window for negative events
const NEG_SIGNAL_TTL   = 7 * 24 * 60 * 60 * 1_000; // 7 days — user-level negative signals

// ── Cache key helpers ─────────────────────────────────────────────────────────

function dedupKey(userId: string | undefined, sessionId: string | undefined, productId: string, feedbackType: string): string {
  return `feedback:dedup:${userId ?? sessionId ?? "anon"}:${productId}:${feedbackType}`;
}

export function negSignalKey(userId: string): string {
  return `feedback:neg:${userId}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeedbackPayload {
  userId?:      string;
  sessionId?:   string;
  productId:    string;
  feedbackType: RecommendationFeedbackType;
  context?:     string;
  position?:    number;
  experimentId?: string;
  variant?:     string;
  revenue?:     number;
  metadata?:    Record<string, unknown>;
}

export interface FeedbackResult {
  id:          string;
  isDuplicate: boolean;
}

// ── recordFeedback ────────────────────────────────────────────────────────────

export async function recordFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  // Dedup check for idempotent negative events
  if (["DISMISS", "HIDE", "SKIP"].includes(payload.feedbackType)) {
    const key = dedupKey(payload.userId, payload.sessionId, payload.productId, payload.feedbackType);
    if (cacheService.has(key)) {
      return { id: "dedup", isDuplicate: true };
    }
    cacheService.set(key, true, DEDUP_TTL_MS);
  }

  const record = await prisma.recommendationFeedback.create({
    data: {
      userId:       payload.userId       ?? null,
      sessionId:    payload.sessionId    ?? null,
      productId:    payload.productId,
      feedbackType: payload.feedbackType,
      context:      payload.context      ?? null,
      position:     payload.position     ?? null,
      experimentId: payload.experimentId ?? null,
      variant:      payload.variant      ?? null,
      revenue:      payload.revenue != null ? payload.revenue : null,
      metadata:     (payload.metadata ?? undefined) as any,
    },
  });

  // Accumulate negative signals into a user-scoped set for the ranking pipeline
  if (payload.userId && ["DISMISS", "HIDE"].includes(payload.feedbackType)) {
    const key      = negSignalKey(payload.userId);
    const existing = cacheService.get<string[]>(key) ?? [];
    if (!existing.includes(payload.productId)) {
      cacheService.set(key, [...existing, payload.productId], NEG_SIGNAL_TTL);
    }
  }

  // Invalidate personalized caches on high-signal positive events
  if (payload.userId && ["PURCHASE", "CONVERSION", "ADD_TO_CART", "WISHLIST"].includes(payload.feedbackType)) {
    invalidateUserRecommendationsCache(payload.userId);
    invalidateRankingCache(payload.userId);
  }

  // Invalidate product-level cache when conversion happens
  if (["PURCHASE", "CONVERSION"].includes(payload.feedbackType)) {
    invalidateProductRecommendationsCache(payload.productId);
  }

  return { id: record.id, isDuplicate: false };
}

// ── recordImpression ──────────────────────────────────────────────────────────

export async function recordImpression(payload: {
  userId?:      string;
  sessionId?:   string;
  productId:    string;
  context?:     string;
  position?:    number;
  experimentId?: string;
  variant?:     string;
}): Promise<string> {
  // Create impression record
  const impression = await prisma.recommendationImpression.create({
    data: {
      userId:       payload.userId       ?? null,
      sessionId:    payload.sessionId    ?? null,
      productId:    payload.productId,
      context:      payload.context      ?? "UNKNOWN",
      position:     payload.position     ?? 0,
      experimentId: payload.experimentId ?? null,
      variant:      payload.variant      ?? null,
      wasClicked:   false,
    },
  });

  // Mirror to unified feedback table for metrics computation
  await prisma.recommendationFeedback.create({
    data: {
      userId:       payload.userId       ?? null,
      sessionId:    payload.sessionId    ?? null,
      productId:    payload.productId,
      feedbackType: "IMPRESSION",
      context:      payload.context      ?? null,
      position:     payload.position     ?? null,
      experimentId: payload.experimentId ?? null,
      variant:      payload.variant      ?? null,
    },
  });

  return impression.id;
}

// ── markImpressionClicked ─────────────────────────────────────────────────────

export async function markImpressionClicked(
  impressionId: string,
  dwellTimeMs?: number,
): Promise<boolean> {
  const result = await prisma.recommendationImpression.updateMany({
    where: { id: impressionId, wasClicked: false },
    data:  { wasClicked: true, dwellTimeMs: dwellTimeMs ?? null },
  });
  return result.count > 0;
}

// ── getNegativeSignals ────────────────────────────────────────────────────────
// Used by ranking.service to apply DISMISS/HIDE penalties without a DB call.

export function getNegativeSignals(userId: string): Set<string> {
  const ids = cacheService.get<string[]>(negSignalKey(userId)) ?? [];
  return new Set(ids);
}
