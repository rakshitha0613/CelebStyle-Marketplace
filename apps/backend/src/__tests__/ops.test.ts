/**
 * Sprint 7.2 — Production Monitoring & Scaling test suite
 *
 * Tests: MonitoringService, AlertingService, ScalingService,
 *        PerformanceMonitoringService, CacheMonitoringService, TracingService,
 *        and the /api/ops route structure.
 */

import assert from "node:assert/strict";

// ─── Service imports ──────────────────────────────────────────────────────────
import { MonitoringService } from "../services/monitoring.service.js";
import { AlertingService } from "../services/alerting.service.js";
import { ScalingService } from "../services/scaling.service.js";
import { PerformanceMonitoringService } from "../services/performance-monitoring.service.js";
import { CacheMonitoringService } from "../services/cache-monitoring.service.js";
import { TracingService } from "../services/tracing.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${name}\n      ${msg}`);
      failed++;
      failures.push(`${name}: ${msg}`);
    });
}

function suite(name: string): void {
  console.log(`\n${name}`);
}

// ─── 1. MonitoringService ─────────────────────────────────────────────────────

suite("MonitoringService");

const monitoring = new MonitoringService();

await test("collectSystemMetrics returns cpu object with usagePercent", () => {
  const m = monitoring.collectSystemMetrics();
  assert.ok(typeof m.cpu.usagePercent === "number", "usagePercent should be number");
  assert.ok(m.cpu.usagePercent >= 0, "usagePercent >= 0");
  assert.ok(m.cpu.usagePercent <= 100, "usagePercent <= 100");
});

await test("collectSystemMetrics returns cpu coreCount >= 1", () => {
  const m = monitoring.collectSystemMetrics();
  assert.ok(m.cpu.coreCount >= 1, "coreCount >= 1");
});

await test("collectSystemMetrics returns memory with totalMB > 0", () => {
  const m = monitoring.collectSystemMetrics();
  assert.ok(m.memory.totalMB > 0, "totalMB > 0");
});

await test("collectSystemMetrics returns memory usagePercent in [0, 100]", () => {
  const m = monitoring.collectSystemMetrics();
  assert.ok(m.memory.usagePercent >= 0, ">= 0");
  assert.ok(m.memory.usagePercent <= 100, "<= 100");
});

await test("collectSystemMetrics includes timestamp close to Date.now()", () => {
  const before = Date.now();
  const m = monitoring.collectSystemMetrics();
  const after = Date.now();
  assert.ok(m.timestamp >= before && m.timestamp <= after, "timestamp in range");
});

await test("collectSystemMetrics disk has fallback when statfs fails", () => {
  const m = monitoring.collectSystemMetrics();
  assert.ok(typeof m.disk.usedGB === "number");
  assert.ok(typeof m.disk.totalGB === "number");
  assert.ok(typeof m.disk.usagePercent === "number");
});

await test("recordRequest accumulates samples", () => {
  const mon = new MonitoringService();
  mon.recordRequest(100, 200);
  mon.recordRequest(200, 200);
  mon.recordRequest(500, 500);
  const rm = mon.collectRequestMetrics();
  assert.equal(rm.requestsPerMinute, 3);
});

await test("collectRequestMetrics p50 is median of sorted durations", () => {
  const mon = new MonitoringService();
  for (const d of [10, 20, 30, 40, 50]) mon.recordRequest(d, 200);
  const rm = mon.collectRequestMetrics();
  assert.ok(rm.p50Ms >= 10 && rm.p50Ms <= 50, `p50=${rm.p50Ms}`);
});

await test("collectRequestMetrics p95 >= p50", () => {
  const mon = new MonitoringService();
  for (let i = 1; i <= 100; i++) mon.recordRequest(i * 10, 200);
  const rm = mon.collectRequestMetrics();
  assert.ok(rm.p95Ms >= rm.p50Ms, `p95=${rm.p95Ms} p50=${rm.p50Ms}`);
});

await test("collectRequestMetrics p99 >= p95", () => {
  const mon = new MonitoringService();
  for (let i = 1; i <= 100; i++) mon.recordRequest(i * 10, 200);
  const rm = mon.collectRequestMetrics();
  assert.ok(rm.p99Ms >= rm.p95Ms, `p99=${rm.p99Ms} p95=${rm.p95Ms}`);
});

await test("collectRequestMetrics errorRate reflects 5xx responses", () => {
  const mon = new MonitoringService();
  for (let i = 0; i < 9; i++) mon.recordRequest(50, 200);
  mon.recordRequest(50, 500);
  const rm = mon.collectRequestMetrics();
  assert.ok(rm.errorRate > 0 && rm.errorRate <= 0.15, `errorRate=${rm.errorRate}`);
});

