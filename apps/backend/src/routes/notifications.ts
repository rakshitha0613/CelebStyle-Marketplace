import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";

export const notificationsRouter = Router();

// ── In-memory store ──────────────────────────────────────────────────────────

type NotificationType =
  | "ORDER_STATUS"
  | "PRICE_DROP"
  | "BACK_IN_STOCK"
  | "NEW_COLLECTION"
  | "COMMUNITY_LIKE"
  | "COMMUNITY_COMMENT"
  | "CELEBRITY_NEW_OUTFIT"
  | "REVIEW_APPROVED"
  | "RETURN_UPDATE"
  | "REFUND_UPDATE"
  | "SYSTEM";

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

interface PriceAlert {
  id: string;
  userId: string;
  outfitId: string;
  outfitName: string;
  targetPrice: number;
  currentPrice: number;
  active: boolean;
  createdAt: string;
}

interface CelebrityAlert {
  id: string;
  userId: string;
  celebrityId: string;
  celebrityName: string;
  active: boolean;
  createdAt: string;
}

const notifications: Notification[] = [];
const priceAlerts: PriceAlert[] = [];
const celebrityAlerts: CelebrityAlert[] = [];

// ── Notifications ─────────────────────────────────────────────────────────────

// GET /api/notifications — auth user's notifications
notificationsRouter.get("/", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit   = Math.min(Number(req.query.limit) || 20, 100);
      const offset  = Number(req.query.offset) || 0;
      const unread  = req.query.unread === "true";

      let list = notifications.filter((n) => n.userId === req.user!.id);
      if (unread) list = list.filter((n) => !n.read);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const total     = list.length;
      const unreadCount = notifications.filter((n) => n.userId === req.user!.id && !n.read).length;
      const page      = list.slice(offset, offset + limit);
      return res.status(200).json({ data: { notifications: page, total, unreadCount, offset, limit } });
    } catch (err) { next(err); }
  }
);

// PATCH /api/notifications/:id/read — mark one as read
notificationsRouter.patch("/:id/read", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notif = notifications.find((n) => n.id === req.params.id && n.userId === req.user!.id);
      if (!notif) return res.status(404).json({ error: "Notification not found" });
      notif.read = true;
      return res.status(200).json({ data: notif });
    } catch (err) { next(err); }
  }
);

// POST /api/notifications/read-all — mark all as read
notificationsRouter.post("/read-all", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let count = 0;
      for (const n of notifications) {
        if (n.userId === req.user!.id && !n.read) {
          n.read = true;
          count++;
        }
      }
      return res.status(200).json({ data: { marked: count } });
    } catch (err) { next(err); }
  }
);

// DELETE /api/notifications/:id
notificationsRouter.delete("/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idx = notifications.findIndex((n) => n.id === req.params.id && n.userId === req.user!.id);
      if (idx < 0) return res.status(404).json({ error: "Notification not found" });
      notifications.splice(idx, 1);
      return res.status(200).json({ data: { message: "Deleted" } });
    } catch (err) { next(err); }
  }
);

// ── Internal helper — used by other routes to create notifications ────────────

export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  actionUrl?: string,
): void {
  notifications.unshift({
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    actionUrl: actionUrl ?? null,
    read: false,
    createdAt: new Date().toISOString(),
  });
  // Keep at most 200 notifications per user
  const userNotifs = notifications.filter((n) => n.userId === userId);
  if (userNotifs.length > 200) {
    const oldest = userNotifs[userNotifs.length - 1]!;
    const idx = notifications.findIndex((n) => n.id === oldest.id);
    if (idx >= 0) notifications.splice(idx, 1);
  }
}

// ── Price Alerts ──────────────────────────────────────────────────────────────

// GET /api/notifications/price-alerts
notificationsRouter.get("/price-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = priceAlerts.filter((a) => a.userId === req.user!.id && a.active);
      return res.status(200).json({ data: list });
    } catch (err) { next(err); }
  }
);

// POST /api/notifications/price-alerts
notificationsRouter.post("/price-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { outfitId, outfitName, targetPrice, currentPrice } = req.body as {
        outfitId?: string;
        outfitName?: string;
        targetPrice?: number;
        currentPrice?: number;
      };
      if (!outfitId?.trim() || !targetPrice || !currentPrice) {
        return res.status(400).json({ error: "outfitId, targetPrice, and currentPrice are required" });
      }
      const existing = priceAlerts.find((a) => a.outfitId === outfitId && a.userId === req.user!.id && a.active);
      if (existing) {
        existing.targetPrice = targetPrice;
        return res.status(200).json({ data: existing });
      }
      const alert: PriceAlert = {
        id: randomUUID(),
        userId: req.user!.id,
        outfitId: outfitId.trim(),
        outfitName: outfitName ?? outfitId,
        targetPrice,
        currentPrice,
        active: true,
        createdAt: new Date().toISOString(),
      };
      priceAlerts.push(alert);
      return res.status(201).json({ data: alert });
    } catch (err) { next(err); }
  }
);

// DELETE /api/notifications/price-alerts/:id
notificationsRouter.delete("/price-alerts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = priceAlerts.find((a) => a.id === req.params.id && a.userId === req.user!.id);
      if (!alert) return res.status(404).json({ error: "Alert not found" });
      alert.active = false;
      return res.status(200).json({ data: { message: "Alert removed" } });
    } catch (err) { next(err); }
  }
);

// ── Celebrity Follow Alerts ───────────────────────────────────────────────────

// GET /api/notifications/celebrity-alerts
notificationsRouter.get("/celebrity-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const list = celebrityAlerts.filter((a) => a.userId === req.user!.id && a.active);
      return res.status(200).json({ data: list });
    } catch (err) { next(err); }
  }
);

// POST /api/notifications/celebrity-alerts
notificationsRouter.post("/celebrity-alerts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { celebrityId, celebrityName } = req.body as { celebrityId?: string; celebrityName?: string };
      if (!celebrityId?.trim()) return res.status(400).json({ error: "celebrityId is required" });
      const existing = celebrityAlerts.find(
        (a) => a.celebrityId === celebrityId && a.userId === req.user!.id && a.active
      );
      if (existing) return res.status(409).json({ error: "Already following this celebrity" });
      const alert: CelebrityAlert = {
        id: randomUUID(),
        userId: req.user!.id,
        celebrityId: celebrityId.trim(),
        celebrityName: celebrityName ?? celebrityId,
        active: true,
        createdAt: new Date().toISOString(),
      };
      celebrityAlerts.push(alert);
      return res.status(201).json({ data: alert });
    } catch (err) { next(err); }
  }
);

// DELETE /api/notifications/celebrity-alerts/:id
notificationsRouter.delete("/celebrity-alerts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = celebrityAlerts.find((a) => a.id === req.params.id && a.userId === req.user!.id);
      if (!alert) return res.status(404).json({ error: "Alert not found" });
      alert.active = false;
      return res.status(200).json({ data: { message: "Alert removed" } });
    } catch (err) { next(err); }
  }
);
