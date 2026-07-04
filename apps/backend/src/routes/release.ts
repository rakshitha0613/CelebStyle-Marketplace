import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { authorize } from "../auth/middleware/authorize.js";
import { ReleaseAuditService } from "../services/release-audit.service.js";
import { DeploymentChecklistService } from "../services/deployment-checklist.service.js";
import { ProductionReadinessService } from "../services/production-readiness.service.js";
import { ReleaseNotesService } from "../services/release-notes.service.js";
import { DocumentationService } from "../services/documentation.service.js";
import { LaunchVerificationService } from "../services/launch-verification.service.js";

export const releaseAuditSvc         = new ReleaseAuditService();
export const deploymentChecklistSvc  = new DeploymentChecklistService();
export const productionReadinessSvc  = new ProductionReadinessService();
export const releaseNotesSvc         = new ReleaseNotesService();
export const documentationSvc        = new DocumentationService();
export const launchVerificationSvc   = new LaunchVerificationService();

export const releaseRouter = Router();

// GET /api/release/status — PUBLIC: quick health + version for status pages
releaseRouter.get("/status", (_req, res) => {
  const readiness = productionReadinessSvc.getOverallScore();
  res.json({
    data: {
      status: "operational",
      version: releaseAuditSvc.getVersion(),
      environment: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.round(process.uptime()),
      productionReadinessScore: readiness,
      verdict: readiness >= 95 ? "PRODUCTION_READY" : readiness >= 80 ? "MOSTLY_READY" : "NOT_READY",
    },
  });
});

// GET /api/release/version — PUBLIC: version info
releaseRouter.get("/version", (_req, res) => {
  const notes = releaseNotesSvc.generateReleaseNote();
  res.json({
    data: {
      version: notes.version,
      codename: notes.codename,
      releaseDate: notes.releaseDate,
      sprintsCompleted: releaseNotesSvc.getTotalStats().sprintsCompleted,
    },
  });
});

// GET /api/release/report — ADMIN/SUPER_ADMIN: full release report
releaseRouter.get(
  "/report",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  (_req, res) => {
    const audit      = releaseAuditSvc.runAudit();
    const checklist  = deploymentChecklistSvc.generateReport();
    const readiness  = productionReadinessSvc.getReadinessReport();
    const notes      = releaseNotesSvc.generateReleaseNote();
    const docs       = documentationSvc.generateReport();
    const launch     = launchVerificationSvc.runVerification();

    res.json({
      data: {
        generatedAt:   Date.now(),
        version:       audit.version,
        audit:         { recommendation: audit.releaseRecommendation, summary: audit.summary, blockers: audit.blockers, warnings: audit.warnings },
        checklist:     { score: checklist.score, summary: checklist.summary },
        readiness:     { score: readiness.overallScore, verdict: readiness.verdict, techDebt: readiness.techDebt.length },
        releaseNotes:  { version: notes.version, codename: notes.codename, knownIssues: notes.knownIssues },
        documentation: { summary: docs.summary },
        launch:        { approved: launch.launchApproved, summary: launch.summary, signOff: launch.signOffRequired },
        projectStats:  readiness.projectStats,
      },
    });
  },
);
