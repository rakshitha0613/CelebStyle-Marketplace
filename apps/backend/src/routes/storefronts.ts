import { Router } from "express";
import type { Request, Response } from "express";
import { storefrontRepository } from "../repositories/storefront.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

// ── Public type re-export ──────────────────────────────────────────────────────
export type { StorefrontEntry } from "../repositories/storefront.repository.js";

// ── Router ─────────────────────────────────────────────────────────────────────
export const storefrontsRouter = Router();

storefrontsRouter.get("/", async (_req: Request, res: Response) => {
  const storefronts = await storefrontRepository.findAll();
  res.json({ data: storefronts });
});

// Commission metrics — aggregated from all persisted orders in the database.
// ADMIN / SUPER_ADMIN only — contains financial data.
storefrontsRouter.get("/metrics/commission", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (_req: Request, res: Response) => {
  const summary = await storefrontRepository.commission();
  res.json({ data: summary });
});

storefrontsRouter.get("/:celebrityId", async (req: Request, res: Response) => {
  const item = await storefrontRepository.findByCelebritySlug(req.params.celebrityId as string);
  if (!item) {
    res.status(404).json({ message: "Storefront not found" });
    return;
  }
  res.json({ data: item });
});

storefrontsRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const { celebrityId, displayName, bannerImage, featuredOutfitIds, message, verified } =
    req.body as Record<string, unknown>;

  if (!celebrityId || !displayName) {
    res.status(400).json({ message: "celebrityId and displayName are required" });
    return;
  }

  const result = await storefrontRepository.upsert({
    celebrityId: celebrityId as string,
    displayName: displayName as string,
    bannerImage: (bannerImage as string) || "",
    featuredOutfitIds: Array.isArray(featuredOutfitIds)
      ? (featuredOutfitIds as string[])
      : [],
    message: (message as string) || "",
    verified: Boolean(verified),
  });

  if (!result) {
    res.status(404).json({ message: "Celebrity not found" });
    return;
  }

  res.status(result.created ? 201 : 200).json({ data: result.entry });
});
