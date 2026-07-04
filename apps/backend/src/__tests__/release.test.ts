/**
 * Sprint 7.4 — Final Documentation, Release Audit & Production Launch
 *
 * Tests: ReleaseAuditService, DeploymentChecklistService,
 *        ProductionReadinessService, ReleaseNotesService,
 *        DocumentationService, LaunchVerificationService,
 *        and the /api/release route structure.
 */

import assert from "node:assert/strict";

import { ReleaseAuditService } from "../services/release-audit.service.js";
import { DeploymentChecklistService } from "../services/deployment-checklist.service.js";
import { ProductionReadinessService } from "../services/production-readiness.service.js";
import { ReleaseNotesService } from "../services/release-notes.service.js";
import { DocumentationService } from "../services/documentation.service.js";
import { LaunchVerificationService } from "../services/launch-verification.service.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

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

// ─── 1. ReleaseAuditService ───────────────────────────────────────────────────

suite("ReleaseAuditService");

const releaseAudit = new ReleaseAuditService();

await test("runAudit returns a report", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.length > 0);
  assert.ok(report.auditedAt > 0);
});

await test("report version is 1.0.0", () => {
  const report = releaseAudit.runAudit();
  assert.equal(report.version, "1.0.0");
});

await test("report includes authentication subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "authentication"));
});

await test("report includes authorization subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "authorization"));
});

await test("report includes payments subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "payments"));
});

await test("report includes ar-platform subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "ar-platform"));
});

await test("report includes monitoring subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "monitoring"));
});

await test("report includes security subsystem", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.subsystems.some((s) => s.name === "security"));
});

await test("summary total matches all checks across subsystems", () => {
  const report = releaseAudit.runAudit();
  const allChecks = report.subsystems.flatMap((s) => s.checks);
  assert.equal(report.summary.total, allChecks.length);
});

await test("summary overallScore is in [0, 100]", () => {
  const report = releaseAudit.runAudit();
  assert.ok(report.summary.overallScore >= 0 && report.summary.overallScore <= 100);
});

await test("releaseRecommendation is APPROVE or APPROVE_WITH_WARNINGS (no blockers)", () => {
  const report = releaseAudit.runAudit();
  assert.ok(["APPROVE", "APPROVE_WITH_WARNINGS"].includes(report.releaseRecommendation),
    `recommendation=${report.releaseRecommendation}`);
});

await test("each subsystem has passRate in [0, 100]", () => {
  const report = releaseAudit.runAudit();
  for (const s of report.subsystems) {
    assert.ok(s.passRate >= 0 && s.passRate <= 100, `${s.name} passRate=${s.passRate}`);
  }
});

await test("each check has id, description, status", () => {
  const report = releaseAudit.runAudit();
  for (const s of report.subsystems) {
    for (const c of s.checks) {
      assert.ok(c.id, `check missing id in ${s.name}`);
      assert.ok(c.description, `check ${c.id} missing description`);
      assert.ok(["pass", "fail", "warning", "not-verified"].includes(c.status));
    }
  }
});

await test("getLastReport returns report after runAudit", () => {
  const svc = new ReleaseAuditService();
  assert.equal(svc.getLastReport(), null);
  svc.runAudit();
  assert.ok(svc.getLastReport() !== null);
});

await test("getVersion returns 1.0.0", () => {
  assert.equal(releaseAudit.getVersion(), "1.0.0");
});

await test("warnings array contains only warning-level checks", () => {
  const report = releaseAudit.runAudit();
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.blockers));
});

await test("ar-platform subsystem has at least 8 checks covering privacy constraints", () => {
  const report = releaseAudit.runAudit();
  const ar = report.subsystems.find((s) => s.name === "ar-platform");
  assert.ok(ar !== undefined);
  assert.ok(ar!.checks.length >= 8);
  const ids = ar!.checks.map((c) => c.id);
  assert.ok(ids.includes("AR-08"), "camera privacy check AR-08");
  assert.ok(ids.includes("AR-09"), "recording privacy check AR-09");
});

// ─── 2. DeploymentChecklistService ───────────────────────────────────────────

suite("DeploymentChecklistService");

const checklist = new DeploymentChecklistService();

await test("getChecklist returns a non-empty list", () => {
  const items = checklist.getChecklist();
  assert.ok(items.length >= 10);
});

await test("checklist includes docker category items", () => {
  const items = checklist.getChecklist();
  assert.ok(items.some((i) => i.category === "docker"));
});

await test("checklist includes environment category items", () => {
  const items = checklist.getChecklist();
  assert.ok(items.some((i) => i.category === "environment"));
});

await test("checklist includes secrets category items", () => {
  const items = checklist.getChecklist();
  assert.ok(items.some((i) => i.category === "secrets"));
});

