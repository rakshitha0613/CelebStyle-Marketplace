import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { refundService } from "../services/refund.service.js";
import { CommerceNotFoundError, CommerceValidationError, CommerceForbiddenError } from "../lib/commerce.errors.js";

export const refundsRouter = Router();

// GET /api/refunds — list user's own refunds (admin sees all)
refundsRouter.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import("../lib/prisma.js");
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    const limit  = Math.min(Number(req.query.limit)  || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const where = isAdmin ? {} : {
      order: { userId: req.user!.id },
    };
    const refunds = await prisma.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        order: { select: { orderNumber: true, total: true } },
        payment: { select: { provider: true, method: true } },
      },
    });
    return res.status(200).json({ data: refunds });
  } catch (err) { next(err); }
});

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)   { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceValidationError) { res.status(400).json({ error: err.message }); return; }
  if (err instanceof CommerceForbiddenError)  { res.status(403).json({ error: err.message }); return; }
  next(err);
}

// POST /api/refunds — ADMIN: initiate a refund
refundsRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, paymentId, amount, type, returnId, notes } = req.body as {
        orderId?:   string;
        paymentId?: string;
        amount?:    number;
        type?:      "FULL" | "PARTIAL" | "AUTOMATIC" | "MANUAL" | "GATEWAY";
        returnId?:  string;
        notes?:     string;
      };
      if (!orderId || !paymentId || !amount) {
        return res.status(400).json({ error: "orderId, paymentId, and amount are required" });
      }
      const data = await refundService.initiate({
        orderId, paymentId, amount, type, returnId, notes, adminId: req.user!.id,
      });
      return res.status(201).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/refunds/:id — auth (owner or admin)
refundsRouter.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refund = await refundService.get(req.params.id as string);
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    if (!isAdmin) {
      // Verify ownership via order
      const { prisma } = await import("../lib/prisma.js");
      const order = await prisma.order.findUnique({ where: { id: refund.orderId }, select: { userId: true } });
      if (!order || order.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    return res.status(200).json({ data: refund });
  } catch (err) { handleError(err, res, next); }
});

// POST /api/refunds/:id/process — ADMIN: gateway refund
refundsRouter.post("/:id/process", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await refundService.processGateway(req.params.id as string, req.user!.id);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/refunds/:id/manual — ADMIN: manual (no gateway)
refundsRouter.post("/:id/manual", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notes } = req.body as { notes?: string };
      const data = await refundService.processManual(req.params.id as string, req.user!.id, notes);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);
