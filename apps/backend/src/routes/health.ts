import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export const healthRouter = Router();

const START_TIME = Date.now();

function uptimeSeconds(): number {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

// ── Liveness — is the process alive? ─────────────────────────────────────────

healthRouter.get("/", (_req, res) => {
  res.json({
    status:  "ok",
    service: "celebstyle-backend",
    uptime:  uptimeSeconds(),
    ts:      new Date().toISOString(),
  });
});

// ── Readiness — can the process serve traffic? ────────────────────────────────

healthRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "unknown",
    };
    logger.warn({ err }, "readiness: database check failed");
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  res.status(allOk ? 200 : 503).json({
    status:  allOk ? "ready" : "not_ready",
    service: "celebstyle-backend",
    uptime:  uptimeSeconds(),
    ts:      new Date().toISOString(),
    checks,
  });
});

// ── Startup probe ─────────────────────────────────────────────────────────────

healthRouter.get("/startup", (_req, res) => {
  res.json({ status: "started", ts: new Date().toISOString() });
});