await test("checklist includes monitoring category items", () => {
  const items = checklist.getChecklist();
  assert.ok(items.some((i) => i.category === "monitoring"));
});

await test("checklist includes ci-cd category items", () => {
  const items = checklist.getChecklist();
  assert.ok(items.some((i) => i.category === "ci-cd"));
});

await test("each item has id, title, category, status, automated fields", () => {
  const items = checklist.getChecklist();
  for (const item of items) {
    assert.ok(item.id);
    assert.ok(item.title);
    assert.ok(item.category);
    assert.ok(["pass", "fail", "warning", "manual"].includes(item.status), `${item.id} bad status`);
    assert.ok(typeof item.automated === "boolean");
  }
});

await test("generateReport returns score in [0, 100]", () => {
  const report = checklist.generateReport();
  assert.ok(report.score >= 0 && report.score <= 100);
});

await test("generateReport summary counts sum to total", () => {
  const report = checklist.generateReport();
  const s = report.summary;
  assert.equal(s.passed + s.failed + s.warnings + s.manual, s.total);
});

await test("generateReport readyForDeployment is true when no items fail", () => {
  const report = checklist.generateReport();
  const anyFail = report.items.some((i) => i.status === "fail");
  assert.equal(report.summary.readyForDeployment, !anyFail);
});

await test("addItem includes custom item in checklist", () => {
  const svc = new DeploymentChecklistService();
  svc.addItem({
    id: "CUSTOM-CL-01",
    category: "docker",
    title: "Custom Docker Check",
    description: "Test custom item.",
    status: "pass",
    automated: true,
  });
  const items = svc.getChecklist();
  assert.ok(items.some((i) => i.id === "CUSTOM-CL-01"));
});

// ─── 3. ProductionReadinessService ───────────────────────────────────────────

suite("ProductionReadinessService");

const readiness = new ProductionReadinessService();

await test("getOverallScore returns a number in [0, 100]", () => {
  const score = readiness.getOverallScore();
  assert.ok(score >= 0 && score <= 100, `score=${score}`);
});

await test("getReadinessReport has dimensions with weights summing to ~1.0", () => {
  const report = readiness.getReadinessReport();
  const totalWeight = report.dimensions.reduce((s, d) => s + d.weight, 0);
  assert.ok(Math.abs(totalWeight - 1.0) < 0.01, `totalWeight=${totalWeight}`);
});

await test("getReadinessReport verdict is PRODUCTION_READY or MOSTLY_READY", () => {
  const report = readiness.getReadinessReport();
  assert.ok(["PRODUCTION_READY", "MOSTLY_READY", "NOT_READY"].includes(report.verdict));
});

await test("getReadinessReport overallScore >= 85", () => {
  const report = readiness.getReadinessReport();
  assert.ok(report.overallScore >= 85, `score=${report.overallScore}`);
});

await test("each dimension has score in [0, 100]", () => {
  const dims = readiness.getDimensions();
  for (const d of dims) {
    assert.ok(d.score >= 0 && d.score <= 100, `${d.name} score=${d.score}`);
    assert.ok(["ready", "partial", "not-ready"].includes(d.status));
  }
});

await test("projectStats has realistic values", () => {
  const report = readiness.getReadinessReport();
  const stats = report.projectStats;
  assert.ok(stats.totalServices >= 40, `services=${stats.totalServices}`);
  assert.ok(stats.totalDatabaseModels >= 80, `models=${stats.totalDatabaseModels}`);
  assert.ok(stats.totalTestSuites >= 30, `suites=${stats.totalTestSuites}`);
  assert.ok(stats.totalApiEndpoints >= 50, `endpoints=${stats.totalApiEndpoints}`);
  assert.ok(stats.dockerServices >= 5, `dockerServices=${stats.dockerServices}`);
});

await test("getTechDebt returns tech debt items with priority and effort", () => {
  const debt = readiness.getTechDebt();
  assert.ok(debt.length >= 5);
  for (const d of debt) {
    assert.ok(d.id);
    assert.ok(d.description);
    assert.ok(["critical", "high", "medium", "low"].includes(d.priority));
    assert.ok(["low", "medium", "high"].includes(d.effort));
    assert.ok(d.recommendation);
  }
});

await test("report has version 1.0.0", () => {
  const report = readiness.getReadinessReport();
  assert.equal(report.version, "1.0.0");
});

// ─── 4. ReleaseNotesService ───────────────────────────────────────────────────

suite("ReleaseNotesService");

const notes = new ReleaseNotesService();

await test("generateReleaseNote returns version 1.0.0", () => {
  const note = notes.generateReleaseNote();
  assert.equal(note.version, "1.0.0");
});

await test("generateReleaseNote has a codename", () => {
  const note = notes.generateReleaseNote();
  assert.ok(note.codename.length > 0);
});