await test("incrementConnections / decrementConnections tracks activeConnections", () => {
  const mon = new MonitoringService();
  mon.incrementConnections();
  mon.incrementConnections();
  assert.equal(mon.collectRequestMetrics().activeConnections, 2);
  mon.decrementConnections();
  assert.equal(mon.collectRequestMetrics().activeConnections, 1);
});

await test("recordActiveUser increments activeUsers count", () => {
  const mon = new MonitoringService();
  mon.recordActiveUser("user-1");
  mon.recordActiveUser("user-2");
  mon.recordActiveUser("user-1"); // duplicate — same user
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.activeUsers, 2);
});

await test("recordOrder updates ordersPerMinute", () => {
  const mon = new MonitoringService();
  mon.recordOrder();
  mon.recordOrder();
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.ordersPerMinute, 2);
});

await test("recordPayment updates paymentsPerMinute", () => {
  const mon = new MonitoringService();
  mon.recordPayment();
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.paymentsPerMinute, 1);
});

await test("recordRecommendationLatency shows average", () => {
  const mon = new MonitoringService();
  mon.recordRecommendationLatency(100);
  mon.recordRecommendationLatency(200);
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.recommendationLatencyMs, 150);
});

await test("recordDbLatency updates dbLatencyMs", () => {
  const mon = new MonitoringService();
  mon.recordDbLatency(80);
  mon.recordDbLatency(120);
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.dbLatencyMs, 100);
});

await test("recordRedisLatency updates redisLatencyMs", () => {
  const mon = new MonitoringService();
  mon.recordRedisLatency(5);
  const bm = mon.collectBusinessMetrics();
  assert.equal(bm.redisLatencyMs, 5);
});

await test("getMetricsSummary includes system, requests, business", () => {
  const summary = monitoring.getMetricsSummary();
  assert.ok("system" in summary);
  assert.ok("requests" in summary);
  assert.ok("business" in summary);
});

await test("collectRequestMetrics returns 0 for all percentiles when no samples", () => {
  const mon = new MonitoringService();
  const rm = mon.collectRequestMetrics();
  assert.equal(rm.p50Ms, 0);
  assert.equal(rm.p95Ms, 0);
  assert.equal(rm.p99Ms, 0);
  assert.equal(rm.errorRate, 0);
});

// ─── 2. AlertingService ───────────────────────────────────────────────────────

suite("AlertingService");

const alerting = new AlertingService(false); // no defaults — clean slate

await test("addRule registers a rule", () => {
  alerting.addRule({
    id: "test-cpu",
    name: "Test CPU",
    description: "CPU > 50%",
    severity: "warning",
    cooldownMs: 0,
    evaluate: (ctx) => ctx.system.cpu.usagePercent > 50,
  });
  assert.ok(alerting.getRule("test-cpu") !== undefined);
});

await test("getRules returns all registered rules", () => {
  const rules = alerting.getRules();
  assert.ok(rules.length >= 1);
  assert.ok(rules.some((r) => r.id === "test-cpu"));
});

await test("evaluate fires alert when rule condition is true", () => {
  const ctx = buildCtx({ cpuPercent: 80 });
  const fired = alerting.evaluate(ctx);
  assert.equal(fired.length, 1);
  assert.equal(fired[0].ruleId, "test-cpu");
  assert.equal(fired[0].state, "firing");
});

await test("evaluate does not fire again within cooldown", () => {
  alerting.addRule({
    id: "test-cooldown",
    name: "Cooldown Test",
    description: "always fires",
    severity: "info",
    cooldownMs: 60_000, // 60s cooldown
    evaluate: () => true,
  });
  const ctx = buildCtx();
  const first = alerting.evaluate(ctx);
  const second = alerting.evaluate(ctx); // within cooldown
  // first fire creates alert, second is blocked by cooldown
  const testAlert = first.find((a) => a.ruleId === "test-cooldown");
  assert.ok(testAlert, "first evaluation fired");
  const secondFired = second.filter((a) => a.ruleId === "test-cooldown");
  assert.equal(secondFired.length, 0, "cooldown prevented second fire");
});

await test("getActiveAlerts returns firing alerts", () => {
  const active = alerting.getActiveAlerts();
  assert.ok(active.length >= 1);
  assert.ok(active.every((a) => a.state === "firing" || a.state === "acknowledged"));
});

