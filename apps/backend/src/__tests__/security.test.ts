/**
 * Sprint 7.3 — Production Security Hardening & Performance Optimization
 *
 * Tests: SecurityAuditService, PerformanceOptimizationService, RateLimitService,
 *        SecretsValidationService, BackupValidationService, RecoveryService,
 *        and the /api/security route structure.
 */

import assert from "node:assert/strict";

import { SecurityAuditService } from "../services/security-audit.service.js";
import { PerformanceOptimizationService } from "../services/performance-optimization.service.js";
import { RateLimitService } from "../services/rate-limit.service.js";
import { SecretsValidationService } from "../services/secrets-validation.service.js";
import { BackupValidationService } from "../services/backup-validation.service.js";
import { RecoveryService } from "../services/recovery.service.js";

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${name}\n      ${msg}`);
      failed++;
      failures.push(`${name}: ${msg}`);
    });
}

function suite(name: string): void { console.log(`\n${name}`); }

// ─── 1. SecurityAuditService ──────────────────────────────────────────────────

suite("SecurityAuditService");

const audit = new SecurityAuditService();

await test("runAudit returns a report with findings", () => {
  const report = audit.runAudit();
  assert.ok(report.findings.length > 0, "should have findings");
});

await test("report has summary with total count matching findings", () => {
  const report = audit.runAudit();
  assert.equal(report.summary.total, report.findings.length);
});

await test("report score is in [0, 100]", () => {
  const report = audit.runAudit();
  assert.ok(report.score >= 0 && report.score <= 100, `score=${report.score}`);
});

await test("report has runAt timestamp", () => {
  const before = Date.now();
  const report = audit.runAudit();
  assert.ok(report.runAt >= before);
});

await test("report durationMs is >= 0", () => {
  const report = audit.runAudit();
  assert.ok(report.durationMs >= 0);
});

await test("findings include header category checks", () => {
  const report = audit.runAudit();
  const headerFindings = report.findings.filter((f) => f.category === "headers");
  assert.ok(headerFindings.length >= 3, `headerFindings=${headerFindings.length}`);
});

await test("findings include authentication checks", () => {
  const report = audit.runAudit();
  const authFindings = report.findings.filter((f) => f.category === "authentication");
  assert.ok(authFindings.length >= 3, `authFindings=${authFindings.length}`);
});

await test("findings include authorization checks", () => {
  const report = audit.runAudit();
  const authzFindings = report.findings.filter((f) => f.category === "authorization");
  assert.ok(authzFindings.length >= 3, `authzFindings=${authzFindings.length}`);
});

await test("findings include injection protection checks", () => {
  const report = audit.runAudit();
  const injFindings = report.findings.filter((f) => f.category === "injection");
  assert.ok(injFindings.length >= 3, `injFindings=${injFindings.length}`);
});

await test("findings include XSS protection checks", () => {
  const report = audit.runAudit();
  const xssFindings = report.findings.filter((f) => f.category === "xss");
  assert.ok(xssFindings.length >= 2, `xssFindings=${xssFindings.length}`);
});

await test("findings include CSRF checks", () => {
  const report = audit.runAudit();
  const csrfFindings = report.findings.filter((f) => f.category === "csrf");
  assert.ok(csrfFindings.length >= 2, `csrfFindings=${csrfFindings.length}`);
});

await test("findings include session checks", () => {
  const report = audit.runAudit();
  const sessionFindings = report.findings.filter((f) => f.category === "session");
  assert.ok(sessionFindings.length >= 2);
});

await test("findings include rate-limiting checks", () => {
  const report = audit.runAudit();
  const rlFindings = report.findings.filter((f) => f.category === "rate-limiting");
  assert.ok(rlFindings.length >= 3);
});

await test("findings include secrets checks", () => {
  const report = audit.runAudit();
  const secFindings = report.findings.filter((f) => f.category === "secrets");
  assert.ok(secFindings.length >= 2);
});

await test("findings include dependency checks", () => {
  const report = audit.runAudit();
  const depFindings = report.findings.filter((f) => f.category === "dependencies");
  assert.ok(depFindings.length >= 2);
});

await test("summary passed + failed + warnings + skipped = total", () => {
  const report = audit.runAudit();
  const s = report.summary;
  assert.equal(s.passed + s.failed + s.warnings + s.skipped, s.total);
});

await test("summary bySeverity counts all findings", () => {
  const report = audit.runAudit();
  const s = report.summary;
  const sevTotal = Object.values(s.bySeverity).reduce((a, b) => a + b, 0);
  assert.equal(sevTotal, s.total);
});

await test("every finding has an id, category, severity, title, status", () => {
  const report = audit.runAudit();
  for (const f of report.findings) {
    assert.ok(f.id, `finding missing id`);
    assert.ok(f.category, `finding ${f.id} missing category`);
    assert.ok(f.severity, `finding ${f.id} missing severity`);
    assert.ok(f.title, `finding ${f.id} missing title`);
    assert.ok(["pass", "fail", "warning", "skip"].includes(f.status), `finding ${f.id} invalid status=${f.status}`);
  }
});

await test("getLastReport returns the most recent report", () => {
  const svc = new SecurityAuditService();
  assert.equal(svc.getLastReport(), null);
  svc.runAudit();
  assert.ok(svc.getLastReport() !== null);
});

await test("getFindings by category filters correctly", () => {
  const svc = new SecurityAuditService();
  svc.runAudit();
  const headers = svc.getFindings({ category: "headers" });
  assert.ok(headers.length > 0);
  assert.ok(headers.every((f) => f.category === "headers"));
});

await test("getFindings by status filters correctly", () => {
  const svc = new SecurityAuditService();
  svc.runAudit();
  const passes = svc.getFindings({ status: "pass" });
  assert.ok(passes.every((f) => f.status === "pass"));
});

await test("addCustomCheck includes custom findings in report", () => {
  const svc = new SecurityAuditService();
  svc.addCustomCheck(() => [{
    id: "CUSTOM-001",
    category: "authentication",
    severity: "info",
    title: "Custom Check",
    description: "A custom audit check.",
    recommendation: "None.",
    status: "pass",
  }]);
  const report = svc.runAudit();
  assert.ok(report.findings.some((f) => f.id === "CUSTOM-001"));
});

// ─── 2. PerformanceOptimizationService ───────────────────────────────────────

suite("PerformanceOptimizationService");

const perf = new PerformanceOptimizationService();

await test("takeSnapshot returns memory snapshot", () => {
  const snap = perf.takeSnapshot();
  assert.ok(snap.heapUsedMB > 0);
  assert.ok(snap.heapTotalMB > 0);
  assert.ok(snap.rssMB > 0);
  assert.ok(snap.uptimeSeconds >= 0);
});

await test("getSnapshots accumulates snapshots", () => {
  perf.takeSnapshot();
  perf.takeSnapshot();
  assert.ok(perf.getSnapshots().length >= 2);
});

await test("getMemoryTrend returns stable/growing/shrinking", () => {
  const trend = perf.getMemoryTrend();
  assert.ok(["stable", "growing", "shrinking"].includes(trend), `trend=${trend}`);
});

await test("getRecommendations returns a non-empty list", () => {
  const recs = perf.getRecommendations();
  assert.ok(recs.length > 0);
});

await test("getRecommendations filter by area works", () => {
  const recs = perf.getRecommendations({ area: "database" });
  assert.ok(recs.length > 0);
  assert.ok(recs.every((r) => r.area === "database"));
});

await test("getRecommendations filter by implemented=true shows implemented", () => {
  const recs = perf.getRecommendations({ implemented: true });
  assert.ok(recs.length > 0);
  assert.ok(recs.every((r) => r.implemented === true));
});

await test("getRecommendations filter by implemented=false shows pending", () => {
  const recs = perf.getRecommendations({ implemented: false });
  assert.ok(recs.length > 0);
  assert.ok(recs.every((r) => r.implemented === false));
});

await test("every recommendation has id, area, priority, effort, title", () => {
  const recs = perf.getRecommendations();
  for (const r of recs) {
    assert.ok(r.id, `missing id`);
    assert.ok(r.area, `${r.id} missing area`);
    assert.ok(["critical", "high", "medium", "low"].includes(r.priority), `${r.id} invalid priority`);
    assert.ok(["low", "medium", "high"].includes(r.effort), `${r.id} invalid effort`);
    assert.ok(r.title, `${r.id} missing title`);
  }
});

await test("getQueryHints returns query optimization hints", () => {
  const hints = perf.getQueryHints();
  assert.ok(hints.length > 0);
  assert.ok(hints.every((h) => h.pattern && h.issue && h.suggestion && h.severity));
});

await test("evaluateCacheEffectiveness returns excellent for 0.95 hitRate", () => {
  const result = perf.evaluateCacheEffectiveness(0.95);
  assert.ok(result.recommendation.toLowerCase().includes("excellent"));
});

await test("evaluateCacheEffectiveness returns low hit rate warning for 0.3", () => {
  const result = perf.evaluateCacheEffectiveness(0.3);
  assert.ok(result.recommendation.toLowerCase().includes("low"));
});

await test("evaluateCacheEffectiveness hitRate + missRate = 1", () => {
  const result = perf.evaluateCacheEffectiveness(0.7);
  assert.ok(Math.abs(result.hitRate + result.missRate - 1) < 0.001);
});

await test("generateReport score is in [0, 100]", () => {
  const report = perf.generateReport();
  assert.ok(report.score >= 0 && report.score <= 100, `score=${report.score}`);
});

await test("generateReport summary implemented + pending = total", () => {
  const report = perf.generateReport();
  assert.equal(report.summary.implemented + report.summary.pending, report.summary.total);
});

await test("addRecommendation adds custom recommendation", () => {
  const svc = new PerformanceOptimizationService();
  svc.addRecommendation({
    id: "CUSTOM-PERF-001",
    area: "memory",
    priority: "high",
    title: "Custom Memory Rec",
    description: "Test custom recommendation.",
    impact: "Major.",
    effort: "low",
    implemented: false,
  });
  const recs = svc.getRecommendations();
  assert.ok(recs.some((r) => r.id === "CUSTOM-PERF-001"));
});

// ─── 3. RateLimitService ──────────────────────────────────────────────────────

suite("RateLimitService");

const rl = new RateLimitService(true);

await test("default rules include global, auth, api, checkout, recommendations", () => {
  const ids = rl.getRules().map((r) => r.id);
  assert.ok(ids.includes("global"), "global");
  assert.ok(ids.includes("auth"), "auth");
  assert.ok(ids.includes("api"), "api");
  assert.ok(ids.includes("checkout"), "checkout");
  assert.ok(ids.includes("recommendations"), "recommendations");
});

await test("addRule registers a custom rule", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "test-rule", route: "/api/test", method: "GET", maxRequests: 10, windowMs: 60_000, description: "test", enabled: true });
  assert.ok(svc.getRule("test-rule") !== undefined);
});

await test("removeRule deletes the rule", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "rem", route: "/", method: "*", maxRequests: 10, windowMs: 60_000, description: "", enabled: true });
  svc.removeRule("rem");
  assert.equal(svc.getRule("rem"), undefined);
});

await test("checkLimit allows requests below the limit", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "rl-test", route: "/api/test", method: "*", maxRequests: 5, windowMs: 60_000, description: "", enabled: true });
  const result = svc.checkLimit("127.0.0.1", "rl-test");
  assert.equal(result.allowed, true);
  assert.ok(result.remaining >= 0);
});

await test("checkLimit blocks requests over the limit", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "tiny-limit", route: "/api/tiny", method: "*", maxRequests: 2, windowMs: 60_000, description: "", enabled: true });
  svc.checkLimit("1.2.3.4", "tiny-limit");
  svc.checkLimit("1.2.3.4", "tiny-limit");
  const result = svc.checkLimit("1.2.3.4", "tiny-limit"); // 3rd request
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

await test("allowlisted IP is always allowed regardless of limit", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "strict", route: "/api/x", method: "*", maxRequests: 1, windowMs: 60_000, description: "", enabled: true });
  svc.addToAllowlist("10.0.0.1");
  svc.checkLimit("10.0.0.1", "strict");
  const result = svc.checkLimit("10.0.0.1", "strict"); // would normally be blocked
  assert.equal(result.allowed, true);
});

await test("denylisted IP is always blocked", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "open-rule", route: "/api/y", method: "*", maxRequests: 1000, windowMs: 60_000, description: "", enabled: true });
  svc.addToDenylist("99.99.99.99");
  const result = svc.checkLimit("99.99.99.99", "open-rule");
  assert.equal(result.allowed, false);
});

await test("addToAllowlist / removeFromAllowlist works correctly", () => {
  const svc = new RateLimitService(false);
  svc.addToAllowlist("5.5.5.5");
  assert.equal(svc.isAllowlisted("5.5.5.5"), true);
  svc.removeFromAllowlist("5.5.5.5");
  assert.equal(svc.isAllowlisted("5.5.5.5"), false);
});

await test("addToDenylist / removeFromDenylist works correctly", () => {
  const svc = new RateLimitService(false);
  svc.addToDenylist("6.6.6.6");
  assert.equal(svc.isDenylisted("6.6.6.6"), true);
  svc.removeFromDenylist("6.6.6.6");
  assert.equal(svc.isDenylisted("6.6.6.6"), false);
});

await test("allowlisting an IP removes it from denylist", () => {
  const svc = new RateLimitService(false);
  svc.addToDenylist("7.7.7.7");
  svc.addToAllowlist("7.7.7.7");
  assert.equal(svc.isDenylisted("7.7.7.7"), false);
  assert.equal(svc.isAllowlisted("7.7.7.7"), true);
});

await test("configureAdaptiveThrottling enables adaptive mode", () => {
  const svc = new RateLimitService(false);
  svc.configureAdaptiveThrottling({ enabled: true, cpuThreshold: 70, memoryThreshold: 80, throttleMultiplier: 0.5 });
  const cfg = svc.getAdaptiveConfig();
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.cpuThreshold, 70);
});

await test("getEffectiveLimit reduces limit under high CPU load", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "adaptive-rule", route: "/api/adaptive", method: "*", maxRequests: 100, windowMs: 60_000, description: "", enabled: true });
  svc.configureAdaptiveThrottling({ enabled: true, cpuThreshold: 70, memoryThreshold: 80, throttleMultiplier: 0.5 });
  const normalLimit = svc.getEffectiveLimit("adaptive-rule", 30);
  const throttledLimit = svc.getEffectiveLimit("adaptive-rule", 90); // CPU > 70%
  assert.ok(throttledLimit < normalLimit, `throttled=${throttledLimit} normal=${normalLimit}`);
});

await test("getEffectiveLimit returns full limit when adaptive is disabled", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "no-adaptive", route: "/api/z", method: "*", maxRequests: 50, windowMs: 60_000, description: "", enabled: true });
  const limit = svc.getEffectiveLimit("no-adaptive", 99);
  assert.equal(limit, 50);
});

await test("disableRule prevents checkLimit from blocking", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "disabled-rule", route: "/api/d", method: "*", maxRequests: 1, windowMs: 60_000, description: "", enabled: true });
  svc.disableRule("disabled-rule");
  svc.checkLimit("2.2.2.2", "disabled-rule");
  const result = svc.checkLimit("2.2.2.2", "disabled-rule"); // would normally block
  assert.equal(result.allowed, true);
});

await test("getStats returns stats for known rule", () => {
  const svc = new RateLimitService(false);
  svc.addRule({ id: "stats-rule", route: "/api/stats", method: "GET", maxRequests: 100, windowMs: 60_000, description: "", enabled: true });
  svc.checkLimit("3.3.3.3", "stats-rule");
  const stats = svc.getStats("stats-rule");
  assert.ok(stats !== null);
  assert.ok(stats!.totalHits >= 1);
});

await test("getAllStats returns stats for all rules", () => {
  const stats = rl.getAllStats();
  assert.ok(stats.length >= 3);
});

// ─── 4. SecretsValidationService ─────────────────────────────────────────────

suite("SecretsValidationService");

const secrets = new SecretsValidationService();

await test("validateJwtSecret returns missing for undefined", () => {
  const result = secrets.validateJwtSecret(undefined);
  assert.equal(result.status, "missing");
});

await test("validateJwtSecret returns invalid for short secret", () => {
  const result = secrets.validateJwtSecret("tooshort");
  assert.equal(result.status, "invalid");
});

await test("validateJwtSecret returns weak for common words", () => {
  const result = secrets.validateJwtSecret("password_123456789_changeme_secret_etc");
  assert.equal(result.status, "weak");
});

await test("validateJwtSecret returns valid for strong secret", () => {
  // No weak substrings (password/secret/changeme/admin/test/12345/qwerty/letmein/welcome/abc123)
  const strong = "ZxWvY7k3!mNpRqS9#tUvJ2@wEfGh0*bKdLm4^nOpQ_vRsT";
  const result = secrets.validateJwtSecret(strong);
  assert.equal(result.status, "valid");
});

await test("validateJwtSecret includes entropy in result for long secrets", () => {
  const result = secrets.validateJwtSecret("ZxWvY7k3!mNpRqS9#tUvJ2@wEfGh0*bKdLm4^nOpQ_vRsT");
  assert.ok(result.entropy !== undefined && result.entropy > 0);
});

await test("validateDatabaseUrl returns missing for undefined", () => {
  const result = secrets.validateDatabaseUrl(undefined);
  assert.equal(result.status, "missing");
});

await test("validateDatabaseUrl returns invalid for non-postgres URL", () => {
  const result = secrets.validateDatabaseUrl("mysql://localhost/db");
  assert.equal(result.status, "invalid");
});

await test("validateDatabaseUrl returns valid for postgresql:// URL", () => {
  const result = secrets.validateDatabaseUrl("postgresql://user:pass@host:5432/db?pgbouncer=true");
  assert.equal(result.status, "valid");
});

await test("validateDatabaseUrl returns valid for postgres:// URL", () => {
  const result = secrets.validateDatabaseUrl("postgres://user:pass@remote-host:5432/mydb");
  assert.equal(result.status, "valid");
});

await test("validateEnvVars identifies missing required vars", () => {
  const svc = new SecretsValidationService();
  const result = svc.validateEnvVars();
  assert.ok(Array.isArray(result.missing));
  assert.ok(Array.isArray(result.present));
  assert.ok(result.required.length > 0);
});

await test("validateEnvVars allRequiredPresent is boolean", () => {
  const result = secrets.validateEnvVars();
  assert.ok(typeof result.allRequiredPresent === "boolean");
});

await test("runReport returns a SecretsReport", () => {
  const report = secrets.runReport();
  assert.ok(report.generatedAt > 0);
  assert.ok(Array.isArray(report.secrets));
  assert.ok(["healthy", "degraded", "critical"].includes(report.overallStatus));
});

await test("runReport criticalCount is non-negative", () => {
  const report = secrets.runReport();
  assert.ok(report.criticalCount >= 0);
});

await test("runReport warningCount is non-negative", () => {
  const report = secrets.runReport();
  assert.ok(report.warningCount >= 0);
});

await test("getLastReport returns stored report after runReport", () => {
  const svc = new SecretsValidationService();
  assert.equal(svc.getLastReport(), null);
  svc.runReport();
  assert.ok(svc.getLastReport() !== null);
});

await test("recordSecretRotation / getLastRotation tracks rotation time", () => {
  const before = Date.now();
  secrets.recordSecretRotation("JWT_SECRET");
  const rotatedAt = secrets.getLastRotation("JWT_SECRET");
  assert.ok(rotatedAt !== null && rotatedAt >= before);
});

await test("getLastRotation returns null for unknown secret", () => {
  assert.equal(secrets.getLastRotation("UNKNOWN_SECRET"), null);
});

// ─── 5. BackupValidationService ───────────────────────────────────────────────

suite("BackupValidationService");

const backup = new BackupValidationService();

await test("simulateFullBackup creates a completed backup record", () => {
  const rec = backup.simulateFullBackup();
  assert.equal(rec.type, "full");
  assert.equal(rec.status, "completed");
  assert.ok(rec.id.startsWith("backup-"));
  assert.ok(rec.checksum !== undefined && rec.checksum.length === 64);
});

await test("simulateIncrementalBackup creates incremental backup", () => {
  const rec = backup.simulateIncrementalBackup();
  assert.equal(rec.type, "incremental");
  assert.equal(rec.status, "completed");
});

await test("recordFailedBackup creates a failed backup record", () => {
  const rec = backup.recordFailedBackup("full", "Disk full");
  assert.equal(rec.status, "failed");
  assert.equal(rec.errorMessage, "Disk full");
});

await test("validateBackup passes for a healthy completed backup", () => {
  const svc = new BackupValidationService();
  const rec = svc.simulateFullBackup();
  const result = svc.validateBackup(rec.id);
  assert.equal(result.valid, true);
  assert.equal(result.checksumMatch, true);
  assert.equal(result.readable, true);
  assert.equal(result.issues.length, 0);
});

await test("validateBackup fails for unknown backupId", () => {
  const svc = new BackupValidationService();
  const result = svc.validateBackup("nonexistent-backup");
  assert.equal(result.valid, false);
  assert.ok(result.issues.length > 0);
});

await test("validateBackup fails for failed backup status", () => {
  const svc = new BackupValidationService();
  const rec = svc.recordFailedBackup("incremental", "Network error");
  const result = svc.validateBackup(rec.id);
  assert.equal(result.readable, false);
  assert.ok(result.issues.some((i) => i.includes("failed")));
});

await test("getBackups filter by type works", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  svc.simulateIncrementalBackup();
  const fulls = svc.getBackups({ type: "full" });
  assert.ok(fulls.every((b) => b.type === "full"));
});

await test("getBackups returns sorted by startedAt descending", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  svc.simulateIncrementalBackup();
  const all = svc.getBackups();
  if (all.length >= 2) {
    assert.ok(all[0].startedAt >= all[1].startedAt);
  }
});

await test("getLastBackup returns most recent completed backup of type", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  const last = svc.getLastBackup("full");
  assert.ok(last !== null);
  assert.equal(last!.type, "full");
  assert.equal(last!.status, "completed");
});

await test("getLastBackup returns null when no backup of that type", () => {
  const svc = new BackupValidationService();
  const last = svc.getLastBackup("wal");
  assert.equal(last, null);
});

await test("generateComplianceReport includes rpoCompliant field", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  const report = svc.generateComplianceReport();
  assert.ok(typeof report.rpoCompliant === "boolean");
});

await test("generateComplianceReport shows issues when no backups", () => {
  const svc = new BackupValidationService();
  const report = svc.generateComplianceReport();
  assert.ok(report.issues.length > 0, "should have issues without any backups");
});

await test("generateComplianceReport rpoCompliant is true with fresh full backup", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  const report = svc.generateComplianceReport();
  assert.equal(report.rpoCompliant, true);
});

await test("configurePolicy updates backup policy", () => {
  const svc = new BackupValidationService();
  svc.configurePolicy({ retentionMs: 7 * 24 * 60 * 60 * 1000 });
  const policy = svc.getPolicy();
  assert.equal(policy.retentionMs, 7 * 24 * 60 * 60 * 1000);
});

await test("clearBackups empties the backup list", () => {
  const svc = new BackupValidationService();
  svc.simulateFullBackup();
  svc.clearBackups();
  assert.equal(svc.getBackups().length, 0);
});

// ─── 6. RecoveryService ───────────────────────────────────────────────────────

suite("RecoveryService");

const recovery = new RecoveryService(true);

await test("default circuit breakers include database, redis, payment", () => {
  const names = recovery.getAllCircuitBreakers().map((cb) => cb.name);
  assert.ok(names.includes("database"), "database");
  assert.ok(names.includes("redis"), "redis");
  assert.ok(names.includes("payment"), "payment");
});

await test("circuit breaker starts in closed state", () => {
  const cb = recovery.getCircuitBreaker("database");
  assert.equal(cb?.state, "closed");
});

await test("recordFailure increments failureCount", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "test-cb", threshold: 3, cooldownMs: 1_000 });
  svc.recordFailure("test-cb");
  svc.recordFailure("test-cb");
  const cb = svc.getCircuitBreaker("test-cb");
  assert.equal(cb?.failureCount, 2);
  assert.equal(cb?.state, "closed");
});

await test("recordFailure opens circuit after threshold failures", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "trip-cb", threshold: 2, cooldownMs: 5_000 });
  svc.recordFailure("trip-cb");
  const state = svc.recordFailure("trip-cb"); // threshold reached
  assert.equal(state, "open");
  assert.equal(svc.getCircuitBreaker("trip-cb")?.state, "open");
});

await test("recordSuccess in half-open closes circuit after enough successes", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "recover-cb", threshold: 2, cooldownMs: 0, halfOpenSuccessesRequired: 2 });
  svc.recordFailure("recover-cb");
  svc.recordFailure("recover-cb"); // opens
  svc.attemptReset("recover-cb"); // moves to half-open (cooldown=0)
  svc.recordSuccess("recover-cb");
  svc.recordSuccess("recover-cb"); // 2 successes — should close
  assert.equal(svc.getCircuitBreaker("recover-cb")?.state, "closed");
});

await test("isAllowed returns false for open circuit", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "blocked-cb", threshold: 1, cooldownMs: 60_000 });
  svc.recordFailure("blocked-cb");
  assert.equal(svc.isAllowed("blocked-cb"), false);
});

await test("isAllowed returns true for closed circuit", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "open-cb", threshold: 5, cooldownMs: 60_000 });
  assert.equal(svc.isAllowed("open-cb"), true);
});

await test("forceOpen sets circuit to open state", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "force-cb", threshold: 100, cooldownMs: 60_000 });
  svc.forceOpen("force-cb");
  assert.equal(svc.getCircuitBreaker("force-cb")?.state, "open");
});

await test("forceClose resets circuit to closed state", () => {
  const svc = new RecoveryService(false);
  svc.registerCircuitBreaker({ name: "close-cb", threshold: 1, cooldownMs: 60_000 });
  svc.recordFailure("close-cb"); // opens it
  svc.forceClose("close-cb");
  assert.equal(svc.getCircuitBreaker("close-cb")?.state, "closed");
  assert.equal(svc.getCircuitBreaker("close-cb")?.failureCount, 0);
});

await test("default retry policies include database and redis", () => {
  const svc = new RecoveryService(true);
  assert.ok(svc.getRetryPolicy("database") !== undefined);
  assert.ok(svc.getRetryPolicy("redis") !== undefined);
  assert.ok(svc.getRetryPolicy("external-api") !== undefined);
  assert.ok(svc.getRetryPolicy("payment") !== undefined);
});

await test("computeDelay returns increasing delays for higher attempts", () => {
  const svc = new RecoveryService(true);
  const d1 = svc.computeDelay("database", 1);
  const d3 = svc.computeDelay("database", 3);
  assert.ok(d3 >= d1, `d3=${d3} d1=${d1}`);
});

await test("computeDelay does not exceed maxDelayMs", () => {
  const svc = new RecoveryService(true);
  const policy = svc.getRetryPolicy("database");
  for (let i = 1; i <= 10; i++) {
    const delay = svc.computeDelay("database", i);
    assert.ok(delay <= policy!.maxDelayMs, `attempt ${i}: delay=${delay} > maxDelay=${policy!.maxDelayMs}`);
  }
});

await test("triggerFailover returns false when autoFailover=false", () => {
  const svc = new RecoveryService(false);
  svc.registerFailover({
    service: "db",
    primary: "primary-host",
    secondary: "secondary-host",
    status: "primary",
    lastCheckedAt: Date.now(),
    autoFailover: false,
    healthCheckIntervalMs: 30_000,
  });
  const result = svc.triggerFailover("db");
  assert.equal(result, false);
});

await test("triggerFailover returns true when autoFailover=true", () => {
  const svc = new RecoveryService(false);
  svc.registerFailover({
    service: "cache",
    primary: "redis-primary",
    secondary: "redis-secondary",
    status: "primary",
    lastCheckedAt: Date.now(),
    autoFailover: true,
    healthCheckIntervalMs: 10_000,
  });
  const result = svc.triggerFailover("cache");
  assert.equal(result, true);
  assert.equal(svc.getFailoverStatus("cache")?.status, "failover");
});

await test("restorePrimary sets failover config back to primary", () => {
  const svc = new RecoveryService(false);
  svc.registerFailover({
    service: "search",
    primary: "p",
    secondary: "s",
    status: "failover",
    lastCheckedAt: Date.now(),
    autoFailover: true,
    healthCheckIntervalMs: 30_000,
  });
  svc.restorePrimary("search");
  assert.equal(svc.getFailoverStatus("search")?.status, "primary");
});

await test("validateGracefulRestart returns a result with required fields", () => {
  const result = recovery.validateGracefulRestart();
  assert.ok(typeof result.canRestartGracefully === "boolean");
  assert.ok(typeof result.shutdownTimeoutMs === "number");
  assert.ok(Array.isArray(result.issues));
});

await test("validateDisasterRecovery with default CBs has no critical issues", () => {
  const result = recovery.validateDisasterRecovery();
  assert.equal(result.databaseFailoverReady, true);
  assert.equal(result.redisFailoverReady, true);
  assert.ok(result.rtoHours > 0);
  assert.ok(result.rpoHours > 0);
});

await test("generateReport overallHealth is healthy/degraded/critical", () => {
  const report = recovery.generateReport();
  assert.ok(["healthy", "degraded", "critical"].includes(report.overallHealth));
});

await test("generateReport includes circuitBreakers, retryPolicies, failoverConfigs", () => {
  const report = recovery.generateReport();
  assert.ok(Array.isArray(report.circuitBreakers));
  assert.ok(Array.isArray(report.retryPolicies));
  assert.ok(Array.isArray(report.failoverConfigs));
  assert.ok(report.circuitBreakers.length >= 4);
  assert.ok(report.retryPolicies.length >= 4);
});

// ─── 7. Security Route Structure ─────────────────────────────────────────────

suite("Security Route Structure");

import {
  securityRouter,
  securityAuditSvc,
  perfOptimizationSvc,
  rateLimitSvc,
  secretsValidationSvc,
  backupValidationSvc,
  recoverySvc,
} from "../routes/security.js";

await test("securityRouter is an Express Router", () => {
  assert.ok(typeof securityRouter === "function");
});

await test("securityAuditSvc singleton is a SecurityAuditService", () => {
  assert.ok(securityAuditSvc instanceof SecurityAuditService);
});

await test("perfOptimizationSvc singleton is a PerformanceOptimizationService", () => {
  assert.ok(perfOptimizationSvc instanceof PerformanceOptimizationService);
});

await test("rateLimitSvc singleton is a RateLimitService", () => {
  assert.ok(rateLimitSvc instanceof RateLimitService);
});

await test("secretsValidationSvc singleton is a SecretsValidationService", () => {
  assert.ok(secretsValidationSvc instanceof SecretsValidationService);
});

await test("backupValidationSvc singleton is a BackupValidationService", () => {
  assert.ok(backupValidationSvc instanceof BackupValidationService);
});

await test("recoverySvc singleton is a RecoveryService", () => {
  assert.ok(recoverySvc instanceof RecoveryService);
});

await test("security router stack has handlers", () => {
  const stack = (securityRouter as unknown as { stack: unknown[] }).stack;
  assert.ok(Array.isArray(stack) && stack.length > 0);
});

await test("security router enforces ADMIN/SUPER_ADMIN in source", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(__dirname, "../routes/security.ts"), "utf8");
  assert.ok(content.includes('authorize("ADMIN", "SUPER_ADMIN")'), "ADMIN/SUPER_ADMIN guard present");
  assert.ok(content.includes("authenticate"), "authenticate present");
});

await test("security router has GET /audit, /performance, /backups, /recovery and POST /scan in source", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(__dirname, "../routes/security.ts"), "utf8");
  assert.ok(content.includes('"/audit"'), "/audit");
  assert.ok(content.includes('"/performance"'), "/performance");
  assert.ok(content.includes('"/backups"'), "/backups");
  assert.ok(content.includes('"/recovery"'), "/recovery");
  assert.ok(content.includes('"/scan"'), "/scan");
});

await test("backupValidationSvc pre-seeded with at least 2 backup records", () => {
  const backups = backupValidationSvc.getBackups();
  assert.ok(backups.length >= 2, `backups.length=${backups.length}`);
});

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Sprint 7.3 security.test.ts: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("\nFailed tests:");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