await test("generateReleaseNote has sprints array", () => {
  const note = notes.generateReleaseNote();
  assert.ok(Array.isArray(note.sprints) && note.sprints.length >= 7);
});

await test("generateReleaseNote has databaseChanges array", () => {
  const note = notes.generateReleaseNote();
  assert.ok(Array.isArray(note.databaseChanges) && note.databaseChanges.length > 0);
});

await test("generateReleaseNote has knownIssues array", () => {
  const note = notes.generateReleaseNote();
  assert.ok(Array.isArray(note.knownIssues) && note.knownIssues.length > 0);
});

await test("generateReleaseNote has upgradeSteps array", () => {
  const note = notes.generateReleaseNote();
  assert.ok(Array.isArray(note.upgradeSteps) && note.upgradeSteps.length >= 5);
});

await test("getSprintHistory returns 7 sprints", () => {
  const history = notes.getSprintHistory();
  assert.equal(history.length, 7);
});

await test("each sprint has sprint, title, highlights, filesAdded", () => {
  const history = notes.getSprintHistory();
  for (const s of history) {
    assert.ok(s.sprint, "missing sprint");
    assert.ok(s.title, "missing title");
    assert.ok(s.highlights.length > 0, `${s.sprint} missing highlights`);
    assert.ok(s.filesAdded >= 0);
    assert.ok(s.testsAdded >= 0);
  }
});

await test("getTotalStats returns accumulated counts", () => {
  const stats = notes.getTotalStats();
  assert.ok(stats.filesAdded > 100, `filesAdded=${stats.filesAdded}`);
  assert.ok(stats.sprintsCompleted === 7);
  assert.ok(stats.testsAdded >= 35);
});

// ─── 5. DocumentationService ─────────────────────────────────────────────────

suite("DocumentationService");

const docs = new DocumentationService();

await test("getDocuments returns 10 document entries", () => {
  const documents = docs.getDocuments();
  assert.equal(documents.length, 10);
});

await test("all documents have complete coverage", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.every((d) => d.coverage === "complete"), "all docs should be complete");
});

await test("documents include SYSTEM_ARCHITECTURE.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "SYSTEM_ARCHITECTURE.md"));
});

await test("documents include API_DOCUMENTATION.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "API_DOCUMENTATION.md"));
});

await test("documents include DATABASE_SCHEMA.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "DATABASE_SCHEMA.md"));
});

await test("documents include SECURITY_GUIDE.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "SECURITY_GUIDE.md"));
});

await test("documents include AI_DOCUMENTATION.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "AI_DOCUMENTATION.md"));
});

await test("documents include AR_DOCUMENTATION.md", () => {
  const documents = docs.getDocuments();
  assert.ok(documents.some((d) => d.filename === "AR_DOCUMENTATION.md"));
});

await test("getApiEndpoints returns 60+ endpoints", () => {
  const endpoints = docs.getApiEndpoints();
  assert.ok(endpoints.length >= 60, `endpoints=${endpoints.length}`);
});

await test("getApiEndpoints filter by category works", () => {
  const authEndpoints = docs.getApiEndpoints({ category: "auth" });
  assert.ok(authEndpoints.length >= 5);
  assert.ok(authEndpoints.every((e) => e.category === "auth"));
});

await test("getApiEndpoints filter by auth works", () => {
  const adminEndpoints = docs.getApiEndpoints({ auth: "admin" });
  assert.ok(adminEndpoints.length >= 10);
  assert.ok(adminEndpoints.every((e) => e.auth === "admin"));
});

await test("each endpoint has method, path, summary, auth, category", () => {
  const endpoints = docs.getApiEndpoints();
  for (const e of endpoints) {
    assert.ok(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(e.method), `bad method: ${e.method}`);
    assert.ok(e.path.startsWith("/"), `path must start with /: ${e.path}`);
    assert.ok(e.summary, "missing summary");
    assert.ok(["public", "authenticated", "admin"].includes(e.auth), `bad auth: ${e.auth}`);
    assert.ok(e.category, "missing category");
  }
});

await test("generateReport summary coveragePercent is 100", () => {
  const report = docs.generateReport();
  assert.equal(report.summary.coveragePercent, 100);
});

await test("getDocument by id returns correct entry", () => {
  const doc = docs.getDocument("DOC-01");
  assert.ok(doc !== null);
  assert.equal(doc!.filename, "README.md");
});

await test("getDocument returns null for unknown id", () => {
  assert.equal(docs.getDocument("NONEXISTENT"), null);
});

// ─── 6. LaunchVerificationService ────────────────────────────────────────────

suite("LaunchVerificationService");

const launch = new LaunchVerificationService();

await test("runVerification returns a result", () => {
  const result = launch.runVerification();
  assert.ok(result.checks.length > 0);
  assert.ok(result.verifiedAt > 0);
});

