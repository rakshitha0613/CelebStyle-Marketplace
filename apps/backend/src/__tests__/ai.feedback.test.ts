/**
 * ai.feedback.test.ts — Sprint 5.6 integration tests
 * sentinel: @fb56.celebstyle.test
 *
 * Covers:
 *   [1-9]    FeedbackService — recordFeedback (all feedback types, dedup, cache effects)
 *   [10-15]  FeedbackService — recordImpression + markImpressionClicked
 *   [16-17]  FeedbackService — getNegativeSignals
 *   [18-26]  ExperimentService — registry, deterministic assignment, stickiness
 *   [27-33]  MetricsService — CTR, conversion rate, all 8 metrics, context filter
 *   [34-37]  RecommendationAnalyticsService — top algorithms, low performing, cold start
 *   [38-40]  HTTP routes — POST /api/feedback/recommendation, GET /api/experiments
 */

import http from "node:http";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import {
  recordFeedback,
  recordImpression,
  markImpressionClicked,
  getNegativeSignals,
  negSignalKey,
} from "../services/feedback.service.js";
import {
  getExperiments,
  getExperiment,
  getExperimentAssignment,
  EXPERIMENTS,
} from "../services/experiment.service.js";
import { computeMetrics } from "../services/metrics.service.js";
import {
  getTopAlgorithms,
  getLowPerformingProducts,
  getColdStartEffectiveness,
  getExperimentComparison,
} from "../services/recommendation-analytics.service.js";
import { createApp } from "../app.js";

// ── Sentinels ─────────────────────────────────────────────────────────────────

const S        = "@fb56.celebstyle.test";
const USER_A   = `fb56-ua-${S}`;   // warm user
const USER_B   = `fb56-ub-${S}`;   // cold user (null userId impressions)
const PROD_X   = `fb56-px-${S}`;
const PROD_Y   = `fb56-py-${S}`;
const PROD_Z   = `fb56-pz-${S}`;
const CTX_CF   = `CF-${S}`;        // algorithm context sentinels
const CTX_TR   = `TR-${S}`;
const EXP_ID   = "EXP_CF_WEIGHTS";
const EXP_DIV  = "EXP_DIVERSITY";

// ── Helpers ───────────────────────────────────────────────────────────────────

function header(n: number, label: string) {
  console.log(`\n[${n}] ${label}`);
}

let pass = 0;
let fail = 0;

