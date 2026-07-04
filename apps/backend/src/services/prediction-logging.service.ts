/**
 * prediction-logging.service — append-only log of model predictions.
 *
 * Each log row captures: model version, context, top-N recommendations,
 * latency, cache hit status, experiment assignment, and eventual outcomes.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PredictionEntry {
  productId: string;
  score:     number;
}

export interface LogPredictionInput {
  modelId:      string;
  requestId?:   string;
  userId?:      string;
  sessionId?:   string;
  context:      string;
  topN:         PredictionEntry[];
  latencyMs:    number;
  cacheHit?:    boolean;
  experimentId?: string;
  variant?:     string;
}

export interface PredictionLogRecord {
  id:               string;
  modelId:          string;
  requestId:        string | null;
  userId:           string | null;
  sessionId:        string | null;
  context:          string;
  topN:             PredictionEntry[];
  latencyMs:        number;
  cacheHit:         boolean;
  experimentId:     string | null;
  variant:          string | null;
  outcomeClicked:   boolean | null;
  outcomePurchased: boolean | null;
  feedbackId:       string | null;
  createdAt:        Date;
}

export interface PredictionLogFilter {
  modelId?:     string;
  context?:     string;
  userId?:      string;
  since?:       Date;
  until?:       Date;
  limit?:       number;
}

// ── logPrediction ─────────────────────────────────────────────────────────────

export async function logPrediction(input: LogPredictionInput): Promise<string> {
  const row = await prisma.predictionLog.create({
    data: {
      modelId:      input.modelId,
      requestId:    input.requestId    ?? null,
      userId:       input.userId       ?? null,
      sessionId:    input.sessionId    ?? null,
      context:      input.context,
      topN:         input.topN as any,
      latencyMs:    input.latencyMs,
      cacheHit:     input.cacheHit     ?? false,
      experimentId: input.experimentId ?? null,
      variant:      input.variant      ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

// ── linkOutcome ───────────────────────────────────────────────────────────────
// Called when feedback is received; links it back to the prediction log row.

export async function linkOutcome(
  logId:           string,
  outcome: {
    clicked?:    boolean;
    purchased?:  boolean;
    feedbackId?: string;
  },
): Promise<boolean> {
  const result = await prisma.predictionLog.updateMany({
    where: { id: logId },
    data: {
      outcomeClicked:   outcome.clicked   ?? undefined,
      outcomePurchased: outcome.purchased ?? undefined,
      feedbackId:       outcome.feedbackId ?? undefined,
    },
  });
  return result.count > 0;
}

// ── linkOutcomeByRequestId ────────────────────────────────────────────────────

export async function linkOutcomeByRequestId(
  requestId: string,
  outcome: { clicked?: boolean; purchased?: boolean; feedbackId?: string },
): Promise<number> {
  const result = await prisma.predictionLog.updateMany({
    where: { requestId },
    data: {
      outcomeClicked:   outcome.clicked   ?? undefined,
      outcomePurchased: outcome.purchased ?? undefined,
      feedbackId:       outcome.feedbackId ?? undefined,
    },
  });
  return result.count;
}

// ── getPredictionLogs ─────────────────────────────────────────────────────────

export async function getPredictionLogs(filter: PredictionLogFilter = {}): Promise<PredictionLogRecord[]> {
  const where: Record<string, unknown> = {};
  if (filter.modelId) where["modelId"] = filter.modelId;
  if (filter.context) where["context"] = filter.context;
  if (filter.userId)  where["userId"]  = filter.userId;
  if (filter.since || filter.until) {
    where["createdAt"] = {
      ...(filter.since ? { gte: filter.since } : {}),
      ...(filter.until ? { lte: filter.until } : {}),
    };
  }

  const rows = await prisma.predictionLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    filter.limit ?? 100,
  });

  return rows.map((r) => ({
    id:               r.id,
    modelId:          r.modelId,
    requestId:        r.requestId,
    userId:           r.userId,
    sessionId:        r.sessionId,
    context:          r.context,
    topN:             (r.topN as unknown as PredictionEntry[]),
    latencyMs:        r.latencyMs,
    cacheHit:         r.cacheHit,
    experimentId:     r.experimentId,
    variant:          r.variant,
    outcomeClicked:   r.outcomeClicked,
    outcomePurchased: r.outcomePurchased,
    feedbackId:       r.feedbackId,
    createdAt:        r.createdAt,
  }));
}

// ── getLatencyStats ───────────────────────────────────────────────────────────
// Returns sorted latency values for p50/p95/p99 computation.

export async function getLatencyStats(
  context?: string,
  since?:   Date,
): Promise<{ values: number[]; count: number }> {
  const where: Record<string, unknown> = {};
  if (context) where["context"]   = context;
  if (since)   where["createdAt"] = { gte: since };

  const rows = await prisma.predictionLog.findMany({
    where,
    select:  { latencyMs: true },
    orderBy: { latencyMs: "asc" },
  });

  const values = rows.map((r) => r.latencyMs);
  return { values, count: values.length };
}
