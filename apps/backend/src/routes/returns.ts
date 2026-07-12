import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { returnService } from "../services/return.service.js";
import { CommerceNotFoundError, CommerceValidationError, CommerceForbiddenError } from "../lib/commerce.errors.js";

export const returnsRouter = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)   { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceValidationError) { res.status(400).json({ error: err.message }); return; }
  if (err instanceof CommerceForbiddenError)  { res.status(403).json({ error: err.message }); return; }
  next(err);
}

// GET /api/returns — customer's own returns; ADMIN gets all with joins
returnsRouter.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    if (isAdmin) {
      const { status, limit, offset } = req.query as Record<string, string>;
      const { prisma } = await import("../lib/prisma.js");
      const where = status ? { status: status as never } : {};
      const [returns, total] = await prisma.$transaction([
        prisma.return.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: Number(limit) || 50,
          skip: Number(offset) || 0,
          include: {
            user:  { select: { id: true, name: true, email: true } },
            order: { select: { orderNumber: true, total: true } },
          },
        }),
        prisma.return.count({ where }),
      ]);
      return res.status(200).json({ data: { returns, total } });
    }
    const data = await returnService.getForUser(req.user!.id);
    return res.status(200).json({ data });
  } catch (err) { handleError(err, res, next); }
});

// POST /api/returns — customer creates return request
returnsRouter.post("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, reason, description, items } = req.body as {
      orderId?:     string;
      reason?:      string;
      description?: string;
      items?:       Array<{ orderItemId: string; quantity: number; reason?: string }>;
    };
    if (!orderId || !reason || !items?.length) {
      return res.status(400).json({ error: "orderId, reason, and items are required" });
    }
    const data = await returnService.create({ userId: req.user!.id, orderId, reason, description, items });
    return res.status(201).json({ data });
  } catch (err) { handleError(err, res, next); }
});

// GET /api/returns/:id
returnsRouter.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    const userId  = isAdmin ? undefined : req.user!.id;
    const data = await returnService.get(req.params.id as string, userId);
    return res.status(200).json({ data });
  } catch (err) { handleError(err, res, next); }
});

// PATCH /api/returns/:id/approve — ADMIN
returnsRouter.patch("/:id/approve", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await returnService.approve(req.params.id as string, req.user!.id);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/returns/:id/reject — ADMIN
returnsRouter.patch("/:id/reject", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason?: string };
      await returnService.reject(req.params.id as string, req.user!.id, reason);
      return res.status(200).json({ data: { message: "Return rejected" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/returns/:id/pickup — ADMIN
returnsRouter.patch("/:id/pickup", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { trackingCode } = req.body as { trackingCode?: string };
      await returnService.markPickedUp(req.params.id as string, trackingCode);
      return res.status(200).json({ data: { message: "Return marked as picked up" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/returns/:id/received — ADMIN
returnsRouter.patch("/:id/received", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await returnService.markReceived(req.params.id as string);
      return res.status(200).json({ data: { message: "Return marked as received" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/returns/:id/complete — ADMIN (inspection + trigger refund)
returnsRouter.patch("/:id/complete", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refundAmount } = req.body as { refundAmount?: number };
      if (refundAmount === undefined || refundAmount === null || typeof refundAmount !== "number") {
        return res.status(400).json({ error: "refundAmount is required and must be a number" });
      }
      const data = await returnService.complete(req.params.id as string, req.user!.id, refundAmount);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);
