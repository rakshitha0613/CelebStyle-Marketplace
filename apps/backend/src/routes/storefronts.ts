import { Router } from "express";
import type { Request, Response } from "express";
import { celebrityStore } from "./celebrities.js";
import { orderStore } from "./orders.js";
import { outfitStore } from "./outfits.js";

export type StorefrontEntry = {
  celebrityId: string;
  displayName: string;
  bannerImage: string;
  featuredOutfitIds: string[];
  message: string;
  verified: boolean;
};

export const storefrontStore: StorefrontEntry[] = [];

// Seed lazily on first request so outfitStore is populated
function ensureSeeded() {
  if (storefrontStore.length > 0) return;
  const initial = celebrityStore.slice(0, 4).map((celebrity) => ({
    celebrityId: celebrity.id,
    displayName: celebrity.name,
    bannerImage: celebrity.bannerImage,
    featuredOutfitIds: outfitStore
      .filter((outfit) => outfit.celebrityId === celebrity.id)
      .slice(0, 3)
      .map((outfit) => outfit.id),
    message: `${celebrity.name} curated luxury replica looks for fans.`,
    verified: true,
  }));
  storefrontStore.push(...initial);
}

export const storefrontsRouter = Router();

storefrontsRouter.get("/", (_req: Request, res: Response) => {
  ensureSeeded();
  res.json({ data: storefrontStore });
});

storefrontsRouter.get("/metrics/commission", (_req: Request, res: Response) => {
  const summary = orderStore.reduce(
    (acc, order) => {
      acc.orders += 1;
      acc.gross += order.subtotal;
      acc.platformFee += order.commission.platformFee;
      acc.celebrityCommission += order.commission.celebrityCommission;
      acc.manufacturerShare += order.commission.manufacturerShare;
      acc.paid += order.paymentStatus === "paid" ? order.total : 0;
      return acc;
    },
    { orders: 0, gross: 0, platformFee: 0, celebrityCommission: 0, manufacturerShare: 0, paid: 0 }
  );
  res.json({ data: summary });
});

storefrontsRouter.get("/:celebrityId", (req: Request, res: Response) => {
  ensureSeeded();
  const item = storefrontStore.find((storefront) => storefront.celebrityId === req.params.celebrityId);
  if (!item) {
    res.status(404).json({ message: "Storefront not found" });
    return;
  }
  res.json({ data: item });
});

storefrontsRouter.post("/", (req: Request, res: Response) => {
  ensureSeeded();
  const { celebrityId, displayName, bannerImage, featuredOutfitIds, message, verified } = req.body;
  if (!celebrityId || !displayName) {
    res.status(400).json({ message: "celebrityId and displayName are required" });
    return;
  }
  const existing = storefrontStore.find((storefront) => storefront.celebrityId === celebrityId);
  const next: StorefrontEntry = {
    celebrityId,
    displayName,
    bannerImage: bannerImage || "",
    featuredOutfitIds: Array.isArray(featuredOutfitIds) ? featuredOutfitIds : [],
    message: message || "",
    verified: Boolean(verified),
  };
  if (existing) {
    Object.assign(existing, next);
    res.json({ data: existing });
    return;
  }
  storefrontStore.push(next);
  res.status(201).json({ data: next });
});