function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✓ ${msg}`); pass++; }
  else       { console.error(`  ✗ ${msg}`); fail++; }
}

async function cleanup() {
  // Delete feedback rows by sentinel value in productId
  await prisma.recommendationFeedback.deleteMany({ where: { productId: { contains: S } } });
  await prisma.recommendationImpression.deleteMany({ where: { productId: { contains: S } } });
  // Delete experiment assignments by sentinel userId
  await prisma.experimentAssignment.deleteMany({ where: { userId: { contains: S } } });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

function post(path: string, body: unknown, token?: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url  = new URL(path, baseUrl);
    const req  = http.request(url, {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path: string, token?: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method:  "GET",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Sprint 5.6 Feedback Loop & A/B Testing ===");

  await cleanup();
  cacheService.clear();

  // ── Start HTTP server ───────────────────────────────────────────────────────
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // ==========================================================================
  // [1] recordFeedback — IMPRESSION is stored
  // ==========================================================================
  header(1, "recordFeedback — IMPRESSION stores a DB record");
  {
    const result = await recordFeedback({
      userId:      USER_A,
      productId:   PROD_X,
      feedbackType: "IMPRESSION",
      context:     CTX_CF,
      position:    0,
    });
    ok(!result.isDuplicate, "isDuplicate=false for IMPRESSION");
    const row = await prisma.recommendationFeedback.findUnique({ where: { id: result.id } });
    ok(row !== null,                    "record exists in DB");
    ok(row?.feedbackType === "IMPRESSION", "feedbackType=IMPRESSION");
    ok(row?.userId === USER_A,          "userId stored");
    ok(row?.context === CTX_CF,         "context stored");
    ok(row?.position === 0,             "position stored");
  }

  // ==========================================================================
  // [2] recordFeedback — CLICK is stored
  // ==========================================================================
  header(2, "recordFeedback — CLICK stores a DB record");
  {
    const result = await recordFeedback({
      userId:      USER_A,
      productId:   PROD_X,
      feedbackType: "CLICK",
      context:     CTX_CF,
    });
    ok(!result.isDuplicate, "isDuplicate=false for CLICK");
    const row = await prisma.recommendationFeedback.findUnique({ where: { id: result.id } });
    ok(row?.feedbackType === "CLICK", "feedbackType=CLICK");
  }

  // ==========================================================================
  // [3] recordFeedback — DISMISS is stored and dedup key is set
  // ==========================================================================
  header(3, "recordFeedback — DISMISS stores record and sets dedup cache");
  {
    const result = await recordFeedback({
      userId:      USER_A,
      productId:   PROD_Y,
      feedbackType: "DISMISS",
      context:     CTX_CF,
    });
    ok(!result.isDuplicate, "first DISMISS is not a duplicate");
    const row = await prisma.recommendationFeedback.findUnique({ where: { id: result.id } });
    ok(row?.feedbackType === "DISMISS", "feedbackType=DISMISS in DB");
  }

  // ==========================================================================
  // [4] recordFeedback — DISMISS dedup within TTL
  // ==========================================================================
  header(4, "recordFeedback — duplicate DISMISS returns isDuplicate=true");
  {
    const result = await recordFeedback({
      userId:      USER_A,
      productId:   PROD_Y,
      feedbackType: "DISMISS",
    });
    ok(result.isDuplicate,     "second DISMISS is flagged as duplicate");
    ok(result.id === "dedup",  "id is 'dedup' sentinel");
  }

  // ==========================================================================
  // [5] recordFeedback — HIDE sets negative signal in cache
  // ==========================================================================
  header(5, "recordFeedback — HIDE sets negative signal cache for ranking pipeline");
  {
    await recordFeedback({
      userId:      USER_A,
      productId:   PROD_Z,
      feedbackType: "HIDE",
    });
    const negSet = getNegativeSignals(USER_A);
    ok(negSet.has(PROD_Z), "PROD_Z in negative signals after HIDE");
    // Dismissed product (PROD_Y) should also be in neg signals
    ok(negSet.has(PROD_Y), "PROD_Y in negative signals after DISMISS");
  }

  // ==========================================================================
  // [6] recordFeedback — PURCHASE invalidates ranking + recommendation caches
  // ==========================================================================
  header(6, "recordFeedback — PURCHASE invalidates user caches");
  {
    // Seed a fake cache entry so we can verify it gets cleared
    cacheService.set(`rank:user:${USER_A}`, [{ productId: PROD_X }], 60_000);
    cacheService.set(`recs:home:${USER_A}`, { sections: [] }, 60_000);

    await recordFeedback({
      userId:      USER_A,
      productId:   PROD_X,
      feedbackType: "PURCHASE",
      revenue:     5000,
    });

    ok(!cacheService.has(`rank:user:${USER_A}`), "ranking cache cleared after PURCHASE");
    ok(!cacheService.has(`recs:home:${USER_A}`), "home recs cache cleared after PURCHASE");
  }

  // ==========================================================================
  // [7] recordFeedback — experimentId and variant are stored
  // ==========================================================================
  header(7, "recordFeedback — experimentId and variant fields are persisted");
  {
    const result = await recordFeedback({
      userId:       USER_A,
      productId:    PROD_X,
      feedbackType: "CLICK",
      experimentId: EXP_ID,
      variant:      "treatment",
    });
    const row = await prisma.recommendationFeedback.findUnique({ where: { id: result.id } });
    ok(row?.experimentId === EXP_ID,     "experimentId stored");
    ok(row?.variant === "treatment",     "variant stored");
  }

  // ==========================================================================
  // [8] recordFeedback — revenue is stored on PURCHASE
  // ==========================================================================
  header(8, "recordFeedback — revenue value is persisted");
  {
    const result = await recordFeedback({
      userId:       USER_A,
      productId:    PROD_X,
      feedbackType: "PURCHASE",
      revenue:      9999.99,
    });
    const row = await prisma.recommendationFeedback.findUnique({ where: { id: result.id } });
    ok(Number(row?.revenue) === 9999.99, `revenue stored (got ${row?.revenue})`);
  }

  // ==========================================================================
  // [9] recordFeedback — SKIP is deduped like DISMISS
  // ==========================================================================
  header(9, "recordFeedback — SKIP is idempotent within TTL");
  {
    const r1 = await recordFeedback({ userId: USER_A, productId: PROD_X, feedbackType: "SKIP" });
    const r2 = await recordFeedback({ userId: USER_A, productId: PROD_X, feedbackType: "SKIP" });
    ok(!r1.isDuplicate, "first SKIP is not a duplicate");
    ok(r2.isDuplicate,  "second SKIP is a duplicate");
  }

  // ==========================================================================
  // [10] recordImpression — creates RecommendationImpression record
  // ==========================================================================
  header(10, "recordImpression — creates RecommendationImpression in DB");
  {
    const impId = await recordImpression({
      userId:    USER_A,
      productId: PROD_X,
      context:   CTX_TR,
      position:  3,
    });
    ok(typeof impId === "string" && impId.length > 0, "returns impression id");
    const row = await prisma.recommendationImpression.findUnique({ where: { id: impId } });
    ok(row !== null,              "impression row exists");
    ok(row?.productId === PROD_X, "productId stored");
    ok(row?.context   === CTX_TR, "context stored");
    ok(row?.position  === 3,      "position stored");
    ok(row?.wasClicked === false,  "wasClicked defaults to false");
  }

  // ==========================================================================
  // [11] recordImpression — creates IMPRESSION feedback mirror row
  // ==========================================================================
  header(11, "recordImpression — mirrors IMPRESSION to RecommendationFeedback");
  {
    const impId = await recordImpression({
      userId:    USER_A,
      productId: PROD_X,
      context:   CTX_CF,
    });
    const rows = await prisma.recommendationFeedback.findMany({
      where:   { productId: PROD_X, feedbackType: "IMPRESSION", userId: USER_A },
      orderBy: { createdAt: "desc" },
      take:    1,
    });
    ok(rows.length > 0,                    "IMPRESSION feedback row created");
    ok(rows[0].context === CTX_CF,         "context matches on feedback mirror");
    ok(typeof impId === "string",          "impression id returned");
  }

  // ==========================================================================
  // [12] recordImpression — experimentId stored on impression
  // ==========================================================================
  header(12, "recordImpression — experimentId and variant stored on impression row");
  {
    const impId = await recordImpression({
      userId:       USER_A,
      productId:    PROD_X,
      context:      CTX_CF,
      experimentId: EXP_ID,
      variant:      "control",
    });
    const row = await prisma.recommendationImpression.findUnique({ where: { id: impId } });
    ok(row?.experimentId === EXP_ID,   "experimentId on impression");
    ok(row?.variant === "control",     "variant on impression");
  }

  // ==========================================================================
  // [13] markImpressionClicked — updates wasClicked + dwellTimeMs
  // ==========================================================================
  header(13, "markImpressionClicked — sets wasClicked=true and dwellTimeMs");
  {
    const impId = await recordImpression({
      userId:    USER_A,
      productId: PROD_X,
      context:   CTX_CF,
    });
    const updated = await markImpressionClicked(impId, 2800);
    ok(updated, "returns true on successful update");
    const row = await prisma.recommendationImpression.findUnique({ where: { id: impId } });
    ok(row?.wasClicked === true,  "wasClicked=true in DB");
    ok(row?.dwellTimeMs === 2800, `dwellTimeMs=2800 (got ${row?.dwellTimeMs})`);
  }

  // ==========================================================================
  // [14] markImpressionClicked — already-clicked impression returns false
  // ==========================================================================
  header(14, "markImpressionClicked — already-clicked returns false");
  {
    const impId = await recordImpression({
      userId:    USER_A,
      productId: PROD_X,
      context:   CTX_CF,
    });
    await markImpressionClicked(impId);
    const secondUpdate = await markImpressionClicked(impId);
    ok(!secondUpdate, "second click attempt returns false");
  }

  // ==========================================================================
  // [15] markImpressionClicked — non-existent ID returns false
  // ==========================================================================
  header(15, "markImpressionClicked — non-existent impression returns false");
  {
    const result = await markImpressionClicked("nonexistent-impression-id");
    ok(!result, "returns false for non-existent impression");
  }

  // ==========================================================================
  // [16] getNegativeSignals — empty set for user with no signals
  // ==========================================================================
  header(16, "getNegativeSignals — empty Set for new user");
  {
    const set = getNegativeSignals("fb56-brand-new-user-no-signals");
    ok(set instanceof Set,  "returns a Set");
    ok(set.size === 0,      "empty for user with no DISMISS/HIDE events");
  }

  // ==========================================================================
  // [17] getNegativeSignals — returns Set with dismissed products
  // ==========================================================================
  header(17, "getNegativeSignals — contains DISMISS and HIDE product IDs");
  {
    const set = getNegativeSignals(USER_A);
    ok(set instanceof Set,         "returns a Set");
    ok(set.has(PROD_Y),            "PROD_Y (dismissed) in signals");
    ok(set.has(PROD_Z),            "PROD_Z (hidden) in signals");
    ok(!set.has(PROD_X),           "PROD_X (only clicked) not in negative signals");
  }

  // ==========================================================================
  // [18] getExperiments — returns all 3 built-in experiments
  // ==========================================================================
  header(18, "getExperiments — returns all 3 registered experiments");
  {
    const exps = getExperiments();
    ok(exps.length === 3, `3 experiments (got ${exps.length})`);
    const ids = exps.map((e) => e.id);
    ok(ids.includes("EXP_CF_WEIGHTS"),    "EXP_CF_WEIGHTS present");
    ok(ids.includes("EXP_DIVERSITY"),     "EXP_DIVERSITY present");
    ok(ids.includes("EXP_TRENDING_BOOST"), "EXP_TRENDING_BOOST present");
  }

  // ==========================================================================
  // [19] getExperiment — returns experiment by ID
  // ==========================================================================
  header(19, "getExperiment — returns experiment by ID");
  {
    const exp = getExperiment(EXP_ID);
    ok(exp !== null,                            "found EXP_CF_WEIGHTS");
    ok(!!exp?.name.includes("CF Weight"),       "name matches");
    ok((exp?.variants.length ?? 0) === 2,       "2 variants (control + treatment)");
    ok((exp?.trafficSplit ?? -1) === 50,        "trafficSplit=50");
  }

  // ==========================================================================
  // [20] getExperiment — returns null for unknown ID
  // ==========================================================================
  header(20, "getExperiment — null for unknown experiment");
  {
    const exp = getExperiment("EXP_DOES_NOT_EXIST");
    ok(exp === null, "returns null for unknown experiment");
  }

  // ==========================================================================
  // [21] getExperimentAssignment — creates DB record on first call
  // ==========================================================================
  header(21, "getExperimentAssignment — creates sticky DB record on first assignment");
  {
    const userId = `fb56-assign-test-${S}`;
    // Clean up any prior assignment
    await prisma.experimentAssignment.deleteMany({ where: { userId } });
    cacheService.del(`exp:assign:${userId}:${EXP_ID}`);

    const assignment = await getExperimentAssignment(userId, EXP_ID);
    if (assignment && assignment.variant !== "control") {
      // Eligible user — check DB record
      const dbRow = await prisma.experimentAssignment.findUnique({
        where: { userId_experimentId: { userId, experimentId: EXP_ID } },
      });
      ok(dbRow !== null,                       "DB record created");
      ok(dbRow?.variant === assignment.variant, "DB variant matches returned variant");
    } else {
      // Ineligible user (traffic split filtered) — no DB record
      const dbRow = await prisma.experimentAssignment.findUnique({
        where: { userId_experimentId: { userId, experimentId: EXP_ID } },
      });
      ok(dbRow === null, "no DB record for ineligible (traffic-gated) user");
    }
    ok(assignment !== null, "getExperimentAssignment returns non-null");
    ok(
      ["control", "treatment"].includes(assignment?.variant ?? ""),
      `variant is control or treatment (got ${assignment?.variant})`,
    );

    // Cleanup
    await prisma.experimentAssignment.deleteMany({ where: { userId } });
  }

  // ==========================================================================
  // [22] getExperimentAssignment — sticky (same result on second call)
  // ==========================================================================
  header(22, "getExperimentAssignment — same variant returned on subsequent calls");
  {
    const userId = `fb56-sticky-${S}`;
    await prisma.experimentAssignment.deleteMany({ where: { userId } });
    cacheService.del(`exp:assign:${userId}:${EXP_ID}`);

    const first  = await getExperimentAssignment(userId, EXP_ID);
    // Clear cache to force DB lookup on second call
    cacheService.del(`exp:assign:${userId}:${EXP_ID}`);
    const second = await getExperimentAssignment(userId, EXP_ID);

    ok(first?.variant === second?.variant, `sticky assignment: ${first?.variant} === ${second?.variant}`);

    await prisma.experimentAssignment.deleteMany({ where: { userId } });
  }

  // ==========================================================================
  // [23] getExperimentAssignment — PAUSED experiment returns null
  // ==========================================================================
  header(23, "getExperimentAssignment — PAUSED experiment returns null");
  {
    const orig = EXPERIMENTS[EXP_ID].status;
    EXPERIMENTS[EXP_ID].status = "PAUSED";
    const result = await getExperimentAssignment(USER_A, EXP_ID);
    EXPERIMENTS[EXP_ID].status = orig;
    ok(result === null, "PAUSED experiment returns null");
  }

  // ==========================================================================
  // [24] getExperimentAssignment — config matches variant definition
  // ==========================================================================
  header(24, "getExperimentAssignment — returned config matches variant config in registry");
  {
    const userId = `fb56-config-${S}`;
    await prisma.experimentAssignment.deleteMany({ where: { userId } });
    cacheService.del(`exp:assign:${userId}:${EXP_ID}`);

    const assignment = await getExperimentAssignment(userId, EXP_ID);
    if (assignment) {
      const variant = EXPERIMENTS[EXP_ID].variants.find((v) => v.id === assignment.variant);
      ok(
        JSON.stringify(assignment.config) === JSON.stringify(variant?.config ?? {}),
        "returned config matches registry variant config",
      );
    } else {
      ok(true, "null result (inactive exp) — skipping config check");
    }

    await prisma.experimentAssignment.deleteMany({ where: { userId } });
  }

  // ==========================================================================
  // [25] FNV-1a determinism — 5 unique users get consistent assignments across runs
  // ==========================================================================
  header(25, "FNV-1a determinism — same user always gets same variant");
  {
    const testUsers = Array.from({ length: 5 }, (_, i) => `fb56-det-${i}-${S}`);
    // Clean up
    await prisma.experimentAssignment.deleteMany({ where: { userId: { in: testUsers } } });
    for (const uid of testUsers) cacheService.del(`exp:assign:${uid}:${EXP_ID}`);

    // First run
    const firstRun = await Promise.all(testUsers.map((u) => getExperimentAssignment(u, EXP_ID)));
    // Clear cache, force DB lookups
    for (const uid of testUsers) cacheService.del(`exp:assign:${uid}:${EXP_ID}`);
    // Second run
    const secondRun = await Promise.all(testUsers.map((u) => getExperimentAssignment(u, EXP_ID)));

    const allMatch = firstRun.every((a, i) => a?.variant === secondRun[i]?.variant);
    ok(allMatch, "all 5 users got identical variants on both runs");

    await prisma.experimentAssignment.deleteMany({ where: { userId: { in: testUsers } } });
  }

  // ==========================================================================
  // [26] getExperimentAssignment — EXP_DIVERSITY (trafficSplit=20) coverage
  // ==========================================================================
  header(26, "getExperimentAssignment — EXP_DIVERSITY splits traffic and returns valid variant");
  {
    const userId = `fb56-div-${S}`;
    await prisma.experimentAssignment.deleteMany({ where: { userId } });
    cacheService.del(`exp:assign:${userId}:${EXP_DIV}`);

    const result = await getExperimentAssignment(userId, EXP_DIV);

    // Result is non-null (experiment is ACTIVE), variant is one of defined variants or control
    ok(result !== null, "EXP_DIVERSITY returns non-null result");
    ok(
      result?.variant === "control" || result?.variant === "treatment",
      `variant is valid (got ${result?.variant})`,
    );

    await prisma.experimentAssignment.deleteMany({ where: { userId } });
  }

  // ==========================================================================
  // [27] computeMetrics — returns all-zeros for empty context filter
  // ==========================================================================
  header(27, "computeMetrics — empty context returns zero metrics");
  {
    const metrics = await computeMetrics({ context: "NO_SUCH_CONTEXT_EVER_12345" });
    ok(metrics.impressions === 0, "impressions=0");
    ok(metrics.clicks      === 0, "clicks=0");
    ok(metrics.ctr         === 0, "ctr=0");
  }

  // ==========================================================================
  // [28] computeMetrics — CTR = clicks / impressions
  // ==========================================================================
  header(28, "computeMetrics — CTR computed as clicks / impressions");
  {
    const ctx = `CTX28-${S}`;
    // Seed: 4 impressions, 2 clicks
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctx },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctx },
      ],
    });

    const metrics = await computeMetrics({ context: ctx });
    ok(metrics.impressions === 4,    `impressions=4 (got ${metrics.impressions})`);
    ok(metrics.clicks      === 2,    `clicks=2 (got ${metrics.clicks})`);
    ok(Math.abs(metrics.ctr - 0.5) < 1e-9, `CTR=0.5 (got ${metrics.ctr})`);
  }

  // ==========================================================================
  // [29] computeMetrics — conversionRate = conversions / impressions
  // ==========================================================================
  header(29, "computeMetrics — conversionRate = conversions / impressions");
  {
    const ctx = `CTX29-${S}`;
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Y, feedbackType: "CONVERSION", context: ctx },
      ],
    });

    const metrics = await computeMetrics({ context: ctx });
    ok(metrics.impressions === 4,     `impressions=4 (got ${metrics.impressions})`);
    ok(metrics.conversions === 1,     `conversions=1 (got ${metrics.conversions})`);
    ok(Math.abs(metrics.conversionRate - 0.25) < 1e-9, `conversionRate=0.25 (got ${metrics.conversionRate})`);
  }

  // ==========================================================================
  // [30] computeMetrics — purchaseRate = purchases / impressions
  // ==========================================================================
  header(30, "computeMetrics — purchaseRate = purchases / impressions");
  {
    const ctx = `CTX30-${S}`;
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_Z, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Z, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Z, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Z, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Z, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_Z, feedbackType: "PURCHASE",   context: ctx },
      ],
    });

    const metrics = await computeMetrics({ context: ctx });
    ok(metrics.impressions === 5,   `impressions=5 (got ${metrics.impressions})`);
    ok(metrics.purchases   === 1,   `purchases=1 (got ${metrics.purchases})`);
    ok(Math.abs(metrics.purchaseRate - 0.2) < 1e-9, `purchaseRate=0.2 (got ${metrics.purchaseRate})`);
  }

  // ==========================================================================
  // [31] computeMetrics — acceptanceRate = (clicks + wishlists + addToCarts) / impressions
  // ==========================================================================
  header(31, "computeMetrics — acceptanceRate = (clicks+wishlists+carts) / impressions");
  {
    const ctx = `CTX31-${S}`;
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION",  context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION",  context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION",  context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION",  context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION",  context: ctx },
        { productId: PROD_X, feedbackType: "CLICK",       context: ctx },  // 1 click
        { productId: PROD_X, feedbackType: "WISHLIST",    context: ctx },  // 1 wishlist
        { productId: PROD_X, feedbackType: "ADD_TO_CART", context: ctx },  // 1 add-to-cart
      ],
    });

    const metrics = await computeMetrics({ context: ctx });
    ok(metrics.impressions === 5,    `impressions=5 (got ${metrics.impressions})`);
    ok(metrics.clicks      === 1,    `clicks=1 (got ${metrics.clicks})`);
    ok(metrics.wishlists   === 1,    `wishlists=1 (got ${metrics.wishlists})`);
    ok(metrics.addToCarts  === 1,    `addToCarts=1 (got ${metrics.addToCarts})`);
    // acceptanceRate = 3 / 5 = 0.6
    ok(Math.abs(metrics.acceptanceRate - 0.6) < 1e-9, `acceptanceRate=0.6 (got ${metrics.acceptanceRate})`);
  }

  // ==========================================================================
  // [32] computeMetrics — revenue metrics
  // ==========================================================================
  header(32, "computeMetrics — revenuePerImpression and revenuePerClick computed");
  {
    const ctx = `CTX32-${S}`;
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctx },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctx },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctx },
        { productId: PROD_X, feedbackType: "PURCHASE",   context: ctx, revenue: 1000 },
        { productId: PROD_X, feedbackType: "PURCHASE",   context: ctx, revenue: 2000 },
      ],
    });

    const metrics = await computeMetrics({ context: ctx });
    ok(metrics.totalRevenue === 3000, `totalRevenue=3000 (got ${metrics.totalRevenue})`);
    // revenuePerImpression = 3000 / 2 = 1500
    ok(Math.abs(metrics.revenuePerImpression - 1500) < 1e-6,
       `revenuePerImpression=1500 (got ${metrics.revenuePerImpression})`);
    // revenuePerClick = 3000 / 2 = 1500
    ok(Math.abs(metrics.revenuePerClick - 1500) < 1e-6,
       `revenuePerClick=1500 (got ${metrics.revenuePerClick})`);
  }

  // ==========================================================================
  // [33] computeMetrics — context filter isolates algorithm
  // ==========================================================================
  header(33, "computeMetrics — context filter returns only that algorithm's events");
  {
    const ctxA = `CTX33A-${S}`;
    const ctxB = `CTX33B-${S}`;
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxA },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxA },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctxA },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxB },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxB },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxB },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxB },
      ],
    });

    const metricsA = await computeMetrics({ context: ctxA });
    const metricsB = await computeMetrics({ context: ctxB });

    ok(metricsA.impressions === 2, `ctxA: 2 impressions (got ${metricsA.impressions})`);
    ok(metricsA.clicks      === 1, `ctxA: 1 click (got ${metricsA.clicks})`);
    ok(metricsB.impressions === 4, `ctxB: 4 impressions (got ${metricsB.impressions})`);
    ok(metricsB.clicks      === 0, `ctxB: 0 clicks (got ${metricsB.clicks})`);
  }

  // ==========================================================================
  // [34] getTopAlgorithms — returns algorithms sorted by CTR descending
  // ==========================================================================
  header(34, "getTopAlgorithms — sorted by CTR descending");
  {
    const ctxHigh = `CTX34H-${S}`;   // CTR = 3/4 = 0.75
    const ctxLow  = `CTX34L-${S}`;   // CTR = 1/4 = 0.25

    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxHigh },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxHigh },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxHigh },
        { productId: PROD_X, feedbackType: "IMPRESSION", context: ctxHigh },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctxHigh },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctxHigh },
        { productId: PROD_X, feedbackType: "CLICK",      context: ctxHigh },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxLow  },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxLow  },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxLow  },
        { productId: PROD_Y, feedbackType: "IMPRESSION", context: ctxLow  },
        { productId: PROD_Y, feedbackType: "CLICK",      context: ctxLow  },
      ],
    });

    const since = new Date(Date.now() - 60_000);
    const algorithms = await getTopAlgorithms(since);

    const highIdx = algorithms.findIndex((a) => a.context === ctxHigh);
    const lowIdx  = algorithms.findIndex((a) => a.context === ctxLow);

    ok(highIdx !== -1, "high-CTR algorithm present in results");
    ok(lowIdx  !== -1, "low-CTR algorithm present in results");
    ok(highIdx < lowIdx, `high-CTR algorithm (idx ${highIdx}) ranked before low-CTR (idx ${lowIdx})`);
  }

  // ==========================================================================
  // [35] getLowPerformingProducts — respects minImpressions threshold
  // ==========================================================================
  header(35, "getLowPerformingProducts — excludes products below minImpressions threshold");
  {
    const prodLow  = `fb56-low-imp-${S}`;   // below threshold
    const prodHigh = `fb56-high-imp-${S}`;  // above threshold
    const since    = new Date(Date.now() - 60_000);

    await prisma.recommendationFeedback.createMany({
      data: [
        // prodLow: only 3 impressions (below default threshold of 10)
        { productId: prodLow,  feedbackType: "IMPRESSION" },
        { productId: prodLow,  feedbackType: "IMPRESSION" },
        { productId: prodLow,  feedbackType: "IMPRESSION" },
        { productId: prodLow,  feedbackType: "DISMISS"    },
        // prodHigh: 12 impressions + high dismiss rate
        ...Array.from({ length: 12 }, () => ({ productId: prodHigh, feedbackType: "IMPRESSION" as const })),
        ...Array.from({ length: 8 },  () => ({ productId: prodHigh, feedbackType: "DISMISS"    as const })),
      ],
    });

    const low = await getLowPerformingProducts(10, since);
    const hasLowImp  = low.some((p) => p.productId === prodLow);
    const hasHighImp = low.some((p) => p.productId === prodHigh);

    ok(!hasLowImp, "product with < 10 impressions excluded");
    ok(hasHighImp, "product with high dismiss rate included");
  }

  // ==========================================================================
  // [36] getColdStartEffectiveness — cold=null userId, warm=authenticated userId
  // ==========================================================================
  header(36, "getColdStartEffectiveness — separates cold (anonymous) from warm (auth) users");
  {
    const since = new Date(Date.now() - 60_000);
    // Cold impressions (userId=null): 2 impressions, 1 click → CTR=0.5
    // Warm impressions (userId=USER_B): 4 impressions, 1 click → CTR=0.25
    await prisma.recommendationFeedback.createMany({
      data: [
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: null },
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: null },
        { productId: PROD_X, feedbackType: "CLICK",      userId: null },
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: USER_B },
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: USER_B },
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: USER_B },
        { productId: PROD_X, feedbackType: "IMPRESSION", userId: USER_B },
        { productId: PROD_X, feedbackType: "CLICK",      userId: USER_B },
      ],
    });

    const report = await getColdStartEffectiveness(since);
    ok(typeof report.coldStartMetrics === "object", "coldStartMetrics returned");
    ok(typeof report.warmStartMetrics === "object", "warmStartMetrics returned");
    ok(typeof report.ratio === "number",            "ratio is a number");
    ok(report.coldStartMetrics.impressions >= 2,    `cold impressions ≥ 2 (got ${report.coldStartMetrics.impressions})`);
    ok(report.warmStartMetrics.impressions >= 4,    `warm impressions ≥ 4 (got ${report.warmStartMetrics.impressions})`);
  }

  // ==========================================================================
  // [37] getExperimentComparison — returns null for unknown experiment
  // ==========================================================================
  header(37, "getExperimentComparison — null for unknown experiment ID");
  {
    const result = await getExperimentComparison("EXP_DOES_NOT_EXIST");
    ok(result === null, "returns null for unknown experiment");

    // Test with a known experiment (may have no data yet)
    const known = await getExperimentComparison(EXP_ID);
    ok(known !== null,                         "returns non-null for known experiment");
    ok(known?.experimentId === EXP_ID,         "experimentId matches");
    ok(typeof known?.name === "string",        "name is a string");
    ok(Array.isArray(known?.byVariant),        "byVariant is an array");
  }

  // ==========================================================================
  // [38] POST /api/feedback/recommendation — 201 with valid anonymous payload
  // ==========================================================================
  header(38, "POST /api/feedback/recommendation — 201 for valid anonymous payload");
  {
    const res = await post("/api/feedback/recommendation", {
      productId:    PROD_X,
      feedbackType: "CLICK",
      context:      "TRENDING",
      position:     1,
    });
    ok(res.status === 201, `status=201 (got ${res.status})`);
    const body = res.body as { data: { id: string; isDuplicate: boolean } };
    ok(typeof body?.data?.id === "string", "response has id");
    ok(body?.data?.isDuplicate === false,  "isDuplicate=false");
  }

  // ==========================================================================
  // [39] POST /api/feedback/recommendation — 400 for invalid feedbackType
  // ==========================================================================
  header(39, "POST /api/feedback/recommendation — 400 for invalid feedbackType");
  {
    const res = await post("/api/feedback/recommendation", {
      productId:    PROD_X,
      feedbackType: "INVALID_TYPE",
    });
    ok(res.status === 400, `status=400 (got ${res.status})`);
    const body = res.body as { error: string; valid: string[] };
    ok(typeof body?.error === "string",     "error message returned");
    ok(Array.isArray(body?.valid),          "valid types list returned");
    ok(body?.valid.includes("CLICK"),       "valid types includes CLICK");
  }

  // ==========================================================================
  // [40] GET /api/experiments — 200 with all experiments (public endpoint)
  // ==========================================================================
  header(40, "GET /api/experiments — 200 with all registered experiments");
  {
    const res = await get("/api/experiments");
    ok(res.status === 200, `status=200 (got ${res.status})`);
    const body = res.body as { data: { experiments: Array<{ id: string; status: string }> } };
    const exps = body?.data?.experiments;
    ok(Array.isArray(exps),   "experiments is an array");
    ok(exps.length === 3,     `3 experiments (got ${exps.length})`);
    ok(exps.some((e) => e.id === "EXP_CF_WEIGHTS"),    "EXP_CF_WEIGHTS in list");
    ok(exps.some((e) => e.id === "EXP_DIVERSITY"),     "EXP_DIVERSITY in list");
    ok(exps.some((e) => e.id === "EXP_TRENDING_BOOST"), "EXP_TRENDING_BOOST in list");
    ok(exps.every((e) => e.status === "ACTIVE"),       "all experiments are ACTIVE");
  }

  // ── Teardown ──────────────────────────────────────────────────────────────
  await cleanup();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Sprint 5.6  |  ✓ ${pass} passed  |  ${fail > 0 ? `✗ ${fail} failed` : "0 failed"}`);
  if (fail > 0) {
    console.error("FAILED");
    process.exit(1);
  } else {
    console.log("PASSED");
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
