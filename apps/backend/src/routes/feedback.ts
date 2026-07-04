/**
 * /api/feedback  — record recommendation feedback events
 * /api/analytics — recommendation analytics dashboards
 * /api/experiments — experiment management + assignment
 */

import { Router, type Request, type Response } from "express";
import { requireAuth, optionalAuth } from "../auth/auth.middleware.js";
import {
  recordFeedback,
  recordImpression,
  markImpressionClicked,
} from "../services/feedback.service.js";
import {
  getExperiments,
  getExperiment,
  getExperimentAssignment,
} from "../services/experiment.service.js";
import { computeMetrics } from "../services/metrics.service.js";
import {
  getTopAlgorithms,
  getLowPerformingProducts,
  getColdStartEffectiveness,
  getExperimentComparisons,
  getExperimentComparison,
} from "../services/recommendation-analytics.service.js";
import type { RecommendationFeedbackType } from "@prisma/client";

// ── /api/feedback ─────────────────────────────────────────────────────────────

export const feedbackRouter = Router();

const VALID_FEEDBACK_TYPES = new Set<string>([
  "IMPRESSION", "CLICK", "DISMISS", "WISHLIST", "ADD_TO_CART",
  "PURCHASE", "HIDE", "SKIP", "CONVERSION",
]);

// POST /api/feedback/recommendation — record a feedback event

feedbackRouter.post(
  "/recommendation",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const body = req.body as {
      productId:     string;
      feedbackType:  string;
      sessionId?:    string;
      context?:      string;
      position?:     number;
      experimentId?: string;
      variant?:      string;
      revenue?:      number;
      metadata?:     Record<string, unknown>;
    };

    if (!body.productId || typeof body.productId !== "string") {
      res.status(400).json({ error: "productId is required" });
      return;
    }

    if (!VALID_FEEDBACK_TYPES.has(body.feedbackType)) {
      res.status(400).json({ error: "Invalid feedbackType", valid: [...VALID_FEEDBACK_TYPES] });
      return;
    }

    if (body.revenue != null && (typeof body.revenue !== "number" || body.revenue < 0)) {
      res.status(400).json({ error: "revenue must be a non-negative number" });
      return;
    }

    const result = await recordFeedback({
      userId,
      sessionId:    body.sessionId,
      productId:    body.productId,
      feedbackType: body.feedbackType as RecommendationFeedbackType,
      context:      body.context,
      position:     typeof body.position === "number" ? body.position : undefined,
      experimentId: body.experimentId,
      variant:      body.variant,
      revenue:      body.revenue,
      metadata:     body.metadata,
    });

    res.status(result.isDuplicate ? 200 : 201).json({ data: result });
  }
);

// POST /api/feedback/impression — create an impression record

feedbackRouter.post(
  "/impression",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const body = req.body as {
      productId:     string;
      sessionId?:    string;
      context?:      string;
      position?:     number;
      experimentId?: string;
      variant?:      string;
    };

    if (!body.productId || typeof body.productId !== "string") {
      res.status(400).json({ error: "productId is required" });
      return;
    }

    const impressionId = await recordImpression({
      userId,
      sessionId:    body.sessionId,
      productId:    body.productId,
      context:      body.context,
      position:     typeof body.position === "number" ? body.position : undefined,
      experimentId: body.experimentId,
      variant:      body.variant,
    });

    res.status(201).json({ data: { impressionId } });
  }
);

// PATCH /api/feedback/impression/:id/click — mark an impression as clicked

feedbackRouter.patch(
  "/impression/:id/click",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id          = req.params["id"] as string;
    const { dwellTimeMs } = req.body as { dwellTimeMs?: number };

    const updated = await markImpressionClicked(
      id,
      typeof dwellTimeMs === "number" ? dwellTimeMs : undefined,
    );

    if (!updated) {
      res.status(404).json({ error: "Impression not found or already clicked" });
      return;
    }

    res.json({ data: { updated: true } });
  }
);

// ── /api/analytics ────────────────────────────────────────────────────────────

export const analyticsRouter = Router();

// GET /api/analytics/recommendations — full analytics dashboard

analyticsRouter.get(
  "/recommendations",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const since = req.query["since"]
      ? new Date(req.query["since"] as string)
      : undefined;

    const [overall, algorithms, lowPerforming, coldStart] = await Promise.all([
      computeMetrics({ since }),
      getTopAlgorithms(since),
      getLowPerformingProducts(10, since),
      getColdStartEffectiveness(since),
    ]);

    res.json({ data: { overall, algorithms, lowPerforming, coldStart } });
  }
);

// GET /api/analytics/experiments — compare all experiments

analyticsRouter.get(
  "/experiments",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const comparisons = await getExperimentComparisons();
    res.json({ data: { experiments: comparisons } });
  }
);

// GET /api/analytics/experiments/:id — compare one experiment by variant

analyticsRouter.get(
  "/experiments/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id         = req.params["id"] as string;
    const comparison = await getExperimentComparison(id);

    if (!comparison) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }

    res.json({ data: comparison });
  }
);

// ── /api/experiments ──────────────────────────────────────────────────────────

export const experimentsRouter = Router();

// GET /api/experiments — list all registered experiments

experimentsRouter.get(
  "/",
  optionalAuth,
  async (_req: Request, res: Response): Promise<void> => {
    res.json({ data: { experiments: getExperiments() } });
  }
);

// GET /api/experiments/:id/assignment — get (or create) this user's variant

experimentsRouter.get(
  "/:id/assignment",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId       = req.user!.id;
    const experimentId = req.params["id"] as string;

    const experiment = getExperiment(experimentId);
    if (!experiment) {
      res.status(404).json({ error: "Experiment not found" });
      return;
    }

    const assignment = await getExperimentAssignment(userId, experimentId);
    res.json({ data: assignment ?? { variant: "control", config: {} } });
  }
);