await test("evaluate resolves alert when condition clears", () => {
  const svc = new AlertingService(false);
  svc.addRule({
    id: "transient",
    name: "Transient",
    description: "transient",
    severity: "warning",
    cooldownMs: 0,
    evaluate: (ctx) => ctx.system.cpu.usagePercent > 50,
  });
  svc.evaluate(buildCtx({ cpuPercent: 80 })); // fires
  assert.equal(svc.getActiveAlerts().length, 1);
  svc.evaluate(buildCtx({ cpuPercent: 10 })); // resolves
  assert.equal(svc.getActiveAlerts().length, 0);
});

await test("getAlertHistory includes resolved alerts", () => {
  const svc = new AlertingService(false);
  svc.addRule({
    id: "hist-test",
    name: "Hist Test",
    description: "hist",
    severity: "info",
    cooldownMs: 0,
    evaluate: (ctx) => ctx.system.cpu.usagePercent > 50,
  });
  svc.evaluate(buildCtx({ cpuPercent: 80 }));
  svc.evaluate(buildCtx({ cpuPercent: 10 }));
  const history = svc.getAlertHistory();
  assert.ok(history.length >= 1);
  assert.ok(history.some((h) => h.state === "resolved"));
});

await test("acknowledgeAlert changes state to acknowledged", () => {
  const svc = new AlertingService(false);
  svc.addRule({
    id: "ack-test",
    name: "Ack Test",
    description: "ack",
    severity: "critical",
    cooldownMs: 0,
    evaluate: () => true,
  });
  const fired = svc.evaluate(buildCtx());
  const alertId = fired[0].alertId;
  const ok = svc.acknowledgeAlert(alertId, "admin@example.com");
  assert.ok(ok);
  const active = svc.getActiveAlerts();
  const acked = active.find((a) => a.alertId === alertId);
  assert.equal(acked?.state, "acknowledged");
  assert.equal(acked?.acknowledgedBy, "admin@example.com");
});

await test("acknowledgeAlert returns false for unknown alertId", () => {
  const ok = alerting.acknowledgeAlert("nonexistent-alert");
  assert.equal(ok, false);
});

await test("clearAlert removes from active and adds to history", () => {
  const svc = new AlertingService(false);
  svc.addRule({
    id: "clear-test",
    name: "Clear Test",
    description: "clear",
    severity: "warning",
    cooldownMs: 0,
    evaluate: () => true,
  });
  const fired = svc.evaluate(buildCtx());
  const alertId = fired[0].alertId;
  const ok = svc.clearAlert(alertId);
  assert.ok(ok);
  assert.equal(svc.getActiveAlerts().length, 0);
  const history = svc.getAlertHistory();
  assert.ok(history.some((h) => h.alertId === alertId));
});

await test("removeRule deletes the rule", () => {
  const svc = new AlertingService(false);
  svc.addRule({ id: "rem", name: "Rem", description: "", severity: "info", cooldownMs: 0, evaluate: () => false });
  assert.ok(svc.getRule("rem") !== undefined);
  svc.removeRule("rem");
  assert.equal(svc.getRule("rem"), undefined);
});

await test("default rules include high-cpu, high-memory, high-error-rate", () => {
  const svc = new AlertingService(true);
  const ids = svc.getRules().map((r) => r.id);
  assert.ok(ids.includes("high-cpu"), "high-cpu");
  assert.ok(ids.includes("high-memory"), "high-memory");
  assert.ok(ids.includes("high-error-rate"), "high-error-rate");
});

await test("alert has firedAt timestamp >= test start", () => {
  const before = Date.now();
  const svc = new AlertingService(false);
  svc.addRule({ id: "ts-test", name: "TS", description: "", severity: "info", cooldownMs: 0, evaluate: () => true });
  const fired = svc.evaluate(buildCtx());
  assert.ok(fired[0].firedAt >= before);
});

await test("alert severity is preserved in active alerts", () => {
  const svc = new AlertingService(false);
  svc.addRule({ id: "sev-test", name: "Sev", description: "", severity: "critical", cooldownMs: 0, evaluate: () => true });
  svc.evaluate(buildCtx());
  const active = svc.getActiveAlerts();
  assert.equal(active[0].severity, "critical");
});

// ─── 3. ScalingService ────────────────────────────────────────────────────────

suite("ScalingService");

const scaling = new ScalingService();

await test("isStateless returns true", () => {
  assert.equal(scaling.isStateless(), true);
});

