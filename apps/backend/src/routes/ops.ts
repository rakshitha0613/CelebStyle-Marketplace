import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { authorize } from "../auth/middleware/authorize.js";
import { MonitoringService } from "../services/monitoring.service.js";
import { AlertingService } from "../services/alerting.service.js";
import { ScalingService } from "../services/scaling.service.js";
import { PerformanceMonitoringService } from "../services/performance-monitoring.service.js";
import { CacheMonitoringService } from "../services/cache-monitoring.service.js";
import { TracingService } from "../services/tracing.service.js";

// Singleton service instances shared across requests
export const monitoringSvc   = new MonitoringService();
export const alertingSvc     = new AlertingService();
export const scalingSvc      = new ScalingService();
export const performanceSvc  = new PerformanceMonitoringService();
export const cacheSvc        = new CacheMonitoringService();
export const tracingSvc      = new TracingService();

export const opsRouter = Router();

// All /api/ops/* endpoints require ADMIN or SUPER_ADMIN
opsRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// GET /api/ops/metrics — system + request + business metrics
opsRouter.get("/metrics", (_req, res) => {
  const summary = monitoringSvc.getMetricsSummary();
  res.json({ data: summary });
});

// GET /api/ops/health — detailed ops health (scaling readiness + pool status)
opsRouter.get("/health", (_req, res) => {
  const readiness  = scalingSvc.checkScalingReadiness();
  const poolStatus = scalingSvc.getPoolStatus();
  const memPressure = performanceSvc.checkMemoryPressure();
  const cacheStats  = cacheSvc.getStats();

  res.json({
    data: {
      scaling: readiness,
      pool: poolStatus,
      memory: memPressure,
      cache: cacheStats,
      uptime: process.uptime(),
      pid: process.pid,
    },
  });
});

// GET /api/ops/alerts — active alerts + recent history
opsRouter.get("/alerts", (req, res) => {
  const active  = alertingSvc.getActiveAlerts();
  const limit   = parseInt(String(req.query["limit"] ?? "50"), 10);
  const history = alertingSvc.getAlertHistory(isNaN(limit) ? 50 : limit);

  res.json({ data: { active, history } });
});

// POST /api/ops/alerts/:alertId/acknowledge — acknowledge a firing alert
opsRouter.post("/alerts/:alertId/acknowledge", (req, res) => {
  const { alertId } = req.params;
  const acknowledgedBy = req.user?.email ?? "admin";
  const ok = alertingSvc.acknowledgeAlert(alertId, acknowledgedBy);
  if (!ok) {
    res.status(404).json({ message: "Alert not found or already resolved" });
    return;
  }
  res.json({ data: { alertId, acknowledged: true, acknowledgedBy } });
});

// GET /api/ops/traces — recent distributed traces
opsRouter.get("/traces", (req, res) => {
  const limit  = parseInt(String(req.query["limit"] ?? "20"), 10);
  const traces = tracingSvc.getRecentTraces(isNaN(limit) ? 20 : limit);
  const active = tracingSvc.getActiveSpans();

  res.json({ data: { traces, activeSpans: active.length } });
});

// GET /api/ops/performance — slow queries + long-running requests + memory
opsRouter.get("/performance", (req, res) => {
  const threshold   = parseInt(String(req.query["threshold"] ?? "500"), 10);
  const lrThreshold = parseInt(String(req.query["lrThreshold"] ?? "5000"), 10);

  const slowQueries      = performanceSvc.getSlowQueries(isNaN(threshold) ? 500 : threshold);
  const longRunning      = performanceSvc.detectLongRunningRequests(isNaN(lrThreshold) ? 5000 : lrThreshold);
  const memoryPressure   = performanceSvc.checkMemoryPressure();
  const recentProfiles   = performanceSvc.getCompletedProfiles(20);
  const cachePercentiles = cacheSvc.getLatencyPercentiles();
  const hotKeys          = cacheSvc.getHotKeys(10);

  res.json({
    data: {
      slowQueries,
      longRunning,
      memoryPressure,
      recentProfiles,
      cachePercentiles,
      hotKeys,
    },
  });
});
