/**
 * experiment.service — A/B experiment management.
 *
 * Deterministic assignment via FNV-1a hash on `${userId}:${experimentId}`.
 * Sticky assignments: written to DB on first call, cached in-memory (1h TTL).
 * Traffic split: percentage of users eligible (trafficSplit field); ineligible
 *   users are always assigned to "control" and never written to DB.
 * Variant weights: relative integers; e.g. [90, 10] means 90% control, 10% treatment.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExperimentVariant {
  id:     string;
  name:   string;
  weight: number;
  config: Record<string, unknown>;
}

export interface Experiment {
  id:           string;
  name:         string;
  description:  string;
  status:       "ACTIVE" | "PAUSED" | "CONCLUDED";
  trafficSplit: number;
  variants:     ExperimentVariant[];
  startedAt:    Date;
  endedAt?:     Date;
}

export interface AssignmentResult {
  variant: string;
  config:  Record<string, unknown>;
}

// ── FNV-1a 32-bit hash ────────────────────────────────────────────────────────

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

// ── Built-in experiment registry ──────────────────────────────────────────────

export const EXPERIMENTS: Record<string, Experiment> = {
  EXP_CF_WEIGHTS: {
    id:           "EXP_CF_WEIGHTS",
    name:         "CF Weight Optimization",
    description:  "Tests higher embedding weight (0.30) vs default CF weight (0.15)",
    status:       "ACTIVE",
    trafficSplit: 50,
    variants: [
      { id: "control",   name: "Default weights",       weight: 50, config: {} },
      {
        id:     "treatment",
        name:   "Embedding-heavy (30%)",
        weight: 50,
        config: {
          weights: {
            cf:         0.20,
            embedding:  0.30,
            trending:   0.10,
            popularity: 0.08,
            freshness:  0.05,
            wishlist:   0.07,
            cart:       0.06,
            purchase:   0.05,
            celebrity:  0.05,
            brand:      0.03,
            category:   0.00,
            price:      0.01,
          },
        },
      },
    ],
    startedAt: new Date("2026-07-01"),
  },

  EXP_DIVERSITY: {
    id:           "EXP_DIVERSITY",
    name:         "Aggressive Diversity",
    description:  "Tests stricter celebrity/brand/category dampening",
    status:       "ACTIVE",
    trafficSplit: 20,
    variants: [
      { id: "control",   name: "Standard diversity",   weight: 50, config: {} },
      {
        id:     "treatment",
        name:   "Aggressive diversity",
        weight: 50,
        config: {
          diversity: {
            celebrity: [1.0, 0.60, 0.30, 0.10],
            brand:     [1.0, 0.70, 0.40, 0.20],
            category:  [1.0, 0.80, 0.55, 0.35],
          },
        },
      },
    ],
    startedAt: new Date("2026-07-01"),
  },

  EXP_TRENDING_BOOST: {
    id:           "EXP_TRENDING_BOOST",
    name:         "Trending Heavy (90/10 rollout)",
    description:  "Tests boosting trending weight to 30% for 10% of eligible users",
    status:       "ACTIVE",
    trafficSplit: 10,
    variants: [
      { id: "control",   name: "No trending boost",    weight: 90, config: {} },
      {
        id:     "treatment",
        name:   "Trending-heavy (30%)",
        weight: 10,
        config: {
          weights: {
            cf:         0.20,
            embedding:  0.10,
            trending:   0.30,
            popularity: 0.10,
            freshness:  0.05,
            wishlist:   0.07,
            cart:       0.05,
            purchase:   0.04,
            celebrity:  0.04,
            brand:      0.03,
            category:   0.01,
            price:      0.01,
          },
        },
      },
    ],
    startedAt: new Date("2026-07-01"),
  },
};

// ── Deterministic variant selection ───────────────────────────────────────────

function selectVariant(userId: string, experiment: Experiment): string {
  const totalWeight = experiment.variants.reduce((s, v) => s + v.weight, 0);
  let bucket        = fnv1a32(`${userId}:${experiment.id}`) % totalWeight;
  for (const v of experiment.variants) {
    if (bucket < v.weight) return v.id;
    bucket -= v.weight;
  }
  return experiment.variants[0]?.id ?? "control";
}

// ── Assignment retrieval ──────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1_000; // 1 hour

export async function getExperimentAssignment(
  userId:       string,
  experimentId: string,
): Promise<AssignmentResult | null> {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment || experiment.status !== "ACTIVE") return null;

  // Traffic eligibility check: hash to [0, 100) — ineligible users skip DB write
  const trafficBucket = fnv1a32(`traffic:${userId}:${experimentId}`) % 100;
  if (trafficBucket >= experiment.trafficSplit) {
    return { variant: "control", config: {} };
  }

  const cacheKey = `exp:assign:${userId}:${experimentId}`;
  const cached   = cacheService.get<string>(cacheKey);
  if (cached) {
    const variantObj = experiment.variants.find((v) => v.id === cached);
    return { variant: cached, config: variantObj?.config ?? {} };
  }

  // Check DB for sticky assignment
  let assignment = await prisma.experimentAssignment.findUnique({
    where: { userId_experimentId: { userId, experimentId } },
  });

  if (!assignment) {
    const variant = selectVariant(userId, experiment);
    assignment = await prisma.experimentAssignment.create({
      data: { userId, experimentId, variant },
    });
  }

  cacheService.set(cacheKey, assignment.variant, CACHE_TTL);
  const variantObj = experiment.variants.find((v) => v.id === assignment!.variant);
  return { variant: assignment.variant, config: variantObj?.config ?? {} };
}

// ── List helpers ──────────────────────────────────────────────────────────────

export function getExperiments(): Experiment[] {
  return Object.values(EXPERIMENTS);
}

export function getExperiment(id: string): Experiment | null {
  return EXPERIMENTS[id] ?? null;
}