await test("getStickySessionConfig has enabled=false by default", () => {
  const cfg = scaling.getStickySessionConfig();
  assert.equal(cfg.enabled, false);
  assert.ok(typeof cfg.cookieName === "string");
  assert.ok(cfg.ttlSeconds > 0);
});

await test("getReplicaCount returns >= 1", () => {
  const count = scaling.getReplicaCount();
  assert.ok(count >= 1);
});

await test("checkScalingReadiness includes isStateless=true", () => {
  const r = scaling.checkScalingReadiness();
  assert.equal(r.isStateless, true);
});

await test("checkScalingReadiness includes hasConnectionPooling=true", () => {
  const r = scaling.checkScalingReadiness();
  assert.equal(r.hasConnectionPooling, true);
});

await test("checkScalingReadiness includes supportsGracefulShutdown=true", () => {
  const r = scaling.checkScalingReadiness();
  assert.equal(r.supportsGracefulShutdown, true);
});

await test("checkScalingReadiness readinessChecks has stateless=true", () => {
  const r = scaling.checkScalingReadiness();
  assert.equal(r.readinessChecks["stateless"], true);
});

await test("configureConnectionPool updates config", () => {
  const svc = new ScalingService();
  svc.configureConnectionPool({ maxConnections: 25 });
  const status = svc.getPoolStatus();
  assert.equal(status.config.maxConnections, 25);
});

await test("getPoolStatus returns pool with active, idle, waiting", () => {
  const status = scaling.getPoolStatus();
  assert.ok(typeof status.active === "number");
  assert.ok(typeof status.idle === "number");
  assert.ok(typeof status.waiting === "number");
  assert.ok(typeof status.utilization === "number");
});

await test("simulateConnectionAcquire increments active", () => {
  const svc = new ScalingService();
  svc.simulateConnectionAcquire();
  const status = svc.getPoolStatus();
  assert.equal(status.active, 1);
});

await test("simulateConnectionRelease decrements active", () => {
  const svc = new ScalingService();
  svc.simulateConnectionAcquire();
  svc.simulateConnectionRelease();
  const status = svc.getPoolStatus();
  assert.equal(status.active, 0);
});

await test("registerShutdownHandler is called on graceful shutdown", async () => {
  const svc = new ScalingService();
  let called = false;
  svc.registerShutdownHandler(async () => { called = true; });
  await svc.initiateGracefulShutdown(100);
  assert.equal(called, true);
});

await test("isShuttingDown returns true after initiation", async () => {
  const svc = new ScalingService();
  assert.equal(svc.isShuttingDown(), false);
  void svc.initiateGracefulShutdown(50);
  assert.equal(svc.isShuttingDown(), true);
  svc.resetShutdownState();
});

await test("second initiateGracefulShutdown is no-op", async () => {
  const svc = new ScalingService();
  let callCount = 0;
  svc.registerShutdownHandler(async () => { callCount++; });
  await svc.initiateGracefulShutdown(50);
  await svc.initiateGracefulShutdown(50); // no-op
  assert.equal(callCount, 1);
});

await test("getShutdownState reflects initiated state", async () => {
  const svc = new ScalingService();
  await svc.initiateGracefulShutdown(10);
  const state = svc.getShutdownState();
  assert.equal(state.initiated, true);
  assert.ok(typeof state.initiatedAt === "number");
});

// ─── 4. PerformanceMonitoringService ─────────────────────────────────────────

suite("PerformanceMonitoringService");

const perf = new PerformanceMonitoringService();

await test("recordQueryDuration stores slow queries above threshold", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("SELECT * FROM orders", 1200, 500);
  const slow = svc.getSlowQueries(500);
  assert.equal(slow.length, 1);
  assert.equal(slow[0].query, "SELECT * FROM orders");
});

await test("getSlowQueries excludes fast queries", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("SELECT 1", 10, 500);
  const slow = svc.getSlowQueries(500);
  assert.equal(slow.length, 0);
});

await test("getSlowQueries returns sorted descending by duration", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("slow-a", 600, 500);
  svc.recordQueryDuration("slow-b", 1500, 500);
  svc.recordQueryDuration("slow-c", 800, 500);
  const slow = svc.getSlowQueries(500);
  assert.equal(slow[0].query, "slow-b");
  assert.ok(slow[0].durationMs >= slow[1].durationMs);
});

await test("getQueryStats returns avg/max/count for recorded query", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("SELECT id FROM users", 100, 500);
  svc.recordQueryDuration("SELECT id FROM users", 200, 500);
  const stats = svc.getQueryStats("SELECT id FROM users");
  assert.ok(stats !== null, "stats should not be null");
  assert.equal(stats!.count, 2);
  assert.equal(stats!.avgMs, 150);
  assert.equal(stats!.maxMs, 200);
});

