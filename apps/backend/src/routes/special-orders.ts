import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";

export const specialOrdersRouter = Router();

// ── In-memory store ──────────────────────────────────────────────────────────

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface BulkOrderItem {
  outfitId: string;
  outfitName: string;
  quantity: number;
  size: string;
  pricePerUnit: number;
}

interface BulkOrder {
  id: string;
  userId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  items: BulkOrderItem[];
  totalUnits: number;
  subtotal: number;
  discountRate: number;
  discountedTotal: number;
  notes: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface WeddingOrderItem {
  outfitId: string;
  outfitName: string;
  quantity: number;
  size: string;
  customFabric: string | null;
  customColour: string | null;
  customNotes: string | null;
  pricePerUnit: number;
}

interface WeddingOrder {
  id: string;
  userId: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  venue: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  items: WeddingOrderItem[];
  subtotal: number;
  rushFee: number;
  total: number;
  stylistNote: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface CustomizationRequest {
  id: string;
  userId: string;
  outfitId: string;
  outfitName: string;
  customFabric: string | null;
  customColour: string | null;
  embroidery: boolean;
  embroideryText: string | null;
  measurements: Record<string, number>;
  additionalNotes: string | null;
  estimatedPrice: number;
  status: "PENDING" | "QUOTED" | "CONFIRMED" | "IN_PRODUCTION" | "READY";
  quoteAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

const bulkOrders: BulkOrder[] = [];
const weddingOrders: WeddingOrder[] = [];
const customizationRequests: CustomizationRequest[] = [];

// ── Bulk orders ───────────────────────────────────────────────────────────────

// GET /api/special-orders/bulk — user's bulk orders
specialOrdersRouter.get("/bulk", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      const list = isAdmin
        ? bulkOrders
        : bulkOrders.filter((o) => o.userId === req.user!.id);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.json({ data: list });
    } catch (err) { next(err); }
  }
);

// POST /api/special-orders/bulk
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
        items?: BulkOrderItem[];
        notes?: string;
      };

      if (!contactEmail?.trim() || !deliveryAddress?.trim() || !items?.length) {
        return res.status(400).json({ error: "contactEmail, deliveryAddress, and items are required" });
      }

      const totalUnits = items.reduce((s, i) => s + (i.quantity || 1), 0);
      const subtotal = items.reduce((s, i) => s + (i.pricePerUnit || 0) * (i.quantity || 1), 0);

      // Bulk discount tiers: 10+ units → 5%, 50+ → 10%, 100+ → 15%
      const discountRate = totalUnits >= 100 ? 0.15 : totalUnits >= 50 ? 0.10 : totalUnits >= 10 ? 0.05 : 0;
      const discountedTotal = subtotal * (1 - discountRate);

      const now = new Date().toISOString();
      const order: BulkOrder = {
        id: randomUUID(),
        userId: req.user!.id,
        companyName: companyName?.trim() ?? "",
        contactName: contactName?.trim() ?? "",
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone?.trim() ?? "",
        deliveryAddress: deliveryAddress.trim(),
        items,
        totalUnits,
        subtotal,
        discountRate,
        discountedTotal,
        notes: notes?.trim() ?? null,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };
      bulkOrders.unshift(order);
      return res.status(201).json({ data: order });
    } catch (err) { next(err); }
  }
);

// GET /api/special-orders/bulk/:id
specialOrdersRouter.get("/bulk/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = bulkOrders.find((o) => o.id === req.params.id);
      if (!order) return res.status(404).json({ error: "Not found" });
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (order.userId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });
      return res.json({ data: order });
    } catch (err) { next(err); }
  }
);

// ── Wedding orders ────────────────────────────────────────────────────────────

// GET /api/special-orders/wedding
specialOrdersRouter.get("/wedding", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      const list = isAdmin
        ? weddingOrders
        : weddingOrders.filter((o) => o.userId === req.user!.id);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.json({ data: list });
    } catch (err) { next(err); }
  }
);

// POST /api/special-orders/wedding
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
        items?: WeddingOrderItem[];
        stylistNote?: string;
      };

      if (!contactEmail?.trim() || !weddingDate?.trim() || !deliveryAddress?.trim() || !items?.length) {
        return res.status(400).json({ error: "contactEmail, weddingDate, deliveryAddress, and items are required" });
      }

      const subtotal = items.reduce((s, i) => s + (i.pricePerUnit || 0) * (i.quantity || 1), 0);
      // Rush fee: 10% if wedding is within 30 days
      const daysUntilWedding = (new Date(weddingDate).getTime() - Date.now()) / 86_400_000;
      const rushFee = daysUntilWedding < 30 && daysUntilWedding > 0 ? subtotal * 0.1 : 0;
      const total = subtotal + rushFee;

      const now = new Date().toISOString();
      const order: WeddingOrder = {
        id: randomUUID(),
        userId: req.user!.id,
        brideName: brideName?.trim() ?? "",
        groomName: groomName?.trim() ?? "",
        weddingDate: weddingDate.trim(),
        venue: venue?.trim() ?? "",
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone?.trim() ?? "",
        deliveryAddress: deliveryAddress.trim(),
        items,
        subtotal,
        rushFee,
        total,
        stylistNote: stylistNote?.trim() ?? null,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };
      weddingOrders.unshift(order);
      return res.status(201).json({ data: order });
    } catch (err) { next(err); }
  }
);

// ── Customizations ────────────────────────────────────────────────────────────

// GET /api/special-orders/customizations
specialOrdersRouter.get("/customizations", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(req.user!.role);
      const list = isAdmin
        ? customizationRequests
        : customizationRequests.filter((c) => c.userId === req.user!.id);
      return res.json({ data: list });
    } catch (err) { next(err); }
  }
);

// POST /api/special-orders/customizations
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

      const now = new Date().toISOString();
      const request: CustomizationRequest = {
        id: randomUUID(),
        userId: req.user!.id,
        outfitId: outfitId.trim(),
        outfitName: outfitName ?? outfitId,
        customFabric: customFabric?.trim() ?? null,
        customColour: customColour?.trim() ?? null,
        embroidery: embroidery === true,
        embroideryText: embroideryText?.trim() ?? null,
        measurements: measurements ?? {},
        additionalNotes: additionalNotes?.trim() ?? null,
        estimatedPrice: estimatedPrice ?? 0,
        status: "PENDING",
        quoteAmount: null,
        createdAt: now,
        updatedAt: now,
      };
      customizationRequests.unshift(request);
      return res.status(201).json({ data: request });
    } catch (err) { next(err); }
  }
);

// PATCH /api/special-orders/customizations/:id/quote — ADMIN/MANUFACTURER
specialOrdersRouter.patch("/customizations/:id/quote", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(req.user!.role);
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

      const cr = customizationRequests.find((c) => c.id === req.params.id);
      if (!cr) return res.status(404).json({ error: "Not found" });

      const { quoteAmount } = req.body as { quoteAmount?: number };
      if (!quoteAmount || quoteAmount <= 0) return res.status(400).json({ error: "quoteAmount is required" });

      cr.quoteAmount = quoteAmount;
      cr.status = "QUOTED";
      cr.updatedAt = new Date().toISOString();
      return res.json({ data: cr });
    } catch (err) { next(err); }
  }
);
