/**
 * business-rules.service — applies business boosts and penalties to ranking scores.
 *
 * Boosts (additive, positive):
 *   RECENTLY_VIEWED_CATEGORY  +0.15  product's category is in user's top-3 recent categories
 *   FAVOURITE_CELEBRITY        +0.10  product's celebrity is in user's top-3 by affinity
 *   FAVOURITE_BRAND            +0.08  product's brand is in user's top-3 by affinity
 *   IN_STOCK                   +0.05  product has available inventory
 *   HIGH_CONVERSION            +0.05  product conversionRate > 5%
 *
 * Penalties (additive, negative):
 *   OUT_OF_STOCK               -0.40  no available inventory
 *   HIGH_RETURN_RATE           -0.20  returnRate > 20%
 *   ALREADY_PURCHASED          -0.30  user has previously bought this product
 *   BLOCKED_PRODUCT            -1.00  product is soft-deleted (deletedAt set)
 *
 * Pure function — no DB access, no cache. All context passed in.
 */

import type { UserFeatures } from "./feature.service.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const BOOST_VALUES = {
  RECENTLY_VIEWED_CATEGORY: 0.15,
  FAVOURITE_CELEBRITY:       0.10,
  FAVOURITE_BRAND:           0.08,
  IN_STOCK:                  0.05,
  HIGH_CONVERSION:           0.05,
} as const;

export const PENALTY_VALUES = {
  OUT_OF_STOCK:      -0.40,
  HIGH_RETURN_RATE:  -0.20,
  ALREADY_PURCHASED: -0.30,
  BLOCKED_PRODUCT:   -1.00,
} as const;

export type BoostRule   = keyof typeof BOOST_VALUES;
export type PenaltyRule = keyof typeof PENALTY_VALUES;
export type BusinessRule = BoostRule | PenaltyRule;

// ── Input / Output types ──────────────────────────────────────────────────────

export interface ProductRankingContext {
  productId:      string;
  category:       string;
  brandId:        string | null;
  celebrityId:    string;
  basePrice:      number;
  conversionRate: number;
  returnRate:     number;
  availableStock: number;
  isDeleted:      boolean;
}

export interface BusinessRuleResult {
  boost:        number;     // total additive boost (≥ 0)
  penalty:      number;     // total additive penalty (≤ 0)
  appliedRules: BusinessRule[];
}

// ── Core function ─────────────────────────────────────────────────────────────

export function applyBusinessRules(
  ctx:              ProductRankingContext,
  userFeatures:     UserFeatures | null,
  purchasedIds:     Set<string>,
  recentCategories: Set<string>
): BusinessRuleResult {
  let boost   = 0;
  let penalty = 0;
  const appliedRules: BusinessRule[] = [];

  // ── Blocked first — skip all other rules ─────────────────────────────────
  if (ctx.isDeleted) {
    penalty += PENALTY_VALUES.BLOCKED_PRODUCT;
    appliedRules.push("BLOCKED_PRODUCT");
    return { boost, penalty, appliedRules };
  }

  // ── Boosts ────────────────────────────────────────────────────────────────

  if (recentCategories.has(ctx.category)) {
    boost += BOOST_VALUES.RECENTLY_VIEWED_CATEGORY;
    appliedRules.push("RECENTLY_VIEWED_CATEGORY");
  }

  if (userFeatures) {
    const topCelebs = Object.entries(userFeatures.celebrityAffinity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => k);
    if (topCelebs.includes(ctx.celebrityId)) {
      boost += BOOST_VALUES.FAVOURITE_CELEBRITY;
      appliedRules.push("FAVOURITE_CELEBRITY");
    }

    if (ctx.brandId) {
      const topBrands = Object.entries(userFeatures.brandAffinity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k);
      if (topBrands.includes(ctx.brandId)) {
        boost += BOOST_VALUES.FAVOURITE_BRAND;
        appliedRules.push("FAVOURITE_BRAND");
      }
    }
  }

  if (ctx.availableStock > 0) {
    boost += BOOST_VALUES.IN_STOCK;
    appliedRules.push("IN_STOCK");
  }

  if (ctx.conversionRate > 0.05) {
    boost += BOOST_VALUES.HIGH_CONVERSION;
    appliedRules.push("HIGH_CONVERSION");
  }

  // ── Penalties ─────────────────────────────────────────────────────────────

  if (ctx.availableStock === 0) {
    penalty += PENALTY_VALUES.OUT_OF_STOCK;
    appliedRules.push("OUT_OF_STOCK");
  }

  if (ctx.returnRate > 0.20) {
    penalty += PENALTY_VALUES.HIGH_RETURN_RATE;
    appliedRules.push("HIGH_RETURN_RATE");
  }

  if (purchasedIds.has(ctx.productId)) {
    penalty += PENALTY_VALUES.ALREADY_PURCHASED;
    appliedRules.push("ALREADY_PURCHASED");
  }

  return { boost, penalty, appliedRules };
}

export const businessRulesService = { applyBusinessRules, BOOST_VALUES, PENALTY_VALUES };
