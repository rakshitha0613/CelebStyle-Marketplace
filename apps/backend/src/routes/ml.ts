/**
 * /api/ml — AI Operations & MLOps admin endpoints.
 *
 * All routes require authentication + ADMIN or SUPER_ADMIN role.
 *
 * GET  /api/ml/models           — list all registered models
 * POST /api/ml/models           — register a new model version
 * POST /api/ml/models/:id/activate — activate a model version
 * GET  /api/ml/models/:id       — get model version by ID
 * GET  /api/ml/models/:name/versions — get all versions for a model name
 * POST /api/ml/deploy           — deploy a model (blue/green / canary / pinned)
 * POST /api/ml/rollback         — rollback to previous deployment
 * GET  /api/ml/metrics          — monitoring metrics dashboard
 * GET  /api/ml/drift            — feature drift report
 * GET  /api/ml/health           — health check summary
 * GET  /api/ml/alerts           — list unresolved MLOps alerts
 * POST /api/ml/alerts/:id/resolve — resolve an alert
 */

import { Router, type Request, type Response } from "express";
import { authenticate, authorize } from "../auth/auth.middleware.js";
import {
  registerModel,
  activateModel,
  getAllModels,
  getModelById,
  getModelVersions,
  deprecateModel,
  rollbackModel,
  archiveModel,
} from "../services/model-registry.service.js";
import {
  deployModel,
  canaryDeploy,
  pinVersion,
  rollbackDeployment,
  getActiveDeployment,
  getDeploymentHistory,
} from "../services/model-deployment.service.js";
import {
  getHealthReport,
  getLatencyMetrics,
  getCacheHitRate,
  getCoverageMetrics,
} from "../services/model-monitoring.service.js";
import { checkAllFeatures, getAlerts, resolveAlert } from "../services/drift-detection.service.js";
import { getPredictionLogs } from "../services/prediction-logging.service.js";

export const mlRouter = Router();

// All ML routes require ADMIN or SUPER_ADMIN
mlRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// ── GET /api/ml/models ────────────────────────────────────────────────────────

mlRouter.get("/models", async (_req: Request, res: Response): Promise<void> => {
  const models = await getAllModels();
  res.json({ data: { models } });
});

// ── GET /api/ml/models/:id ────────────────────────────────────────────────────

mlRouter.get("/models/:id", async (req: Request, res: Response): Promise<void> => {
  const id    = req.params["id"] as string;
  const model = await getModelById(id);
  if (!model) { res.status(404).json({ error: "Model not found" }); return; }
  res.json({ data: model });
});

// ── GET /api/ml/models/:name/versions ────────────────────────────────────────

mlRouter.get("/models/:name/versions", async (req: Request, res: Response): Promise<void> => {
  const name     = req.params["name"] as string;
  const versions = await getModelVersions(name);
  res.json({ data: { name, versions } });
});

// ── POST /api/ml/models ───────────────────────────────────────────────────────

mlRouter.post("/models", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    name:              string;
    version:           string;
    modelType:         string;
    description?:      string;
    trainingDate?:     string;
    trainingDataSize?: number;
    metrics?:          Record<string, unknown>;
    hyperparams?:      Record<string, unknown>;
    artifactPath?:     string;
  };

  if (!body.name || !body.version || !body.modelType) {
    res.status(400).json({ error: "name, version, and modelType are required" });
    return;
  }

  const model = await registerModel({
    name:             body.name,
    version:          body.version,
    modelType:        body.modelType,
    description:      body.description,
    trainingDate:     body.trainingDate ? new Date(body.trainingDate) : undefined,
    trainingDataSize: body.trainingDataSize,
    metrics:          body.metrics,
    hyperparams:      body.hyperparams,
    artifactPath:     body.artifactPath,
    createdById:      req.user!.id,
  });

  res.status(201).json({ data: model });
});

// ── POST /api/ml/models/:id/activate ─────────────────────────────────────────

