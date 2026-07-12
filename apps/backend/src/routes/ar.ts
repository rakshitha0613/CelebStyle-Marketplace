/**
 * AR routes:
 *   POST /api/ar/session  — session analytics (existing)
 *   POST /api/ar/tryon    — AI Virtual Try-On via Replicate IDM-VTON (new)
 */

import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { optionalAuth } from "../auth/auth.middleware.js";
import { monitoringSvc } from "./ops.js";

export const arRouter = Router();

// ── AI Virtual Try-On ──────────────────────────────────────────────────────────
//
// Uses IDM-VTON (cuuupid/idm-vton) hosted on Replicate.
// Requires REPLICATE_API_TOKEN in the environment.  When the token is absent
// the endpoint returns HTTP 503 with detailed setup instructions.
//
// Flow:
//   1. Validate inputs.
//   2. Fetch the garment image on the server side and convert to a data URI so
//      Replicate can always read it regardless of the origin URL's CORS policy.
//   3. Send a prediction request with Prefer: wait=60  (synchronous mode).
//   4. Poll every 3 s for up to 2 additional minutes if needed.
//   5. Return the generated image URL.
arRouter.post("/tryon", async (req: Request, res: Response): Promise<void> => {
  const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_TOKEN) {
    res.status(503).json({
      error:
        "AI Virtual Try-On requires a GPU cloud backend. REPLICATE_API_TOKEN is not configured.",
      deploymentRequired: true,
      instructions: [
        "1. Sign up at https://replicate.com (free-tier available)",
        "2. Obtain your API token from https://replicate.com/account/api-tokens",
        "3. Add the following line to apps/backend/.env:",
        "   REPLICATE_API_TOKEN=r8_...",
        "4. Restart the backend:  npm run dev:backend",
        "---",
        "Model: cuuupid/idm-vton  (IDM-VTON — diffusion-based virtual try-on)",
        "GPU requirement: ~16 GB VRAM — handled transparently by Replicate cloud",
        "Estimated cost: ~$0.05 per generation",
        "Avg latency: 30–90 seconds",
      ],
    });
    return;
  }

  const {
    userImageBase64,
    garmentImageUrl,
    category,
    garmentDescription,
  } = req.body as {
    userImageBase64?: unknown;
    garmentImageUrl?: unknown;
    category?: unknown;
    garmentDescription?: unknown;
  };

  if (
    typeof userImageBase64 !== "string" ||
    !userImageBase64.startsWith("data:image/")
  ) {
    res.status(400).json({ error: "userImageBase64 must be a valid image data URI (data:image/…)" });
    return;
  }
  if (typeof garmentImageUrl !== "string" || !garmentImageUrl) {
    res.status(400).json({ error: "garmentImageUrl is required" });
    return;
  }

  // Fetch the garment image server-side so Replicate can always access it
  // even when the origin URL is CORS-restricted or behind a CDN that blocks
  // requests from Replicate's inference servers.
  let resolvedGarmentImage: string = garmentImageUrl;
  if (
    garmentImageUrl.startsWith("http://") ||
    garmentImageUrl.startsWith("https://")
  ) {
    try {
      const gRes = await fetch(garmentImageUrl, {
        signal: AbortSignal.timeout(12_000),
      });
      if (gRes.ok) {
        const buf = await gRes.arrayBuffer();
        const ct = gRes.headers.get("content-type") ?? "image/jpeg";
        resolvedGarmentImage = `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
      }
    } catch {
      // Fall back to original URL — Replicate may still be able to reach it
    }
  }

  const vtonCategory =
    category === "dresses"
      ? "dresses"
      : category === "lower_body"
      ? "lower_body"
      : "upper_body";

  try {
    // ── Create prediction (synchronous wait up to 60 s) ───────────────────────
    const createRes = await fetch(
      "https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait=60",
        },
        body: JSON.stringify({
          input: {
            human_img:    userImageBase64,
            garm_img:     resolvedGarmentImage,
            garment_des:  typeof garmentDescription === "string" && garmentDescription
              ? garmentDescription
              : "celebrity outfit",
            category:     vtonCategory,
            is_checked:       true,
            is_checked_crop:  false,
            denoise_steps:    30,
            seed:             42,
          },
        }),
        signal: AbortSignal.timeout(75_000),
      },
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      res.status(502).json({
        error: `Replicate API returned ${createRes.status}: ${errText.slice(0, 300)}`,
      });
      return;
    }

    type ReplicatePrediction = {
      id: string;
      status: string;
      output?: string | string[] | null;
      error?: string | null;
      urls?: { get?: string };
    };

    let prediction = (await createRes.json()) as ReplicatePrediction;

    // ── Poll if synchronous wait wasn't sufficient ────────────────────────────
    const pollUrl = prediction.urls?.get;
    if (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      pollUrl
    ) {
      const deadline = Date.now() + 120_000;
      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed" &&
        Date.now() < deadline
      ) {
        await new Promise<void>((r) => setTimeout(r, 3_000));
        const pollRes = await fetch(pollUrl, {
          headers: { Authorization: `Token ${REPLICATE_TOKEN}` },
          signal: AbortSignal.timeout(10_000),
        });
        prediction = (await pollRes.json()) as ReplicatePrediction;
      }
    }

    if (prediction.status === "failed") {
      res.status(502).json({
        error: `IDM-VTON generation failed: ${prediction.error ?? "unknown model error"}`,
      });
      return;
    }

    if (prediction.status !== "succeeded") {
      res.status(504).json({
        error: "AI generation timed out after 3 minutes. Please try again.",
      });
      return;
    }

    const resultUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

    if (!resultUrl) {
      res.status(502).json({ error: "Model returned no output image." });
      return;
    }

    res.json({ data: { resultUrl, modelUsed: "replicate-idm-vton" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: `AI generation failed: ${msg}` });
  }
});

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

    // ── Resolve slug → cuid (frontend sends slugs, DB FK needs cuids) ─────
    let resolvedProductId = productId.trim();
    const productLookup = await prisma.product.findFirst({
      where: { OR: [{ id: productId.trim() }, { slug: productId.trim() }] },
      select: { id: true },
    });
    if (productLookup) {
      resolvedProductId = productLookup.id;
    } else {
      res.status(422).json({ error: "productId does not match a known product in the catalogue" });
      return;
    }

    // ── Persist to database ───────────────────────────────────────────────
    try {
      const session = await prisma.aRSession.create({
        data: {
          userId:         req.user?.id ?? null,
          productId:      resolvedProductId,
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