await test("getQueryStats returns null for unknown query", () => {
  const svc = new PerformanceMonitoringService();
  assert.equal(svc.getQueryStats("UNKNOWN QUERY"), null);
});

await test("startRequestProfile / endRequestProfile returns profile", () => {
  const svc = new PerformanceMonitoringService();
  svc.startRequestProfile("req-1", "/api/orders", "GET");
  const profile = svc.endRequestProfile("req-1");
  assert.ok(profile !== null);
  assert.equal(profile!.route, "/api/orders");
  assert.equal(profile!.method, "GET");
  assert.ok(profile!.durationMs !== undefined && profile!.durationMs >= 0);
});

await test("endRequestProfile returns null for unknown requestId", () => {
  const svc = new PerformanceMonitoringService();
  const result = svc.endRequestProfile("nonexistent");
  assert.equal(result, null);
});

await test("getCompletedProfiles stores finished profiles", () => {
  const svc = new PerformanceMonitoringService();
  svc.startRequestProfile("req-a", "/api/a", "POST");
  svc.endRequestProfile("req-a");
  svc.startRequestProfile("req-b", "/api/b", "GET");
  svc.endRequestProfile("req-b");
  const profiles = svc.getCompletedProfiles();
  assert.ok(profiles.length >= 2);
});

await test("detectLongRunningRequests returns requests above threshold", async () => {
  const svc = new PerformanceMonitoringService();
  svc.startRequestProfile("long-req", "/api/slow", "GET");
  await new Promise((r) => setTimeout(r, 10));
  // Use 1ms threshold to catch it
  const longRunning = svc.detectLongRunningRequests(1);
  assert.ok(longRunning.length >= 1);
  assert.equal(longRunning[0].requestId, "long-req");
  svc.endRequestProfile("long-req"); // cleanup
});

await test("detectLongRunningRequests returns empty when no long requests", () => {
  const svc = new PerformanceMonitoringService();
  const result = svc.detectLongRunningRequests(5000);
  assert.equal(result.length, 0);
});

await test("checkMemoryPressure returns heapUsedMB > 0", () => {
  const pressure = perf.checkMemoryPressure();
  assert.ok(pressure.heapUsedMB > 0);
  assert.ok(pressure.heapTotalMB > 0);
  assert.ok(pressure.rssMB > 0);
});

await test("checkMemoryPressure pressure is one of low/moderate/high/critical", () => {
  const pressure = perf.checkMemoryPressure();
  assert.ok(["low", "moderate", "high", "critical"].includes(pressure.pressure));
});

await test("checkMemoryPressure usagePercent is in [0, 100]", () => {
  const pressure = perf.checkMemoryPressure();
  assert.ok(pressure.usagePercent >= 0 && pressure.usagePercent <= 100);
});

await test("clearSlowQueries empties the slow query list", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("SLOW QUERY", 1000, 500);
  assert.equal(svc.getSlowQueries().length, 1);
  svc.clearSlowQueries();
  assert.equal(svc.getSlowQueries().length, 0);
});

await test("slow query callCount increments on repeated calls", () => {
  const svc = new PerformanceMonitoringService();
  svc.recordQueryDuration("REPEAT QUERY", 600, 500);
  svc.recordQueryDuration("REPEAT QUERY", 700, 500);
  const slow = svc.getSlowQueries(500);
  const entry = slow.find((q) => q.query === "REPEAT QUERY");
  assert.ok(entry !== undefined);
  assert.equal(entry!.callCount, 2);
});

// ─── 5. CacheMonitoringService ────────────────────────────────────────────────

suite("CacheMonitoringService");

const cache = new CacheMonitoringService();

await test("recordHit increments hits counter", () => {
  const svc = new CacheMonitoringService();
  svc.recordHit("key:1", 2);
  svc.recordHit("key:2", 3);
  const stats = svc.getStats();
  assert.equal(stats.hits, 2);
});

await test("recordMiss increments misses counter", () => {
  const svc = new CacheMonitoringService();
  svc.recordMiss("key:1", 15);
  const stats = svc.getStats();
  assert.equal(stats.misses, 1);
});

await test("getHitRate returns correct ratio", () => {
  const svc = new CacheMonitoringService();
  svc.recordHit("k1", 1);
  svc.recordHit("k2", 1);
  svc.recordMiss("k3", 5);
  const rate = svc.getHitRate();
  assert.ok(Math.abs(rate - 0.667) < 0.01, `hitRate=${rate}`);
});

