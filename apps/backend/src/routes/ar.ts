/**
 * POST /api/ar/session — AR Try-On session analytics.
 *
 * Logs a completed AR try-on session to the ARSession table.
 * Authentication is optional — anonymous sessions are fully supported.
 *
 * Also records duration in the in-memory MonitoringService so the
 * metric appears in GET /api/ops/metrics without an extra DB query.
 */

import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../auth/auth.middleware.js";
import { monitoringSvc } from "./ops.js";

export const arRouter = Router();

arRouter.post(
  "/session",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const {
      productId,
      durationSeconds,
      wasAddedToCart,
      screenshotUrl,
      deviceType,
      platform,
    } = req.body as Record<string, unknown>;

    // ── Validate required fields ───────────────────────────────────────────
    if (typeof productId !== "string" || !productId.trim()) {
      res.status(400).json({ error: "productId is required and must be a non-empty string" });
      return;
    }

    const duration =
      typeof durationSeconds === "number" ? durationSeconds :
      typeof durationSeconds === "string" ? parseFloat(durationSeconds) :
      NaN;

    if (isNaN(duration) || duration < 0) {
      res.status(400).json({ error: "durationSeconds must be a non-negative number" });
      return;
    }

    // ── Track in-memory metrics regardless of DB outcome ──────────────────
    monitoringSvc.recordArSessionDuration(Math.round(duration) * 1000);

    // ── Persist to database ───────────────────────────────────────────────
    try {
      const session = await prisma.aRSession.create({
        data: {
          userId:         req.user?.id ?? null,
          productId:      productId.trim(),
          durationSeconds: Math.round(duration),
          wasAddedToCart:  wasAddedToCart === true,
          screenshotUrl:  typeof screenshotUrl === "string" ? screenshotUrl : null,
          deviceType:     typeof deviceType === "string" ? deviceType : null,
          platform:       typeof platform === "string" ? platform : null,
        },
        select: { id: true, createdAt: true },
      });

      res.status(201).json({ data: { id: session.id, createdAt: session.createdAt } });
    } catch (err: unknown) {
      // P2003 = foreign key constraint — productId not in Product table
      // (happens in dev when outfits use in-memory slug IDs rather than Prisma cuid IDs)
      const code = (err as { code?: string }).code;
      if (code === "P2003") {
        res.status(422).json({ error: "productId does not match a known product in the catalogue" });
        return;
      }
      // Re-throw unexpected errors to the global handler
      throw err;
    }
  }
);
