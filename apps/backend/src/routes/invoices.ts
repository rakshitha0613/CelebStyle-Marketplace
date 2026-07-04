import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { invoiceService } from "../services/invoice.service.js";
import { CommerceNotFoundError, CommerceForbiddenError } from "../lib/commerce.errors.js";

export const invoicesRouter = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)  { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceForbiddenError) { res.status(403).json({ error: err.message }); return; }
  next(err);
}

// GET /api/invoices/order/:orderId — auth (auto-generates if missing)
invoicesRouter.get("/order/:orderId", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      const userId  = isAdmin ? undefined : req.user!.id;
      const data    = await invoiceService.getForOrder(req.params.orderId as string, userId);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/invoices/order/:orderId/generate — ADMIN: explicit regeneration (idempotent)
invoicesRouter.post("/order/:orderId/generate", authenticate, authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await invoiceService.generateForOrder(req.params.orderId as string);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/invoices/:id — auth
invoicesRouter.get("/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      const userId  = isAdmin ? undefined : req.user!.id;
      const data    = await invoiceService.get(req.params.id as string, userId);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);