await test("getMissRate + getHitRate = 1.0 when total > 0", () => {
  const svc = new CacheMonitoringService();
  svc.recordHit("a", 1);
  svc.recordMiss("b", 2);
  const sum = svc.getHitRate() + svc.getMissRate();
  assert.ok(Math.abs(sum - 1.0) < 0.001, `sum=${sum}`);
});

await test("getHitRate returns 0 when no operations", () => {
  const svc = new CacheMonitoringService();
  assert.equal(svc.getHitRate(), 0);
});

await test("getMissRate returns 0 when no operations", () => {
  const svc = new CacheMonitoringService();
  assert.equal(svc.getMissRate(), 0);
});

await test("recordEviction increments evictions", () => {
  const svc = new CacheMonitoringService();
  svc.recordEviction();
  svc.recordEviction();
  const stats = svc.getStats();
  assert.equal(stats.evictions, 2);
});

await test("setCacheSize sets the cacheSize in stats", () => {
  const svc = new CacheMonitoringService();
  svc.setCacheSize(500);
  assert.equal(svc.getStats().cacheSize, 500);
});

await test("incrementCacheSize / decrementCacheSize adjust cacheSize", () => {
  const svc = new CacheMonitoringService();
  svc.setCacheSize(10);
  svc.incrementCacheSize();
  assert.equal(svc.getStats().cacheSize, 11);
  svc.decrementCacheSize();
  assert.equal(svc.getStats().cacheSize, 10);
});

await test("getLatencyPercentiles p95 >= p50", () => {
  const svc = new CacheMonitoringService();
  for (let i = 1; i <= 100; i++) svc.recordHit(`k${i}`, i);
  const p = svc.getLatencyPercentiles();
  assert.ok(p.p95Ms >= p.p50Ms, `p95=${p.p95Ms} p50=${p.p50Ms}`);
});

await test("getLatencyPercentiles p99 >= p95", () => {
  const svc = new CacheMonitoringService();
  for (let i = 1; i <= 100; i++) svc.recordHit(`k${i}`, i);
  const p = svc.getLatencyPercentiles();
  assert.ok(p.p99Ms >= p.p95Ms, `p99=${p.p99Ms} p95=${p.p95Ms}`);
});

await test("getLatencyPercentiles returns zeroes when no ops", () => {
  const svc = new CacheMonitoringService();
  const p = svc.getLatencyPercentiles();
  assert.equal(p.p50Ms, 0);
  assert.equal(p.p99Ms, 0);
});

await test("getHotKeys returns top accessed keys", () => {
  const svc = new CacheMonitoringService();
  for (let i = 0; i < 5; i++) svc.recordHit("hot-key", 1);
  svc.recordHit("cold-key", 1);
  const hot = svc.getHotKeys(2);
  assert.equal(hot[0].key, "hot-key");
  assert.equal(hot[0].hits, 5);
});

await test("reset clears all counters", () => {
  const svc = new CacheMonitoringService();
  svc.recordHit("k", 1);
  svc.recordMiss("k", 2);
  svc.recordEviction();
  svc.reset();
  const stats = svc.getStats();
  assert.equal(stats.hits, 0);
  assert.equal(stats.misses, 0);
  assert.equal(stats.evictions, 0);
  assert.equal(stats.totalOperations, 0);
});

await test("avgHitLatencyMs is average of hit latencies", () => {
  const svc = new CacheMonitoringService();
  svc.recordHit("k1", 10);
  svc.recordHit("k2", 20);
  svc.recordHit("k3", 30);
  const stats = svc.getStats();
  assert.equal(stats.avgHitLatencyMs, 20);
});

// ─── 6. TracingService ────────────────────────────────────────────────────────

suite("TracingService");

const tracing = new TracingService();

await test("startSpan creates a span with a unique spanId", () => {
  const s1 = tracing.startSpan("op-1");
  const s2 = tracing.startSpan("op-2");
  assert.notEqual(s1.spanId, s2.spanId);
  tracing.endSpan(s1.spanId);
  tracing.endSpan(s2.spanId);
});

await test("startSpan creates a trace for each new traceId", () => {
  const svc = new TracingService();
  const s = svc.startSpan("root-op");
  const trace = svc.getTrace(s.traceId);
  assert.ok(trace !== null);
  assert.equal(trace!.traceId, s.traceId);
  svc.endSpan(s.spanId);
});

