/**
 * recommendation-analytics.service — high-level analytics dashboards over the
 * recommendation feedback data.
 *
 * All heavy lifting is delegated to metrics.service (DB queries).
 * Results are not cached here; callers cache at the HTTP layer if needed.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import {
  computeMetrics,
  getAlgorithmMetrics,
  getExperimentMetrics,
  type RecommendationMetrics,
} from "./metrics.service.js";
import { EXPERIMENTS, type Experiment } from "./experiment.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LowPerformingProduct {
  productId:   string;
  impressions: number;
  dismissRate: number;
  ctr:         number;
}

export interface ExperimentComparison {
  experimentId: string;
  name:         string;
  status:       Experiment["status"];
  byVariant:    Array<{ variant: string; metrics: RecommendationMetrics }>;
}

export interface ColdStartReport {
  coldStartMetrics: RecommendationMetrics;
  warmStartMetrics: RecommendationMetrics;
  ratio:            number;
}

// ── getTopAlgorithms ──────────────────────────────────────────────────────────
// Returns algorithms sorted by CTR (descending).

export async function getTopAlgorithms(
  since?: Date,
): Promise<Array<{ context: string; metrics: RecommendationMetrics }>> {
  return getAlgorithmMetrics(since);
}

// ── getTopSectionTypes ────────────────────────────────────────────────────────
// Sorted by conversion rate (descending).

export async function getTopSectionTypes(
  since?: Date,
): Promise<Array<{ sectionType: string; metrics: RecommendationMetrics }>> {
  const algorithms = await getAlgorithmMetrics(since);
  return algorithms
    .map((a) => ({ sectionType: a.context, metrics: a.metrics }))
    .sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate);
}

// ── getLowPerformingProducts ──────────────────────────────────────────────────
// Products with high dismiss rate and low CTR (worst recommendation fit).

export async function getLowPerformingProducts(
  minImpressions = 10,
  since?: Date,
): Promise<LowPerformingProduct[]> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

  const rows = await prisma.recommendationFeedback.groupBy({
    by:     ["productId", "feedbackType"],
    where:  { createdAt: { gte: sinceDate } },
    _count: { feedbackType: true },
  });

  const byProduct = new Map<string, { impression: number; click: number; dismiss: number }>();
  for (const row of rows) {
    if (!byProduct.has(row.productId)) {
      byProduct.set(row.productId, { impression: 0, click: 0, dismiss: 0 });
    }
    const p = byProduct.get(row.productId)!;
    if (row.feedbackType === "IMPRESSION") p.impression += row._count.feedbackType;
    if (row.feedbackType === "CLICK")      p.click      += row._count.feedbackType;
    if (row.feedbackType === "DISMISS")    p.dismiss    += row._count.feedbackType;
  }

  const results: LowPerformingProduct[] = [];
  for (const [productId, counts] of byProduct) {
    if (counts.impression < minImpressions) continue;
    const ctr         = counts.impression > 0 ? counts.click   / counts.impression : 0;
    const dismissRate = counts.impression > 0 ? counts.dismiss / counts.impression : 0;
    results.push({ productId, impressions: counts.impression, dismissRate, ctr });
  }

  // Sort: high dismiss + low CTR = worst performing first
  return results
    .sort((a, b) => (b.dismissRate - b.ctr) - (a.dismissRate - a.ctr))
    .slice(0, 20);
}

// ── getColdStartEffectiveness ─────────────────────────────────────────────────
// Compares anonymous (cold) vs authenticated (warm) impression CTR.

export async function getColdStartEffectiveness(since?: Date): Promise<ColdStartReport> {
  const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

  const [coldRows, warmRows] = await Promise.all([
    prisma.recommendationFeedback.groupBy({
      by:     ["feedbackType"],
      where:  { userId: null, createdAt: { gte: sinceDate } },
      _count: { feedbackType: true },
    }),
    prisma.recommendationFeedback.groupBy({
      by:     ["feedbackType"],
      where:  { userId: { not: null }, createdAt: { gte: sinceDate } },
      _count: { feedbackType: true },
    }),
  ]);

  function rowsToMetrics(
    rows: Array<{ feedbackType: string; _count: { feedbackType: number } }>,
  ): RecommendationMetrics {
    const t = new Map<string, number>(rows.map((r) => [r.feedbackType, r._count.feedbackType]));
    const imp  = t.get("IMPRESSION")  ?? 0;
    const clk  = t.get("CLICK")       ?? 0;
    const dis  = t.get("DISMISS")     ?? 0;
    const wsh  = t.get("WISHLIST")    ?? 0;
    const atc  = t.get("ADD_TO_CART") ?? 0;
    const pur  = t.get("PURCHASE")    ?? 0;
    const conv = t.get("CONVERSION")  ?? 0;
    const safe = (a: number, b: number) => b === 0 ? 0 : a / b;
    return {
      impressions:          imp,
      clicks:               clk,
      dismissals:           dis,
      wishlists:            wsh,
      addToCarts:           atc,
      purchases:            pur,
      conversions:          conv,
      totalRevenue:         0,
      ctr:                  safe(clk,           imp),
      conversionRate:       safe(conv,           imp),
      purchaseRate:         safe(pur,            imp),
      wishlistRate:         safe(wsh,            imp),
      cartRate:             safe(atc,            imp),
      acceptanceRate:       safe(clk + wsh + atc, imp),
      revenuePerImpression: 0,
      revenuePerClick:      0,
    };
  }

  const coldStartMetrics = rowsToMetrics(coldRows);
  const warmStartMetrics = rowsToMetrics(warmRows);
  const ratio = warmStartMetrics.ctr > 0 ? coldStartMetrics.ctr / warmStartMetrics.ctr : 0;

  return { coldStartMetrics, warmStartMetrics, ratio };
}

// ── getExperimentComparison ───────────────────────────────────────────────────

export async function getExperimentComparison(experimentId: string): Promise<ExperimentComparison | null> {
  const exp = EXPERIMENTS[experimentId];
  if (!exp) return null;

  const metrics = await getExperimentMetrics(experimentId);
  return {
    experimentId: exp.id,
    name:         exp.name,
    status:       exp.status,
    byVariant:    metrics.byVariant,
  };
}

// ── getExperimentComparisons ──────────────────────────────────────────────────

export async function getExperimentComparisons(): Promise<ExperimentComparison[]> {
  return Promise.all(
    Object.values(EXPERIMENTS).map(async (exp) => {
      const metrics = await getExperimentMetrics(exp.id);
      return {
        experimentId: exp.id,
        name:         exp.name,
        status:       exp.status,
        byVariant:    metrics.byVariant,
      };
    })
  );
}

// ── getDashboard ──────────────────────────────────────────────────────────────
// Convenience wrapper: all dashboard panels in one call.

export async function getDashboard(since?: Date): Promise<{
  overall:      RecommendationMetrics;
  algorithms:   Array<{ context: string; metrics: RecommendationMetrics }>;
  lowPerforming: LowPerformingProduct[];
  coldStart:    ColdStartReport;
}> {
  const [overall, algorithms, lowPerforming, coldStart] = await Promise.all([
    computeMetrics({ since }),
    getTopAlgorithms(since),
    getLowPerformingProducts(10, since),
    getColdStartEffectiveness(since),
  ]);
  return { overall, algorithms, lowPerforming, coldStart };
}
