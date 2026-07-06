import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { storefrontRepository } from "../repositories/storefront.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { prisma } from "../lib/prisma.js";

export type { StorefrontEntry } from "../repositories/storefront.repository.js";

export async function recordStorefrontView(celebrityId: string, visitorId: string, productId?: string): Promise<void> {
  await prisma.storefrontPageView.create({ data: { celebrityId, visitorId, productId: productId ?? null } });
}

export async function recordStorefrontConversion(celebrityId: string, visitorId: string): Promise<void> {
  const view = await prisma.storefrontPageView.findFirst({
    where: { celebrityId, visitorId, converted: false },
    orderBy: { createdAt: "desc" },
  });
  if (view) {
    await prisma.storefrontPageView.update({ where: { id: view.id }, data: { converted: true } });
  }
}

export const storefrontsRouter = Router();

storefrontsRouter.get("/", async (_req: Request, res: Response) => {
  const storefronts = await storefrontRepository.findAll();
  res.json({ data: storefronts });
});

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

// GET /api/storefronts/:celebrityId/analytics
storefrontsRouter.get("/:celebrityId/analytics", authenticate, async (req: Request, res: Response) => {
  const { celebrityId } = req.params as { celebrityId: string };
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
  if (!isAdmin && req.user!.role !== "CELEBRITY" && req.user!.role !== "CELEBRITY_MANAGER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [totalViews, conversions] = await Promise.all([
    prisma.storefrontPageView.count({ where: { celebrityId } }),
    prisma.storefrontPageView.count({ where: { celebrityId, converted: true } }),
  ]);

  const uniqueVisitorsResult = await prisma.storefrontPageView.groupBy({
    by: ["visitorId"],
    where: { celebrityId },
    _count: { visitorId: true },
  });
  const uniqueVisitors = uniqueVisitorsResult.length;
  const conversionRate = totalViews > 0 ? (conversions / totalViews) * 100 : 0;

  // Monthly breakdown — last 6 months
  const now = new Date();
  const monthly: { month: string; views: number; conversions: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const [mViews, mConversions] = await Promise.all([
      prisma.storefrontPageView.count({ where: { celebrityId, createdAt: { gte: start, lt: end } } }),
      prisma.storefrontPageView.count({ where: { celebrityId, converted: true, createdAt: { gte: start, lt: end } } }),
    ]);
    monthly.push({ month: monthKey, views: mViews, conversions: mConversions });
  }

  // Top product views
  const topProductsRaw = await prisma.storefrontPageView.groupBy({
    by: ["productId"],
    where: { celebrityId, productId: { not: null } },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 5,
  });
  const topOutfits = topProductsRaw.map((r) => ({ outfitId: r.productId, views: r._count.productId }));

  res.json({
    data: {
      celebrityId,
      totalViews,
      uniqueVisitors,
      conversions,
      conversionRate: Number(conversionRate.toFixed(2)),
      monthly,
      topOutfits,
    },
  });
});

// POST /api/storefronts/:celebrityId/track
storefrontsRouter.post("/:celebrityId/track", async (req: Request, res: Response) => {
  const { outfitId } = req.body as { outfitId?: string };
  const visitorId = (req.headers["x-visitor-id"] as string) || randomUUID();
  recordStorefrontView(req.params.celebrityId as string, visitorId, outfitId).catch(() => { /* fire-and-forget */ });
  res.status(204).send();
});

// GET /api/storefronts/:celebrityId/payouts
storefrontsRouter.get("/:celebrityId/payouts", authenticate, async (req: Request, res: Response) => {
  const { celebrityId } = req.params as { celebrityId: string };
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
  if (!isAdmin && req.user!.role !== "CELEBRITY" && req.user!.role !== "CELEBRITY_MANAGER") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const payData = await storefrontRepository.commission();
  const summary = payData ?? { gross: 0, platformFee: 0, celebrityCommission: 0, manufacturerShare: 0 };

  const now = new Date();
  const payouts = [];
  const monthlyGross = summary.gross / 6;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const gross = monthlyGross;
    payouts.push({
      id: `payout-${monthKey}-${celebrityId}`,
      period: monthKey,
      gross: Math.round(gross),
      commission: Math.round(gross * 0.05),
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
    featuredOutfitIds: Array.isArray(featuredOutfitIds) ? (featuredOutfitIds as string[]) : [],
    message: (message as string) || "",
    verified: Boolean(verified),
  });

  if (!result) {
    res.status(404).json({ message: "Celebrity not found" });
    return;
  }

  res.status(result.created ? 201 : 200).json({ data: result.entry });
});
