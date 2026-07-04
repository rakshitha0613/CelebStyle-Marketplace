import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { authorize } from "../auth/middleware/authorize.js";
import { SecurityAuditService } from "../services/security-audit.service.js";
import { PerformanceOptimizationService } from "../services/performance-optimization.service.js";
import { RateLimitService } from "../services/rate-limit.service.js";
import { SecretsValidationService } from "../services/secrets-validation.service.js";
import { BackupValidationService } from "../services/backup-validation.service.js";
import { RecoveryService } from "../services/recovery.service.js";

// Singleton service instances
export const securityAuditSvc        = new SecurityAuditService();
export const perfOptimizationSvc     = new PerformanceOptimizationService();
export const rateLimitSvc            = new RateLimitService();
export const secretsValidationSvc    = new SecretsValidationService();
export const backupValidationSvc     = new BackupValidationService();
export const recoverySvc             = new RecoveryService();

// Pre-populate the backup service with some realistic records
backupValidationSvc.simulateFullBackup();
backupValidationSvc.simulateIncrementalBackup();

export const securityRouter = Router();

// All /api/security/* endpoints require ADMIN or SUPER_ADMIN
securityRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// GET /api/security/audit — run OWASP/security audit and return report
securityRouter.get("/audit", (_req, res) => {
  const report = securityAuditSvc.runAudit();
  res.json({ data: report });
});

// GET /api/security/performance — performance optimization report
securityRouter.get("/performance", (_req, res) => {
  const area = _req.query["area"] as string | undefined;
  const report = perfOptimizationSvc.generateReport();
  const recs = area
    ? perfOptimizationSvc.getRecommendations({ area: area as import("../services/performance-optimization.service.js").OptimizationArea })
    : report.recommendations;

  res.json({
    data: {
      score: report.score,
      summary: report.summary,
      performanceSnapshot: report.performanceSnapshot,
      recommendations: recs,
      queryHints: perfOptimizationSvc.getQueryHints(),
    },
  });
});

// GET /api/security/backups — backup compliance report + recent backup records
securityRouter.get("/backups", (_req, res) => {
  const compliance = backupValidationSvc.generateComplianceReport();
  const backups = backupValidationSvc.getBackups();
  const secrets = secretsValidationSvc.runReport();

  res.json({
    data: {
      compliance,
      recentBackups: backups.slice(0, 20),
      secrets,
    },
  });
});

// GET /api/security/recovery — disaster recovery and resilience report
securityRouter.get("/recovery", (_req, res) => {
  const report = recoverySvc.generateReport();
  const rateLimitStats = rateLimitSvc.getAllStats();

  res.json({
    data: {
      ...report,
      rateLimiting: {
        rules: rateLimitSvc.getRules(),
        stats: rateLimitStats,
        adaptiveConfig: rateLimitSvc.getAdaptiveConfig(),
        allowlist: rateLimitSvc.getAllowlist(),
        denylistCount: rateLimitSvc.getDenylist().length,
      },
    },
  });
});

// POST /api/security/scan — run a full security scan (audit + secrets + performance)
securityRouter.post("/scan", (_req, res) => {
  const audit     = securityAuditSvc.runAudit();
  const secrets   = secretsValidationSvc.runReport();
  const backup    = backupValidationSvc.generateComplianceReport();
  const recovery  = recoverySvc.generateReport();
  const perfReport = perfOptimizationSvc.generateReport();

  const overallOk =
    audit.summary.failed === 0 &&
    secrets.overallStatus !== "critical" &&
    backup.rpoCompliant &&
    recovery.overallHealth !== "critical";

  res.json({
    data: {
      scannedAt: Date.now(),
      overallOk,
      audit: { score: audit.score, summary: audit.summary },
      secrets: { status: secrets.overallStatus, criticalCount: secrets.criticalCount },
      backup: { rpoCompliant: backup.rpoCompliant, issues: backup.issues },
      recovery: { overallHealth: recovery.overallHealth },
      performance: { score: perfReport.score, summary: perfReport.summary },
    },
  });
});
