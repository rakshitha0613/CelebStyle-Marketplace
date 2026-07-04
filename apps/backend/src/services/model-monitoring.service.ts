/**
 * model-monitoring.service — aggregates production monitoring metrics.
 *
 * Sources:
 *   PredictionLog          → latency, cache hit rate, coverage
 *   RecommendationFeedback → CTR, conversion rate, revenue per recommendation
 *   ModelRegistry          → active model info
 *   MLOpsAlert             → unresolved critical alerts
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { getLatencyStats } from "./prediction-logging.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatencyMetrics {
  count:   number;
  avg:     number;
  p50:     number;
  p95:     number;
  p99:     number;
  min:     number;
  max:     number;
}

export interface CoverageMetrics {
  distinctProductsRecommended: number;
  totalActiveProducts:         number;
  coverageRate:                number;
}

export interface ModelHealthReport {
  status:     "HEALTHY" | "DEGRADED" | "CRITICAL";
  latency:    LatencyMetrics;
  cacheHitRate: number;
  ctr:        number;
  conversionRate: number;
  revenuePerRecommendation: number;
  coverage:   CoverageMetrics;
  unresolvedAlerts: number;
  coldStartCtr: number;
  checkedAt:  Date;
}

// ── Percentile helper ─────────────────────────────────────────────────────────

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(pct * sorted.length), sorted.length - 1);
  return sorted[idx];
}

// ── getLatencyMetrics ─────────────────────────────────────────────────────────

export async function getLatencyMetrics(context?: string, since?: Date): Promise<LatencyMetrics> {
  const { values } = await getLatencyStats(context, since);

  if (values.length === 0) {
    return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const avg    = sorted.reduce((s, v) => s + v, 0) / sorted.length;

  return {
    count: sorted.length,
    avg:   parseFloat(avg.toFixed(2)),
    p50:   percentile(sorted, 0.50),
    p95:   percentile(sorted, 0.95),
    p99:   percentile(sorted, 0.99),
    min:   sorted[0],
    max:   sorted[sorted.length - 1],
  };
}

// ── getCacheHitRate ───────────────────────────────────────────────────────────

export async function getCacheHitRate(since?: Date): Promise<number> {
  const where: Record<string, unknown> = {};
  if (since) where["createdAt"] = { gte: since };

  const [total, hits] = await Promise.all([
    prisma.predictionLog.count({ where }),
    prisma.predictionLog.count({ where: { ...where, cacheHit: true } }),
  ]);

  return total === 0 ? 0 : hits / total;
}

// ── getCoverageMetrics ────────────────────────────────────────────────────────

export async function getCoverageMetrics(since?: Date): Promise<CoverageMetrics> {
  const where: Record<string, unknown> = {};
  if (since) where["createdAt"] = { gte: since };

  const [logs, totalProducts] = await Promise.all([
    prisma.predictionLog.findMany({ where, select: { topN: true }, take: 5000 }),
    prisma.product.count({ where: { isPublished: true, deletedAt: null } }),
  ]);

  const seen = new Set<string>();
  for (const log of logs) {
    const items = log.topN as Array<{ productId: string }>;
    for (const item of items) seen.add(item.productId);
  }

  const distinctProductsRecommended = seen.size;
  const coverageRate = totalProducts === 0 ? 0 : distinctProductsRecommended / totalProducts;

  return { distinctProductsRecommended, totalActiveProducts: totalProducts, coverageRate };
}

// ── getCTRFromLogs ────────────────────────────────────────────────────────────

export async function getCTRFromLogs(since?: Date): Promise<number> {
  const where: Record<string, unknown> = {};
  if (since) where["createdAt"] = { gte: since };

  const [total, clicked] = await Promise.all([
    prisma.predictionLog.count({ where }),
    prisma.predictionLog.count({ where: { ...where, outcomeClicked: true } }),
  ]);

  return total === 0 ? 0 : clicked / total;
}

// ── getRevenuePerRecommendation ───────────────────────────────────────────────

export async function getRevenuePerRecommendation(since?: Date): Promise<number> {
  const where: Record<string, unknown> = {};
  if (since) where["createdAt"] = { gte: since };

  const [logCount, revenueAgg] = await Promise.all([
    prisma.predictionLog.count({ where }),
    prisma.recommendationFeedback.aggregate({
      where: {
        feedbackType: { in: ["PURCHASE", "CONVERSION"] },
        revenue:      { not: null },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { revenue: true },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.revenue ?? 0);
  return logCount === 0 ? 0 : revenue / logCount;
}

// ── getColdStartCTR ───────────────────────────────────────────────────────────

export async function getColdStartCTR(since?: Date): Promise<number> {
  const where: Record<string, unknown> = { userId: null };
  if (since) where["createdAt"] = { gte: since };

  const [total, clicked] = await Promise.all([
    prisma.predictionLog.count({ where }),
    prisma.predictionLog.count({ where: { ...where, outcomeClicked: true } }),
  ]);

  return total === 0 ? 0 : clicked / total;
}

// ── getHealthReport ───────────────────────────────────────────────────────────

export async function getHealthReport(since?: Date): Promise<ModelHealthReport> {
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const [
    latency,
    cacheHitRate,
    coverage,
    ctr,
    conversionRate,
    revenue,
    coldStartCtr,
    unresolvedAlerts,
  ] = await Promise.all([
    getLatencyMetrics(undefined, sinceDate),
    getCacheHitRate(sinceDate),
    getCoverageMetrics(sinceDate),
    getCTRFromLogs(sinceDate),
    (async () => {
      const [imp, conv] = await Promise.all([
        prisma.recommendationFeedback.count({
          where: { feedbackType: "IMPRESSION", ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}) },
        }),
        prisma.recommendationFeedback.count({
          where: { feedbackType: "CONVERSION", ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}) },
        }),
      ]);
      return imp === 0 ? 0 : conv / imp;
    })(),
    getRevenuePerRecommendation(sinceDate),
    getColdStartCTR(sinceDate),
    prisma.mLOpsAlert.count({ where: { isResolved: false, severity: "CRITICAL" } }),
  ]);

  // Health status: CRITICAL if unresolved critical alerts or p95 > 500ms
  const status: ModelHealthReport["status"] =
    unresolvedAlerts > 0 || latency.p95 > 500
      ? "CRITICAL"
      : latency.p95 > 200 || ctr < 0.01
      ? "DEGRADED"
      : "HEALTHY";

  return {
    status,
    latency,
    cacheHitRate:              parseFloat(cacheHitRate.toFixed(4)),
    ctr:                       parseFloat(ctr.toFixed(4)),
    conversionRate:            parseFloat(conversionRate.toFixed(4)),
    revenuePerRecommendation:  parseFloat(revenue.toFixed(2)),
    coverage,
    unresolvedAlerts,
    coldStartCtr:              parseFloat(coldStartCtr.toFixed(4)),
    checkedAt:                 new Date(),
  };
}
