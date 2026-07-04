import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { fulfillmentService } from "../services/fulfillment.service.js";
import { CommerceNotFoundError, CommerceForbiddenError } from "../lib/commerce.errors.js";

export const fulfillmentRouter = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError) { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceForbiddenError) { res.status(403).json({ error: err.message }); return; }
  next(err);
}

// GET /api/fulfillment/:orderId — get fulfillment status (auth, user sees own order)
fulfillmentRouter.get(
  "/:orderId",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      const userId = isAdmin ? undefined : req.user!.id;
      const data = await fulfillmentService.getStatus(req.params.orderId as string, userId);
      return res.status(200).json({ data });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/fulfillment/:orderId/allocate — move PLACED→CONFIRMED (ADMIN)
fulfillmentRouter.post(
  "/:orderId/allocate",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fulfillmentService.allocate(req.params.orderId as string);
      return res.status(200).json({ data: { message: "Order allocated and confirmed" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/fulfillment/:orderId/ship — ship order, deducts stock (ADMIN)
fulfillmentRouter.post(
  "/:orderId/ship",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { trackingCode, carrier } = req.body as { trackingCode?: string; carrier?: string };
      await fulfillmentService.ship(req.params.orderId as string, { trackingCode, carrier });
      return res.status(200).json({ data: { message: "Order shipped" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/fulfillment/:orderId/deliver — mark delivered (ADMIN)
fulfillmentRouter.post(
  "/:orderId/deliver",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fulfillmentService.deliver(req.params.orderId as string);
      return res.status(200).json({ data: { message: "Order delivered" } });
    } catch (err) { handleError(err, res, next); }
  }
);

// DELETE /api/fulfillment/reservations/:orderId — admin manual release (ADMIN)
fulfillmentRouter.delete(
  "/reservations/:orderId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reason = (req.body?.reason as "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED") ?? "CANCELLED";
      await fulfillmentService.releaseReservations(req.params.orderId as string, reason);
      return res.status(200).json({ data: { message: "Reservations released" } });
    } catch (err) { handleError(err, res, next); }
  }
);
