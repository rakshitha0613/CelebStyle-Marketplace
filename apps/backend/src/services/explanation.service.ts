/**
 * explanation.service — deterministic, LLM-free explanation generation.
 *
 * Decision rules (evaluated in priority order):
 *   1. Business-rule triggers checked first (most specific reasons)
 *   2. Dominant weighted signal identifies the primary reason
 *   3. Fallback: "Popular right now"
 *
 * All output is a static string key + human-readable label.
 * No LLM, no network calls, no randomness.
 */

import type { RankingWeights, ScoreBreakdown } from "./ranking.service.js";
import type { BusinessRule } from "./business-rules.service.js";

// ── Explanation keys ──────────────────────────────────────────────────────────

export type ExplanationKey =
  | "SIMILAR_PRODUCTS"
  | "POPULAR_AMONG_SIMILAR_USERS"
  | "TRENDING_THIS_WEEK"
  | "FAVOURITE_CELEBRITY"
  | "FREQUENTLY_BOUGHT_TOGETHER"
  | "SIMILAR_TO_WISHLIST"
  | "POPULAR_RIGHT_NOW"
  | "NEW_ARRIVAL"
  | "FAVOURITE_BRAND"
  | "MATCHES_YOUR_STYLE"
  | "IN_YOUR_PRICE_RANGE";

export const EXPLANATION_TEXT: Record<ExplanationKey, string> = {
  SIMILAR_PRODUCTS:            "Because you viewed similar products",
  POPULAR_AMONG_SIMILAR_USERS: "Popular among similar users",
  TRENDING_THIS_WEEK:          "Trending this week",
  FAVOURITE_CELEBRITY:         "Matches your favourite celebrity",
  FREQUENTLY_BOUGHT_TOGETHER:  "Frequently bought together",
  SIMILAR_TO_WISHLIST:         "Similar to your wishlist",
  POPULAR_RIGHT_NOW:           "Popular right now",
  NEW_ARRIVAL:                 "New arrival",
  FAVOURITE_BRAND:             "From your favourite brand",
  MATCHES_YOUR_STYLE:          "Matches your style",
  IN_YOUR_PRICE_RANGE:         "In your price range",
};

// ── Core function ─────────────────────────────────────────────────────────────

export interface ExplanationResult {
  key:   ExplanationKey;
  label: string;
}

export function generateExplanation(
  breakdown:     ScoreBreakdown,
  weights:       RankingWeights,
  appliedRules:  BusinessRule[]
): ExplanationResult {
  // ── Priority 1: specific business-rule triggers ───────────────────────────
  if (appliedRules.includes("FAVOURITE_CELEBRITY")) {
    return { key: "FAVOURITE_CELEBRITY", label: EXPLANATION_TEXT.FAVOURITE_CELEBRITY };
  }
  if (appliedRules.includes("FAVOURITE_BRAND")) {
    return { key: "FAVOURITE_BRAND", label: EXPLANATION_TEXT.FAVOURITE_BRAND };
  }

  // ── Priority 2: dominant weighted signal ──────────────────────────────────
  const signalScores: Array<[ExplanationKey, number]> = [
    ["POPULAR_AMONG_SIMILAR_USERS", breakdown.cfScore          * weights.cf],
    ["SIMILAR_PRODUCTS",            breakdown.embeddingSim     * weights.embedding],
    ["TRENDING_THIS_WEEK",          breakdown.trendingScore    * weights.trending],
    ["POPULAR_RIGHT_NOW",           breakdown.popularityScore  * weights.popularity],
    ["SIMILAR_TO_WISHLIST",         breakdown.wishlistAffinity * weights.wishlist],
    ["MATCHES_YOUR_STYLE",          breakdown.categoryAffinity * weights.category],
    ["FREQUENTLY_BOUGHT_TOGETHER",  breakdown.purchaseAffinity * weights.purchase],
    ["NEW_ARRIVAL",                 breakdown.freshnessScore   * weights.freshness],
    ["IN_YOUR_PRICE_RANGE",         breakdown.priceAffinity    * weights.price],
  ];

  signalScores.sort(([, a], [, b]) => b - a);

  // Minimum threshold: signal must contribute at least 1% of its max possible weight
  const [topKey, topScore] = signalScores[0];
  if (topScore > 1e-4) {
    return { key: topKey, label: EXPLANATION_TEXT[topKey] };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return { key: "POPULAR_RIGHT_NOW", label: EXPLANATION_TEXT.POPULAR_RIGHT_NOW };
}

export const explanationService = { generateExplanation, EXPLANATION_TEXT };