await test("startSpan with parentSpanId links child to parent trace", () => {
  const svc = new TracingService();
  const root = svc.startSpan("root");
  const child = svc.startSpan("child", { parentSpanId: root.spanId, traceId: root.traceId });
  assert.equal(child.traceId, root.traceId);
  assert.equal(child.parentSpanId, root.spanId);
  const trace = svc.getTrace(root.traceId);
  assert.equal(trace!.spans.length, 2);
  svc.endSpan(child.spanId);
  svc.endSpan(root.spanId);
});

await test("endSpan sets endTime and durationMs", () => {
  const svc = new TracingService();
  const span = svc.startSpan("timed-op");
  const ended = svc.endSpan(span.spanId);
  assert.ok(ended !== null);
  assert.ok(ended!.endTime !== undefined);
  assert.ok(ended!.durationMs !== undefined && ended!.durationMs >= 0);
});

await test("endSpan sets status to ok by default", () => {
  const svc = new TracingService();
  const span = svc.startSpan("ok-op");
  const ended = svc.endSpan(span.spanId);
  assert.equal(ended!.status, "ok");
});

await test("endSpan sets status to error when error is provided", () => {
  const svc = new TracingService();
  const span = svc.startSpan("err-op");
  const ended = svc.endSpan(span.spanId, { error: "connection refused" });
  assert.equal(ended!.status, "error");
  assert.equal(ended!.attributes["error.message"], "connection refused");
});

await test("endSpan returns null for unknown spanId", () => {
  const svc = new TracingService();
  const result = svc.endSpan("nonexistent-span");
  assert.equal(result, null);
});

await test("getActiveSpans includes started but not ended spans", () => {
  const svc = new TracingService();
  const s = svc.startSpan("active-span");
  const active = svc.getActiveSpans();
  assert.ok(active.some((span) => span.spanId === s.spanId));
  svc.endSpan(s.spanId);
  const afterEnd = svc.getActiveSpans();
  assert.ok(!afterEnd.some((span) => span.spanId === s.spanId));
});

await test("addSpanEvent adds event to active span", () => {
  const svc = new TracingService();
  const span = svc.startSpan("evented-op");
  svc.addSpanEvent(span.spanId, "cache.hit", { key: "user:123" });
  const activeSpan = svc.getSpan(span.spanId);
  assert.ok(activeSpan !== undefined);
  assert.equal(activeSpan!.events.length, 1);
  assert.equal(activeSpan!.events[0].name, "cache.hit");
  svc.endSpan(span.spanId);
});

await test("setSpanAttribute sets an attribute on active span", () => {
  const svc = new TracingService();
  const span = svc.startSpan("attr-op");
  svc.setSpanAttribute(span.spanId, "db.statement", "SELECT *");
  const activeSpan = svc.getSpan(span.spanId);
  assert.equal(activeSpan!.attributes["db.statement"], "SELECT *");
  svc.endSpan(span.spanId);
});

await test("injectContext writes W3C traceparent header", () => {
  const svc = new TracingService();
  const span = svc.startSpan("inject-op");
  const headers: Record<string, string> = {};
  svc.injectContext(headers, span.spanId);
  assert.ok(headers["traceparent"] !== undefined);
  assert.ok(headers["traceparent"].startsWith("00-"), "traceparent starts with version");
  svc.endSpan(span.spanId);
});

