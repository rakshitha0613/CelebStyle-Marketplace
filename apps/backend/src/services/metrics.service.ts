/**
 * metrics.service — computes recommendation performance metrics from the
 * RecommendationFeedback table.
 *
 * All metrics are derived from groupBy queries; no heavy aggregation in app code.
 * Revenue figures come from PURCHASE/CONVERSION rows that have a revenue value.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecommendationMetrics {
  impressions:          number;
  clicks:               number;
  dismissals:           number;
  wishlists:            number;
  addToCarts:           number;
  purchases:            number;
  conversions:          number;
  ctr:                  number;   // clicks / impressions
  conversionRate:       number;   // conversions / impressions
  purchaseRate:         number;   // purchases / impressions
  wishlistRate:         number;   // wishlists / impressions
  cartRate:             number;   // addToCarts / impressions
  acceptanceRate:       number;   // (clicks + wishlists + addToCarts) / impressions
  revenuePerImpression: number;   // totalRevenue / impressions
  revenuePerClick:      number;   // totalRevenue / clicks
  totalRevenue:         number;
}

export interface MetricsFilter {
  context?:      string;
  experimentId?: string;
  variant?:      string;
  since?:        Date;
  until?:        Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function buildWhere(filter: MetricsFilter): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filter.context      != null) where["context"]      = filter.context;
  if (filter.experimentId != null) where["experimentId"] = filter.experimentId;
  if (filter.variant      != null) where["variant"]      = filter.variant;
  if (filter.since || filter.until) {
    where["createdAt"] = {
      ...(filter.since ? { gte: filter.since } : {}),
      ...(filter.until ? { lte: filter.until } : {}),
    };
  }
  return where;
}

// ── computeMetrics ────────────────────────────────────────────────────────────

export async function computeMetrics(filter: MetricsFilter = {}): Promise<RecommendationMetrics> {
  const where = buildWhere(filter);

  const [countRows, revenueAgg] = await Promise.all([
    prisma.recommendationFeedback.groupBy({
      by:     ["feedbackType"],
      where,
      _count: { feedbackType: true },
    }),
    prisma.recommendationFeedback.aggregate({
      where: {
        ...where,
        feedbackType: { in: ["PURCHASE", "CONVERSION"] },
        revenue:      { not: null },
      },
      _sum: { revenue: true },
    }),
  ]);

  const tally = new Map<string, number>();
  for (const row of countRows) {
    tally.set(row.feedbackType, row._count.feedbackType);
  }

  const impressions = tally.get("IMPRESSION")  ?? 0;
  const clicks      = tally.get("CLICK")       ?? 0;
  const dismissals  = tally.get("DISMISS")     ?? 0;
  const wishlists   = tally.get("WISHLIST")    ?? 0;
  const addToCarts  = tally.get("ADD_TO_CART") ?? 0;
  const purchases   = tally.get("PURCHASE")    ?? 0;
  const conversions = tally.get("CONVERSION")  ?? 0;
  const totalRevenue = Number(revenueAgg._sum.revenue ?? 0);

  return {
    impressions,
    clicks,
    dismissals,
    wishlists,
    addToCarts,
    purchases,
    conversions,
    ctr:                  safe(clicks,                          impressions),
    conversionRate:       safe(conversions,                     impressions),
    purchaseRate:         safe(purchases,                       impressions),
    wishlistRate:         safe(wishlists,                       impressions),
    cartRate:             safe(addToCarts,                      impressions),
    acceptanceRate:       safe(clicks + wishlists + addToCarts, impressions),
    revenuePerImpression: safe(totalRevenue,                    impressions),
    revenuePerClick:      safe(totalRevenue,                    clicks),
    totalRevenue,
  };
}

// ── getAlgorithmMetrics ───────────────────────────────────────────────────────

export async function getAlgorithmMetrics(
  since?: Date,
): Promise<Array<{ context: string; metrics: RecommendationMetrics }>> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

  const rows = await prisma.recommendationFeedback.findMany({
    where:    { context: { not: null }, createdAt: { gte: sinceDate } },
    distinct: ["context"],
    select:   { context: true },
  });

  const results = await Promise.all(
    rows
      .filter((r): r is { context: string } => r.context != null)
      .map(async ({ context }) => ({
        context,
        metrics: await computeMetrics({ context, since: sinceDate }),
      }))
  );

  return results.sort((a, b) => b.metrics.ctr - a.metrics.ctr);
}

// ── getExperimentMetrics ──────────────────────────────────────────────────────

export async function getExperimentMetrics(experimentId: string): Promise<{
  experimentId: string;
  byVariant:    Array<{ variant: string; metrics: RecommendationMetrics }>;
}> {
  const rows = await prisma.recommendationFeedback.findMany({
    where:    { experimentId },
    distinct: ["variant"],
    select:   { variant: true },
  });

  const byVariant = await Promise.all(
    rows
      .filter((r): r is { variant: string } => r.variant != null)
      .map(async ({ variant }) => ({
        variant,
        metrics: await computeMetrics({ experimentId, variant }),
      }))
  );

  return { experimentId, byVariant };
}
