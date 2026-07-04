/**
 * feature-monitoring.service — takes periodic snapshots of feature distributions.
 *
 * Snapshots compute mean/stddev/percentiles from live DB rows so the drift
 * detector always has a reference baseline to compare against.
 *
 * Supported feature types:
 *   USER_EMBEDDING      — L2-norms of stored user embedding vectors
 *   PRODUCT_EMBEDDING   — L2-norms of stored product embedding vectors
 *   CATEGORY_AFFINITY   — per-user top-category affinity values
 *   BRAND_AFFINITY      — per-user top-brand affinity values
 *   PRICE_AFFINITY      — per-user average price preference
 *   RECOMMENDATION_DIST — distribution of top-1 productIds served (coverage)
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SnapshotStats {
  id:           string;
  featureType:  string;
  snapshotAt:   Date;
  sampleSize:   number;
  mean:         number;
  stddev:       number;
  min:          number;
  max:          number;
  p25:          number;
  p50:          number;
  p75:          number;
  p95:          number;
  distribution: Record<string, number>;
}

// ── Statistical helpers ───────────────────────────────────────────────────────

function computeStats(values: number[]): Omit<SnapshotStats, "id" | "featureType" | "snapshotAt" | "distribution"> {
  if (values.length === 0) {
    return { sampleSize: 0, mean: 0, stddev: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0, p95: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n      = sorted.length;
  const mean   = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const p = (pct: number) => sorted[Math.min(Math.floor(pct * n), n - 1)];

  return {
    sampleSize: n,
    mean,
    stddev: Math.sqrt(variance),
    min:    sorted[0],
    max:    sorted[n - 1],
    p25:    p(0.25),
    p50:    p(0.50),
    p75:    p(0.75),
    p95:    p(0.95),
  };
}

function buildHistogram(values: number[], buckets = 10): Record<string, number> {
  if (values.length === 0) return {};
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const step = max === min ? 1 : (max - min) / buckets;
  const hist: Record<string, number> = {};
  for (let i = 0; i < buckets; i++) {
    const lo  = min + i * step;
    const hi  = lo + step;
    const key = `${lo.toFixed(3)}-${hi.toFixed(3)}`;
    hist[key] = values.filter((v) => v >= lo && (i === buckets - 1 ? v <= hi : v < hi)).length;
  }
  return hist;
}

// ── takeSnapshot ──────────────────────────────────────────────────────────────

export async function takeSnapshot(featureType: string): Promise<SnapshotStats> {
  const values = await extractFeatureValues(featureType);
  const stats  = computeStats(values);
  const dist   = buildHistogram(values);

  const row = await prisma.featureSnapshot.create({
    data: {
      featureType,
      sampleSize:   stats.sampleSize,
      mean:         stats.mean,
      stddev:       stats.stddev,
      min:          stats.min,
      max:          stats.max,
      p25:          stats.p25,
      p50:          stats.p50,
      p75:          stats.p75,
      p95:          stats.p95,
      distribution: dist as any,
    },
  });

  return normalise(row);
}

// ── extractFeatureValues ──────────────────────────────────────────────────────

async function extractFeatureValues(featureType: string): Promise<number[]> {
  switch (featureType) {
    case "CATEGORY_AFFINITY": {
      const rows = await prisma.userFeatureStore.findMany({
        select: { categoryAffinity: true },
        take:   1000,
      });
      return rows.flatMap((r) => Object.values(r.categoryAffinity as Record<string, number>));
    }

    case "BRAND_AFFINITY": {
      const rows = await prisma.userFeatureStore.findMany({
        select: { brandAffinity: true },
        take:   1000,
      });
      return rows.flatMap((r) => Object.values(r.brandAffinity as Record<string, number>));
    }

    case "PRICE_AFFINITY": {
      const rows = await prisma.userFeatureStore.findMany({
        select: { pricePreference: true },
        take:   1000,
      });
      return rows.map((r) => {
        const pref = r.pricePreference as { avg?: number };
        return pref.avg ?? 0;
      });
    }

    case "USER_EMBEDDING": {
      // Use signalCount as the scalar proxy (higher = richer embedding)
      const rows = await prisma.userEmbedding.findMany({
        select: { signalCount: true },
        take:   1000,
      });
      return rows.map((r) => r.signalCount);
    }

    case "PRODUCT_EMBEDDING": {
      // Use tokenCount as the scalar proxy
      const rows = await prisma.productEmbedding.findMany({
        select: { tokenCount: true },
        take:   1000,
      });
      return rows.map((r) => r.tokenCount ?? 0);
    }

    case "RECOMMENDATION_DIST": {
      // Coverage: distinct products recommended per prediction (top-1 position)
      const rows = await prisma.predictionLog.findMany({
        select:  { topN: true },
        orderBy: { createdAt: "desc" },
        take:    500,
      });
      // Return scores of the top-1 recommendation from each log
      return rows.map((r) => {
        const topN = r.topN as Array<{ productId: string; score: number }>;
        return topN[0]?.score ?? 0;
      });
    }

    default:
      return [];
  }
}

// ── getLatestSnapshot ─────────────────────────────────────────────────────────

export async function getLatestSnapshot(featureType: string): Promise<SnapshotStats | null> {
  const row = await prisma.featureSnapshot.findFirst({
    where:   { featureType },
    orderBy: { snapshotAt: "desc" },
  });
  return row ? normalise(row) : null;
}

// ── getSnapshotHistory ────────────────────────────────────────────────────────

export async function getSnapshotHistory(featureType: string, limit = 10): Promise<SnapshotStats[]> {
  const rows = await prisma.featureSnapshot.findMany({
    where:   { featureType },
    orderBy: { snapshotAt: "desc" },
    take:    limit,
  });
  return rows.map(normalise);
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normalise(r: any): SnapshotStats {
  return {
    id:           r.id,
    featureType:  r.featureType,
    snapshotAt:   r.snapshotAt,
    sampleSize:   r.sampleSize,
    mean:         r.mean,
    stddev:       r.stddev,
    min:          r.min,
    max:          r.max,
    p25:          r.p25,
    p50:          r.p50,
    p75:          r.p75,
    p95:          r.p95,
    distribution: (r.distribution as Record<string, number>) ?? {},
  };
}

export const FEATURE_TYPES = [
  "USER_EMBEDDING",
  "PRODUCT_EMBEDDING",
  "CATEGORY_AFFINITY",
  "BRAND_AFFINITY",
  "PRICE_AFFINITY",
  "RECOMMENDATION_DIST",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];