mlRouter.post("/models/:id/activate", async (req: Request, res: Response): Promise<void> => {
  const id = req.params["id"] as string;
  try {
    const model = await activateModel(id);
    res.json({ data: model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Activation failed";
    res.status(400).json({ error: msg });
  }
});

// ── POST /api/ml/models/:id/deprecate ────────────────────────────────────────

mlRouter.post("/models/:id/deprecate", async (req: Request, res: Response): Promise<void> => {
  const id    = req.params["id"] as string;
  const model = await deprecateModel(id);
  res.json({ data: model });
});

// ── POST /api/ml/models/:id/archive ──────────────────────────────────────────

mlRouter.post("/models/:id/archive", async (req: Request, res: Response): Promise<void> => {
  const id    = req.params["id"] as string;
  const model = await archiveModel(id);
  res.json({ data: model });
});

// ── POST /api/ml/models/:modelType/rollback ───────────────────────────────────

mlRouter.post("/models/:modelType/rollback", async (req: Request, res: Response): Promise<void> => {
  const modelType = req.params["modelType"] as string;
  try {
    const result = await rollbackModel(modelType);
    res.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rollback failed";
    res.status(400).json({ error: msg });
  }
});

// ── POST /api/ml/deploy ───────────────────────────────────────────────────────

mlRouter.post("/deploy", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    modelId:        string;
    deploymentType?: "BLUE_GREEN" | "CANARY" | "SHADOW" | "PINNED";
    environment?:   string;
    trafficPercent?: number;
    pinnedVersion?: string;
  };

  if (!body.modelId) {
    res.status(400).json({ error: "modelId is required" });
    return;
  }

  let deployment;
  if (body.deploymentType === "CANARY") {
    deployment = await canaryDeploy(body.modelId, body.trafficPercent ?? 10, {
      environment:  body.environment,
      deployedById: req.user!.id,
    });
  } else if (body.deploymentType === "PINNED" && body.pinnedVersion) {
    deployment = await pinVersion(body.modelId, body.pinnedVersion, {
      environment:  body.environment,
      deployedById: req.user!.id,
    });
  } else {
    deployment = await deployModel(body.modelId, {
      deploymentType: body.deploymentType ?? "BLUE_GREEN",
      environment:    body.environment,
      deployedById:   req.user!.id,
    });
  }

  res.status(201).json({ data: deployment });
});

// ── POST /api/ml/rollback ─────────────────────────────────────────────────────

mlRouter.post("/rollback", async (req: Request, res: Response): Promise<void> => {
  const { environment } = req.body as { environment?: string };
  try {
    const deployment = await rollbackDeployment(environment ?? "production", req.user!.id);
    res.json({ data: deployment });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rollback failed";
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/ml/deploy/active ─────────────────────────────────────────────────

mlRouter.get("/deploy/active", async (req: Request, res: Response): Promise<void> => {
  const env        = (req.query["environment"] as string) ?? "production";
  const deployment = await getActiveDeployment(env);
  res.json({ data: deployment });
});

// ── GET /api/ml/deploy/history ────────────────────────────────────────────────

mlRouter.get("/deploy/history", async (req: Request, res: Response): Promise<void> => {
  const env     = (req.query["environment"] as string) ?? "production";
  const limit   = parseInt((req.query["limit"] as string) ?? "20", 10);
  const history = await getDeploymentHistory(env, limit);
  res.json({ data: { history } });
});

// ── GET /api/ml/metrics ───────────────────────────────────────────────────────

mlRouter.get("/metrics", async (req: Request, res: Response): Promise<void> => {
  const since   = req.query["since"] ? new Date(req.query["since"] as string) : undefined;
  const context = req.query["context"] as string | undefined;

  const [latency, cacheHitRate, coverage] = await Promise.all([
    getLatencyMetrics(context, since),
    getCacheHitRate(since),
    getCoverageMetrics(since),
  ]);

  res.json({ data: { latency, cacheHitRate, coverage } });
});

// ── GET /api/ml/drift ─────────────────────────────────────────────────────────

mlRouter.get("/drift", async (_req: Request, res: Response): Promise<void> => {
  const report = await checkAllFeatures();
  res.json({ data: report });
});

// ── GET /api/ml/health ────────────────────────────────────────────────────────

mlRouter.get("/health", async (req: Request, res: Response): Promise<void> => {
  const since  = req.query["since"] ? new Date(req.query["since"] as string) : undefined;
  const report = await getHealthReport(since);
  res.json({ data: report });
});

// ── GET /api/ml/alerts ────────────────────────────────────────────────────────

mlRouter.get("/alerts", async (req: Request, res: Response): Promise<void> => {
  const resolved = req.query["resolved"] === "true"
    ? true
    : req.query["resolved"] === "false"
    ? false
    : undefined;
  const limit  = parseInt((req.query["limit"] as string) ?? "50", 10);
  const alerts = await getAlerts({ resolved, limit });
  res.json({ data: { alerts } });
});

// ── POST /api/ml/alerts/:id/resolve ──────────────────────────────────────────

mlRouter.post("/alerts/:id/resolve", async (req: Request, res: Response): Promise<void> => {
  const id      = req.params["id"] as string;
  const success = await resolveAlert(id);
  if (!success) { res.status(404).json({ error: "Alert not found or already resolved" }); return; }
  res.json({ data: { resolved: true } });
});

// ── GET /api/ml/predictions ───────────────────────────────────────────────────

mlRouter.get("/predictions", async (req: Request, res: Response): Promise<void> => {
  const context = req.query["context"] as string | undefined;
  const since   = req.query["since"] ? new Date(req.query["since"] as string) : undefined;
  const limit   = parseInt((req.query["limit"] as string) ?? "100", 10);

  const logs = await getPredictionLogs({ context, since, limit });
  res.json({ data: { logs } });
});
