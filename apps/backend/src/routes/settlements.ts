import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { settlementService } from "../services/settlement.service.js";
import { commissionService } from "../services/commission.service.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";

export const settlementsRouter  = Router();
export const commissionsRouter  = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)   { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceValidationError) { res.status(400).json({ error: err.message }); return; }
  next(err);
}

// GET /api/settlements — ADMIN: list all settlements (with order join)
settlementsRouter.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, limit, offset } = req.query as Record<string, string>;
      const { prisma } = await import("../lib/prisma.js");
      const where = status ? { status: status as never } : {};
      const [settlements, total] = await prisma.$transaction([
        prisma.settlement.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: Number(limit) || 50,
          skip: Number(offset) || 0,
          include: {
            order: {
              select: { orderNumber: true, customerEmail: true, total: true },
            },
          },
        }),
        prisma.settlement.count({ where }),
      ]);
      return res.status(200).json({ data: { settlements, total } });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/settlements — ADMIN: create settlement for an order
settlementsRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, notes } = req.body as { orderId?: string; notes?: string };
      if (!orderId) return res.status(400).json({ error: "orderId is required" });
      const data = await settlementService.createForOrder(orderId, req.user!.id, notes);
      return res.status(201).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/settlements/report — ADMIN: aggregate report
settlementsRouter.get("/report", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const data = await settlementService.report({
        from: from ? new Date(from) : undefined,
        to:   to   ? new Date(to)   : undefined,
      });
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/settlements/:id — ADMIN
settlementsRouter.get("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await settlementService.get(req.params.id as string);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/settlements/:id/pay — ADMIN: mark paid
settlementsRouter.patch("/:id/pay", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await settlementService.markPaid(req.params.id as string, req.user!.id);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/commissions/report — ADMIN: aggregate commission revenue report
commissionsRouter.get("/report", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, settled } = req.query as Record<string, string>;
      const data = await commissionService.report({
        from:    from    ? new Date(from) : undefined,
        to:      to      ? new Date(to)   : undefined,
        settled: settled !== undefined ? settled === "true" : undefined,
      });
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/commissions — ADMIN: list commission records
commissionsRouter.get("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { settled, limit, offset } = req.query as Record<string, string>;
      const data = await commissionService.list({
        settled: settled !== undefined ? settled === "true" : undefined,
        limit:   Number(limit)  || 50,
        offset:  Number(offset) || 0,
      });
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);