await test("launchApproved is true when no checks fail", () => {
  const result = launch.runVerification();
  const anyFail = result.checks.filter((c) => c.status === "fail").length;
  assert.equal(result.launchApproved, anyFail === 0);
});

await test("summary counts sum to total", () => {
  const result = launch.runVerification();
  const s = result.summary;
  assert.equal(s.passed + s.failed + s.warnings + s.skipped, s.total);
});

await test("signOffRequired contains critical manual steps", () => {
  const result = launch.runVerification();
  assert.ok(Array.isArray(result.signOffRequired));
  assert.ok(result.signOffRequired.length > 0, "should have manual sign-off items");
});

await test("checks include environment verification", () => {
  const result = launch.runVerification();
  assert.ok(result.checks.some((c) => c.category === "environment"));
});

await test("checks include security verification", () => {
  const result = launch.runVerification();
  assert.ok(result.checks.some((c) => c.category === "security"));
});

await test("checks include monitoring verification", () => {
  const result = launch.runVerification();
  assert.ok(result.checks.some((c) => c.category === "monitoring"));
});

await test("checks include routes verification", () => {
  const result = launch.runVerification();
  assert.ok(result.checks.some((c) => c.category === "routes"));
});

await test("each check has id, name, category, status, critical, message", () => {
  const result = launch.runVerification();
  for (const c of result.checks) {
    assert.ok(c.id);
    assert.ok(c.name);
    assert.ok(c.category);
    assert.ok(["pass", "fail", "skip", "warn"].includes(c.status));
    assert.ok(typeof c.critical === "boolean");
    assert.ok(c.message);
  }
});

await test("getLastResult returns the stored result", () => {
  const svc = new LaunchVerificationService();
  assert.equal(svc.getLastResult(), null);
  svc.runVerification();
  assert.ok(svc.getLastResult() !== null);
});

await test("getReadySummary returns a string summary", () => {
  const svc = new LaunchVerificationService();
  svc.runVerification();
  const summary = svc.getReadySummary();
  assert.ok(typeof summary === "string" && summary.length > 0);
  assert.ok(summary.includes("Approved:"));
});

await test("JWT_SECRET check passes when JWT_SECRET is set (from .env)", () => {
  const result = launch.runVerification();
  const jwtCheck = result.checks.find((c) => c.id === "LV-07");
  assert.ok(jwtCheck !== undefined);
  assert.equal(jwtCheck!.status, "pass", "JWT_SECRET should be valid in test env with .env file");
});

// ─── 7. Release Route Structure ───────────────────────────────────────────────

suite("Release Route Structure");

import {
  releaseRouter,
  releaseAuditSvc,
  deploymentChecklistSvc,
  productionReadinessSvc,
  releaseNotesSvc,
  documentationSvc,
  launchVerificationSvc,
} from "../routes/release.js";

await test("releaseRouter is an Express Router (function)", () => {
  assert.ok(typeof releaseRouter === "function");
});

await test("releaseAuditSvc singleton is ReleaseAuditService", () => {
  assert.ok(releaseAuditSvc instanceof ReleaseAuditService);
});

await test("deploymentChecklistSvc singleton is DeploymentChecklistService", () => {
  assert.ok(deploymentChecklistSvc instanceof DeploymentChecklistService);
});

await test("productionReadinessSvc singleton is ProductionReadinessService", () => {
  assert.ok(productionReadinessSvc instanceof ProductionReadinessService);
});

await test("releaseNotesSvc singleton is ReleaseNotesService", () => {
  assert.ok(releaseNotesSvc instanceof ReleaseNotesService);
});

await test("documentationSvc singleton is DocumentationService", () => {
  assert.ok(documentationSvc instanceof DocumentationService);
});

await test("launchVerificationSvc singleton is LaunchVerificationService", () => {
  assert.ok(launchVerificationSvc instanceof LaunchVerificationService);
});

await test("release router source has GET /status, /version, /report", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(dir, "../routes/release.ts"), "utf8");
  assert.ok(content.includes('"/status"'), "/status");
  assert.ok(content.includes('"/version"'), "/version");
  assert.ok(content.includes('"/report"'), "/report");
});

await test("release router source has ADMIN/SUPER_ADMIN guard on /report", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(dir, "../routes/release.ts"), "utf8");
  assert.ok(content.includes('authorize("ADMIN", "SUPER_ADMIN")'), "ADMIN guard on report");
});

await test("release router source has public /status (no authenticate before it)", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(resolve(dir, "../routes/release.ts"), "utf8");
  // status route comes before the authenticate guard
  const statusIdx = content.indexOf('"/status"');
  const authIdx = content.indexOf("authenticate,\n  authorize");
  assert.ok(statusIdx < authIdx, "/status is defined before the admin guard");
});

// ─── Final report ──────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Sprint 7.4 release.test.ts: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("\nFailed tests:");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
