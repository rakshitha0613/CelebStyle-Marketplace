import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { fulfillmentService } from "../services/fulfillment.service.js";
import { CommerceNotFoundError, CommerceForbiddenError } from "../lib/commerce.errors.js";
import { prisma } from "../lib/prisma.js";

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

// ── Manufacturer Portal routes ────────────────────────────────────────────────
// MANUFACTURER_PARTNER users are linked to a Manufacturer record via contactEmail.

// GET /api/fulfillment/routing/mine — all routing assignments for current manufacturer
fulfillmentRouter.get(
  "/routing/mine",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      let manufacturerId: string | undefined;

      if (!isAdmin) {
        const mfr = await prisma.manufacturer.findFirst({
          where: { contactEmail: req.user!.email, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (!mfr) {
          return res.status(404).json({ error: "No manufacturer account linked to this email" });
        }
        manufacturerId = mfr.id;
      }

      const routings = await prisma.manufacturerRouting.findMany({
        where: manufacturerId ? { manufacturerId } : {},
        include: {
          order: {
            select: {
              orderNumber: true, customerEmail: true, shippingName: true,
              shippingAddress: true, status: true, createdAt: true,
            },
          },
          orderItem: {
            select: { productSlug: true, productName: true, category: true, size: true, unitPrice: true, imageUrl: true },
          },
        },
        orderBy: { order: { createdAt: "desc" } },
      });

      return res.status(200).json({ data: routings });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/fulfillment/routing/:id/accept — manufacturer accepts the assignment
fulfillmentRouter.post(
  "/routing/:id/accept",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const routing = await prisma.manufacturerRouting.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, manufacturerId: true, status: true },
      });
      if (!routing) { res.status(404).json({ error: "Routing not found" }); return; }

      if (req.user!.role === "MANUFACTURER_PARTNER") {
        const mfr = await prisma.manufacturer.findFirst({
          where: { contactEmail: req.user!.email },
          select: { id: true },
        });
        if (!mfr || mfr.id !== routing.manufacturerId) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
      }

      const updated = await prisma.manufacturerRouting.update({
        where: { id: routing.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return res.status(200).json({ data: updated });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/fulfillment/routing/:id/dispatch — manufacturer dispatches with tracking code
fulfillmentRouter.post(
  "/routing/:id/dispatch",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { trackingCode } = req.body as { trackingCode?: string };

      const routing = await prisma.manufacturerRouting.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, manufacturerId: true, status: true },
      });
      if (!routing) { res.status(404).json({ error: "Routing not found" }); return; }

      if (req.user!.role === "MANUFACTURER_PARTNER") {
        const mfr = await prisma.manufacturer.findFirst({
          where: { contactEmail: req.user!.email },
          select: { id: true },
        });
        if (!mfr || mfr.id !== routing.manufacturerId) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
      }

      const updated = await prisma.manufacturerRouting.update({
        where: { id: routing.id },
        data: {
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          ...(trackingCode ? { trackingCode } : {}),
        },
      });
      return res.status(200).json({ data: updated });
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