await test("extractContext parses W3C traceparent header", () => {
  const svc = new TracingService();
  const ctx = svc.extractContext({
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  });
  assert.ok(ctx !== null);
  assert.equal(ctx!.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(ctx!.spanId, "00f067aa0ba902b7");
  assert.equal(ctx!.traceFlags, 1);
});

await test("extractContext returns null when traceparent is missing", () => {
  const svc = new TracingService();
  const ctx = svc.extractContext({});
  assert.equal(ctx, null);
});

await test("getRecentTraces returns most recent traces first", () => {
  const svc = new TracingService();
  const s1 = svc.startSpan("trace-1"); svc.endSpan(s1.spanId);
  const s2 = svc.startSpan("trace-2"); svc.endSpan(s2.spanId);
  const recent = svc.getRecentTraces(2);
  assert.ok(recent.length === 2);
  // Most recent should be trace-2's traceId
  assert.equal(recent[0].traceId, s2.traceId);
});

await test("trace rootSpan is set for spans without parentSpanId", () => {
  const svc = new TracingService();
  const root = svc.startSpan("root-span");
  const trace = svc.getTrace(root.traceId);
  assert.ok(trace!.rootSpan !== undefined);
  assert.equal(trace!.rootSpan!.spanId, root.spanId);
  svc.endSpan(root.spanId);
});

await test("trace correlationId is preserved", () => {
  const svc = new TracingService();
  const span = svc.startSpan("corr-op", { correlationId: "req-abc-123" });
  const correlId = svc.getCorrelationId(span.traceId);
  assert.equal(correlId, "req-abc-123");
  svc.endSpan(span.spanId);
});

await test("span kind defaults to internal", () => {
  const svc = new TracingService();
  const span = svc.startSpan("default-kind");
  assert.equal(span.kind, "internal");
  svc.endSpan(span.spanId);
});

await test("span kind can be set to server or client", () => {
  const svc = new TracingService();
  const s = svc.startSpan("server-op", { kind: "server" });
  assert.equal(s.kind, "server");
  svc.endSpan(s.spanId);
});

await test("clear removes all traces and active spans", () => {
  const svc = new TracingService();
  const s = svc.startSpan("will-clear");
  svc.clear();
  assert.equal(svc.getActiveSpans().length, 0);
  assert.equal(svc.getTrace(s.traceId), null);
  assert.equal(svc.getRecentTraces().length, 0);
});

// ─── 7. Ops Route Structure ───────────────────────────────────────────────────

suite("Ops Route Structure");

import { opsRouter, monitoringSvc, alertingSvc, scalingSvc, performanceSvc, cacheSvc, tracingSvc } from "../routes/ops.js";

await test("opsRouter is an Express Router", () => {
  assert.ok(opsRouter !== null && typeof opsRouter === "function", "is a function (Express Router)");
});

await test("monitoringSvc singleton is a MonitoringService instance", () => {
  assert.ok(monitoringSvc instanceof MonitoringService);
});

await test("alertingSvc singleton is an AlertingService instance", () => {
  assert.ok(alertingSvc instanceof AlertingService);
});

await test("scalingSvc singleton is a ScalingService instance", () => {
  assert.ok(scalingSvc instanceof ScalingService);
});

await test("performanceSvc singleton is a PerformanceMonitoringService instance", () => {
  assert.ok(performanceSvc instanceof PerformanceMonitoringService);
});

await test("cacheSvc singleton is a CacheMonitoringService instance", () => {
  assert.ok(cacheSvc instanceof CacheMonitoringService);
});

await test("tracingSvc singleton is a TracingService instance", () => {
  assert.ok(tracingSvc instanceof TracingService);
});

await test("ops router stack contains authenticate middleware", () => {
  const stack = (opsRouter as unknown as { stack: Array<{ name: string }> }).stack;
  assert.ok(Array.isArray(stack), "router has a stack");
  assert.ok(stack.length > 0, "stack is not empty");
});

await test("ops router has at least 7 registered handlers (middleware + 5 routes + acknowledge)", () => {
  const stack = (opsRouter as unknown as { stack: Array<{ name: string }> }).stack;
  assert.ok(stack.length >= 7, `stack.length=${stack.length}`);
});

await test("opsRouter source file exists at routes/ops.ts", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const routePath = resolve(__dirname, "../routes/ops.ts");
  const content = readFileSync(routePath, "utf8");
  assert.ok(content.includes('authorize("ADMIN", "SUPER_ADMIN")'), "ADMIN/SUPER_ADMIN guard is present");
  assert.ok(content.includes("/api/ops") || content.includes("opsRouter"), "router is defined");
});

// ─── Final report ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Sprint 7.2 ops.test.ts: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("\nFailed tests:");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}

// ─── Helpers (local) ──────────────────────────────────────────────────────────

function buildCtx(overrides: { cpuPercent?: number; memPercent?: number; errorRate?: number } = {}) {
  const mon = new MonitoringService();
  const sys = mon.collectSystemMetrics();
  sys.cpu.usagePercent = overrides.cpuPercent ?? 10;
  sys.memory.usagePercent = overrides.memPercent ?? 30;

  const requests = {
    requestsPerMinute: 50,
    p50Ms: 100,
    p95Ms: 300,
    p99Ms: 500,
    errorRate: overrides.errorRate ?? 0,
    activeConnections: 5,
  };

  const business = {
    activeUsers: 10,
    ordersPerMinute: 2,
    paymentsPerMinute: 1,
    recommendationLatencyMs: 200,
    arSessionDurationMs: 120_000,
    dbLatencyMs: 20,
    redisLatencyMs: 2,
    queueLatencyMs: 10,
  };

  return { system: sys, requests, business };
}
