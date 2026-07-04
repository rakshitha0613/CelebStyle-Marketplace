/**
 * drift-detection.service — detects distribution shift in model features.
 *
 * Uses Population Stability Index (PSI):
 *   PSI = Σ (actual% - expected%) × ln(actual% / expected%)
 *
 * Thresholds:
 *   PSI < 0.1   — no significant drift (STABLE)
 *   PSI 0.1-0.25 — moderate drift (WARNING)
 *   PSI > 0.25  — significant drift (CRITICAL) → creates MLOpsAlert
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { getLatestSnapshot, getSnapshotHistory, takeSnapshot, FEATURE_TYPES } from "./feature-monitoring.service.js";
import type { SnapshotStats } from "./feature-monitoring.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriftResult {
  featureType: string;
  psi:         number;
  status:      "STABLE" | "WARNING" | "CRITICAL";
  baseline:    SnapshotStats | null;
  current:     SnapshotStats | null;
  alertCreated: boolean;
}

export interface DriftReport {
  checkedAt: Date;
  results:   DriftResult[];
  hasIssues: boolean;
}

// ── PSI computation ───────────────────────────────────────────────────────────

function computePSI(
  baseline: Record<string, number>,
  current:  Record<string, number>,
): number {
  // Merge all bucket keys
  const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  const baseTotal = Object.values(baseline).reduce((s, v) => s + v, 0) || 1;
  const currTotal = Object.values(current).reduce((s, v) => s + v, 0)  || 1;

  let psi = 0;
  for (const key of allKeys) {
    const exp = Math.max((baseline[key] ?? 0) / baseTotal, 1e-9);  // expected %
    const act = Math.max((current[key]  ?? 0) / currTotal, 1e-9);  // actual %
    psi += (act - exp) * Math.log(act / exp);
  }
  return Math.abs(psi);
}

function psiStatus(psi: number): DriftResult["status"] {
  if (psi < 0.10) return "STABLE";
  if (psi < 0.25) return "WARNING";
  return "CRITICAL";
}

// ── createAlert ───────────────────────────────────────────────────────────────

async function createDriftAlert(
  featureType: string,
  psi:         number,
  status:      DriftResult["status"],
): Promise<void> {
  await prisma.mLOpsAlert.create({
    data: {
      alertType: "DRIFT",
      severity:  status === "CRITICAL" ? "CRITICAL" : "WARNING",
      title:     `Feature drift detected: ${featureType}`,
      message:   `PSI=${psi.toFixed(4)} exceeds threshold (${status === "CRITICAL" ? "0.25" : "0.10"}) for feature ${featureType}`,
      metadata:  { featureType, psi, status } as any,
    },
  });
}

// ── detectDrift ───────────────────────────────────────────────────────────────

export async function detectDrift(featureType: string): Promise<DriftResult> {
  const history = await getSnapshotHistory(featureType, 2);

  if (history.length < 2) {
    return {
      featureType,
      psi:         0,
      status:      "STABLE",
      baseline:    history[1] ?? null,
      current:     history[0] ?? null,
      alertCreated: false,
    };
  }

  const [current, baseline] = history; // most recent first
  const psi    = computePSI(baseline.distribution, current.distribution);
  const status = psiStatus(psi);

  let alertCreated = false;
  if (status !== "STABLE") {
    await createDriftAlert(featureType, psi, status);
    alertCreated = true;
  }

  return { featureType, psi, status, baseline, current, alertCreated };
}

// ── checkAllFeatures ──────────────────────────────────────────────────────────
// Takes fresh snapshots for all feature types, then runs drift detection.

export async function checkAllFeatures(): Promise<DriftReport> {
  // Take fresh snapshots for all feature types
  await Promise.all(FEATURE_TYPES.map((ft) => takeSnapshot(ft)));

  // Detect drift for each
  const results = await Promise.all(FEATURE_TYPES.map((ft) => detectDrift(ft)));

  return {
    checkedAt: new Date(),
    results,
    hasIssues: results.some((r) => r.status !== "STABLE"),
  };
}

// ── getAlerts ─────────────────────────────────────────────────────────────────

export async function getAlerts(opts: {
  type?:       string;
  resolved?:   boolean;
  limit?:      number;
} = {}): Promise<Array<{
  id:         string;
  alertType:  string;
  severity:   string;
  title:      string;
  message:    string;
  metadata:   Record<string, unknown>;
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt:  Date;
}>> {
  const where: Record<string, unknown> = {};
  if (opts.type     != null) where["alertType"]  = opts.type;
  if (opts.resolved != null) where["isResolved"] = opts.resolved;

  const rows = await prisma.mLOpsAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 50,
  });

  return rows.map((r) => ({
    id:         r.id,
    alertType:  r.alertType,
    severity:   r.severity,
    title:      r.title,
    message:    r.message,
    metadata:   (r.metadata as Record<string, unknown>) ?? {},
    isResolved: r.isResolved,
    resolvedAt: r.resolvedAt,
    createdAt:  r.createdAt,
  }));
}

// ── resolveAlert ──────────────────────────────────────────────────────────────

export async function resolveAlert(alertId: string): Promise<boolean> {
  const result = await prisma.mLOpsAlert.updateMany({
    where: { id: alertId, isResolved: false },
    data:  { isResolved: true, resolvedAt: new Date() },
  });
  return result.count > 0;
}
