import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { prisma } from "../lib/prisma.js";
import type { NotificationType } from "@prisma/client";

export const notificationsRouter = Router();

// ── Notifications ─────────────────────────────────────────────────────────────

notificationsRouter.get("/", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const unread = req.query.unread === "true";

      const where = { userId: req.user!.id, ...(unread ? { isRead: false } : {}) };
      const [list, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
      ]);
      return res.status(200).json({ data: { notifications: list, total, unreadCount, offset, limit } });
    } catch (err) { next(err); }
  }
);

notificationsRouter.patch("/:id/read", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.notification.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });
      if (!existing) return res.status(404).json({ error: "Notification not found" });
      const notif = await prisma.notification.update({
        where: { id: req.params.id as string },
        data: { isRead: true, readAt: new Date() },
      });
      return res.status(200).json({ data: notif });
    } catch (err) { next(err); }
  }
);

notificationsRouter.post("/read-all", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return res.status(200).json({ data: { marked: result.count } });
    } catch (err) { next(err); }
  }
);

notificationsRouter.delete("/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.notification.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });
      if (!existing) return res.status(404).json({ error: "Notification not found" });
      await prisma.notification.delete({ where: { id: req.params.id as string } });
      return res.status(200).json({ data: { message: "Deleted" } });
    } catch (err) { next(err); }
  }
);

// ── Internal helper ───────────────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<void> {
  await prisma.notification.create({
    data: { userId, type, title, body, actionUrl: actionUrl ?? null },
  });
  // Trim old notifications beyond 200 per user
  const oldest = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: 200,
    take: 1,
    select: { createdAt: true },
  });
  if (oldest.length > 0) {
    await prisma.notification.deleteMany({
      where: { userId, createdAt: { lte: oldest[0]!.createdAt } },
    });
  }
}

// ── Price Alerts ──────────────────────────────────────────────────────────────

notificationsRouter.get("/price-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await prisma.priceAlert.findMany({
        where: { userId: req.user!.id, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json({ data: list });
    } catch (err) { next(err); }
  }
);

notificationsRouter.post("/price-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { outfitId, outfitName, targetPrice } = req.body as {
        outfitId?: string;
        outfitName?: string;
        targetPrice?: number;
      };
      if (!outfitId?.trim() || targetPrice === undefined) {
        return res.status(400).json({ error: "outfitId and targetPrice are required" });
      }
      const alert = await prisma.priceAlert.upsert({
        where: { userId_productId: { userId: req.user!.id, productId: outfitId.trim() } },
        update: { targetPrice, isActive: true, triggeredAt: null },
        create: {
          userId: req.user!.id,
          productId: outfitId.trim(),
          outfitName: outfitName ?? outfitId,
          targetPrice,
          isActive: true,
        },
      });
      return res.status(200).json({ data: alert });
    } catch (err) { next(err); }
  }
);

notificationsRouter.delete("/price-alerts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await prisma.priceAlert.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });
      if (!alert) return res.status(404).json({ error: "Alert not found" });
      await prisma.priceAlert.update({ where: { id: req.params.id as string }, data: { isActive: false } });
      return res.status(200).json({ data: { message: "Alert removed" } });
    } catch (err) { next(err); }
  }
);

// ── Celebrity Follow Alerts ───────────────────────────────────────────────────

notificationsRouter.get("/celebrity-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = await prisma.celebrityFollowAlert.findMany({
        where: { userId: req.user!.id, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json({ data: list });
    } catch (err) { next(err); }
  }
);

notificationsRouter.post("/celebrity-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { celebrityId, celebrityName } = req.body as { celebrityId?: string; celebrityName?: string };
      if (!celebrityId?.trim()) return res.status(400).json({ error: "celebrityId is required" });
      const alert = await prisma.celebrityFollowAlert.upsert({
        where: { userId_celebrityId: { userId: req.user!.id, celebrityId: celebrityId.trim() } },
        update: { isActive: true },
        create: {
          userId: req.user!.id,
          celebrityId: celebrityId.trim(),
          celebrityName: celebrityName ?? celebrityId.trim(),
          isActive: true,
        },
      });
      return res.status(200).json({ data: alert });
    } catch (err) { next(err); }
  }
);

notificationsRouter.delete("/celebrity-alerts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await prisma.celebrityFollowAlert.findFirst({
        where: { id: req.params.id as string, userId: req.user!.id },
      });
      if (!alert) return res.status(404).json({ error: "Alert not found" });
      await prisma.celebrityFollowAlert.update({ where: { id: req.params.id as string }, data: { isActive: false } });
      return res.status(200).json({ data: { message: "Alert removed" } });
    } catch (err) { next(err); }
  }
);
