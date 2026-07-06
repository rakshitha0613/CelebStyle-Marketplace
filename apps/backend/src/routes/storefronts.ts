import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { storefrontRepository } from "../repositories/storefront.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

// ── In-memory storefront analytics ───────────────────────────────────────────

interface StorefrontView {
  id: string;
  celebrityId: string;
  visitorId: string;
  outfitId: string | null;
  converted: boolean;
  createdAt: string;
}

const storefrontViews: StorefrontView[] = [];

export function recordStorefrontView(celebrityId: string, visitorId: string, outfitId?: string): void {
  storefrontViews.push({
    id: randomUUID(),
    celebrityId,
    visitorId,
    outfitId: outfitId ?? null,
    converted: false,
    createdAt: new Date().toISOString(),
  });
}

export function recordStorefrontConversion(celebrityId: string, visitorId: string): void {
  const view = [...storefrontViews].reverse().find((v: StorefrontView) => v.celebrityId === celebrityId && v.visitorId === visitorId);
  if (view) view.converted = true;
}

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

// GET /api/storefronts/:celebrityId/analytics — celebrity or admin
storefrontsRouter.get("/:celebrityId/analytics", authenticate, async (req: Request, res: Response) => {
  const { celebrityId } = req.params as { celebrityId: string };
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
  // Allow celebrities to view their own analytics
  if (!isAdmin && req.user!.role !== "CELEBRITY" && req.user!.role !== "CELEBRITY_MANAGER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const views = storefrontViews.filter((v) => v.celebrityId === celebrityId);
  const uniqueVisitors = new Set(views.map((v) => v.visitorId)).size;
  const conversions = views.filter((v) => v.converted).length;
  const conversionRate = views.length > 0 ? (conversions / views.length) * 100 : 0;

  // Monthly breakdown (last 6 months)
  const now = new Date();
  const monthly: { month: string; views: number; conversions: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mViews = views.filter((v) => v.createdAt.startsWith(monthKey));
    monthly.push({
      month: monthKey,
      views: mViews.length,
      conversions: mViews.filter((v) => v.converted).length,
    });
  }

  // Top outfit views
  const outfitViewMap: Record<string, number> = {};
  for (const v of views) {
    if (v.outfitId) outfitViewMap[v.outfitId] = (outfitViewMap[v.outfitId] || 0) + 1;
  }
  const topOutfits = Object.entries(outfitViewMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([outfitId, count]) => ({ outfitId, views: count }));

  res.json({
    data: {
      celebrityId,
      totalViews: views.length,
      uniqueVisitors,
      conversions,
      conversionRate: Number(conversionRate.toFixed(2)),
      monthly,
      topOutfits,
    },
  });
});

// POST /api/storefronts/:celebrityId/track — record a view (fire-and-forget, unauthenticated)
storefrontsRouter.post("/:celebrityId/track", async (req: Request, res: Response) => {
  const { outfitId } = req.body as { outfitId?: string };
  const visitorId = req.headers["x-visitor-id"] as string || randomUUID();
  recordStorefrontView(req.params.celebrityId as string, visitorId, outfitId);
  res.status(204).send();
});

// GET /api/storefronts/:celebrityId/payouts — monthly commission payouts
storefrontsRouter.get("/:celebrityId/payouts", authenticate, async (req: Request, res: Response) => {
  const { celebrityId } = req.params as { celebrityId: string };
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
  if (!isAdmin && req.user!.role !== "CELEBRITY" && req.user!.role !== "CELEBRITY_MANAGER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Get commission summary from repository
  const summary = await storefrontRepository.commission();

  // Build simulated monthly payout history based on summary data
  const now = new Date();
  const payouts = [];
  const monthlyGross = summary.gross / 6;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const gross = monthlyGross * (0.7 + Math.random() * 0.6);
    const celCommission = gross * 0.05;
    payouts.push({
      id: randomUUID(),
      period: monthKey,
      gross: Math.round(gross),
      commission: Math.round(celCommission),
      status: i > 0 ? "PAID" : "PENDING",
      paidAt: i > 0 ? new Date(d.getFullYear(), d.getMonth() + 1, 5).toISOString() : null,
    });
  }

  res.json({ data: { payouts, summary } });
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
