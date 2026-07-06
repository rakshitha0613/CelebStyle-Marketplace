import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { prisma } from "../lib/prisma.js";

export const specialOrdersRouter = Router();

// ── Bulk orders ───────────────────────────────────────────────────────────────

specialOrdersRouter.get("/bulk", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      const orders = await prisma.bulkOrder.findMany({
        where: isAdmin ? {} : { userId: req.user!.id },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });
      return res.json({ data: orders });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.post("/bulk", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        companyName, contactName, contactEmail, contactPhone,
        deliveryAddress, items, notes,
      } = req.body as {
        companyName?: string;
        contactName?: string;
        contactEmail?: string;
        contactPhone?: string;
        deliveryAddress?: string;
        items?: { outfitId: string; outfitName: string; quantity: number; size: string; pricePerUnit: number }[];
        notes?: string;
      };

      if (!contactEmail?.trim() || !deliveryAddress?.trim() || !items?.length) {
        return res.status(400).json({ error: "contactEmail, deliveryAddress, and items are required" });
      }

      const totalUnits = items.reduce((s, i) => s + (i.quantity || 1), 0);
      const subtotal   = items.reduce((s, i) => s + (i.pricePerUnit || 0) * (i.quantity || 1), 0);
      const discountRate = totalUnits >= 100 ? 0.15 : totalUnits >= 50 ? 0.10 : totalUnits >= 10 ? 0.05 : 0;
      const discountedTotal = subtotal * (1 - discountRate);

      const order = await prisma.bulkOrder.create({
        data: {
          userId:          req.user!.id,
          companyName:     companyName?.trim()     ?? "",
          contactName:     contactName?.trim()     ?? "",
          contactEmail:    contactEmail.trim(),
          contactPhone:    contactPhone?.trim()    ?? "",
          deliveryAddress: deliveryAddress.trim(),
          totalUnits,
          subtotal,
          discountRate,
          discountedTotal,
          notes:           notes?.trim() ?? null,
          items: {
            create: items.map((i) => ({
              productId:   i.outfitId,
              outfitName:  i.outfitName ?? i.outfitId,
              quantity:    i.quantity || 1,
              size:        i.size ?? "",
              pricePerUnit: i.pricePerUnit || 0,
            })),
          },
        },
        include: { items: true },
      });
      return res.status(201).json({ data: order });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.get("/bulk/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await prisma.bulkOrder.findUnique({
        where: { id: req.params.id as string },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Not found" });
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (order.userId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
      return res.json({ data: order });
    } catch (err) { next(err); }
  }
);

// ── Wedding orders ────────────────────────────────────────────────────────────

specialOrdersRouter.get("/wedding", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      const orders = await prisma.weddingOrder.findMany({
        where: isAdmin ? {} : { userId: req.user!.id },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      });
      return res.json({ data: orders });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.post("/wedding", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        brideName, groomName, weddingDate, venue,
        contactEmail, contactPhone, deliveryAddress,
        items, stylistNote,
      } = req.body as {
        brideName?: string;
        groomName?: string;
        weddingDate?: string;
        venue?: string;
        contactEmail?: string;
        contactPhone?: string;
        deliveryAddress?: string;
        items?: { outfitId: string; outfitName: string; quantity: number; size: string; customFabric?: string; customColour?: string; customNotes?: string; pricePerUnit: number }[];
        stylistNote?: string;
      };

      if (!contactEmail?.trim() || !weddingDate?.trim() || !deliveryAddress?.trim() || !items?.length) {
        return res.status(400).json({ error: "contactEmail, weddingDate, deliveryAddress, and items are required" });
      }

      const weddingDateObj = new Date(weddingDate);
      if (isNaN(weddingDateObj.getTime())) {
        return res.status(400).json({ error: "weddingDate must be a valid date" });
      }

      const subtotal = items.reduce((s, i) => s + (i.pricePerUnit || 0) * (i.quantity || 1), 0);
      const daysUntilWedding = (weddingDateObj.getTime() - Date.now()) / 86_400_000;
      const rushFee = daysUntilWedding < 30 && daysUntilWedding > 0 ? subtotal * 0.1 : 0;
      const total = subtotal + rushFee;

      const order = await prisma.weddingOrder.create({
        data: {
          userId:          req.user!.id,
          brideName:       brideName?.trim()  ?? "",
          groomName:       groomName?.trim()  ?? "",
          weddingDate:     weddingDateObj,
          venue:           venue?.trim()      ?? "",
          contactEmail:    contactEmail.trim(),
          contactPhone:    contactPhone?.trim() ?? "",
          deliveryAddress: deliveryAddress.trim(),
          subtotal,
          rushFee,
          total,
          stylistNote:     stylistNote?.trim() ?? null,
          items: {
            create: items.map((i) => ({
              productId:    i.outfitId,
              outfitName:   i.outfitName ?? i.outfitId,
              quantity:     i.quantity || 1,
              size:         i.size ?? "",
              customFabric: i.customFabric ?? null,
              customColour: i.customColour ?? null,
              customNotes:  i.customNotes  ?? null,
              pricePerUnit: i.pricePerUnit || 0,
            })),
          },
        },
        include: { items: true },
      });
      return res.status(201).json({ data: order });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.get("/wedding/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await prisma.weddingOrder.findUnique({
        where: { id: req.params.id as string },
        include: { items: true },
      });
      if (!order) return res.status(404).json({ error: "Not found" });
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (order.userId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
      return res.json({ data: order });
    } catch (err) { next(err); }
  }
);

// ── Customizations ────────────────────────────────────────────────────────────

specialOrdersRouter.get("/customizations", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(req.user!.role);
      const requests = await prisma.customizationRequest.findMany({
        where: isAdmin ? {} : { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });
      return res.json({ data: requests });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.post("/customizations", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        outfitId, outfitName, customFabric, customColour,
        embroidery, embroideryText, measurements, additionalNotes, estimatedPrice,
      } = req.body as {
        outfitId?: string;
        outfitName?: string;
        customFabric?: string;
        customColour?: string;
        embroidery?: boolean;
        embroideryText?: string;
        measurements?: Record<string, number>;
        additionalNotes?: string;
        estimatedPrice?: number;
      };

      if (!outfitId?.trim()) return res.status(400).json({ error: "outfitId is required" });

      const request = await prisma.customizationRequest.create({
        data: {
          userId:          req.user!.id,
          productId:       outfitId.trim(),
          outfitName:      outfitName ?? outfitId,
          customFabric:    customFabric?.trim()    ?? null,
          customColour:    customColour?.trim()    ?? null,
          embroidery:      embroidery === true,
          embroideryText:  embroideryText?.trim()  ?? null,
          measurements:    measurements            ?? {},
          additionalNotes: additionalNotes?.trim() ?? null,
          estimatedPrice:  estimatedPrice          ?? 0,
        },
      });
      return res.status(201).json({ data: request });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.patch("/customizations/:id/quote", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(req.user!.role);
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

      const existing = await prisma.customizationRequest.findUnique({ where: { id: req.params.id as string } });
      if (!existing) return res.status(404).json({ error: "Not found" });

      const { quoteAmount } = req.body as { quoteAmount?: number };
      if (!quoteAmount || quoteAmount <= 0) return res.status(400).json({ error: "quoteAmount is required" });

      const updated = await prisma.customizationRequest.update({
        where: { id: req.params.id as string },
        data: { quoteAmount, status: "QUOTED" },
      });
      return res.json({ data: updated });
    } catch (err) { next(err); }
  }
);

specialOrdersRouter.patch("/customizations/:id/status", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(req.user!.role);
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

      const { status } = req.body as { status?: string };
      const validStatuses = ["PENDING", "QUOTED", "CONFIRMED", "IN_PRODUCTION", "READY", "CANCELLED"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
      }

      const updated = await prisma.customizationRequest.update({
        where: { id: req.params.id as string },
        data: { status },
      });
      return res.json({ data: updated });
    } catch (err) { next(err); }
  }
);
