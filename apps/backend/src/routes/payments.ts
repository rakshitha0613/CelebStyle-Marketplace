import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { paymentService } from "../payments/payment.service.js";
import { orderRepository } from "../repositories/order.repository.js";
import { prisma } from "../lib/prisma.js";

export const paymentsRouter = Router();

// POST /api/payments/create — auth required
paymentsRouter.post(
  "/create",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, method } = req.body as { orderId?: string; method?: string };
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
      }
      const result = await paymentService.create(orderId, req.user!.id, method as never);
      return res.status(200).json({ data: result });
    } catch (err: unknown) {
      const e = err as { status?: number; code?: string; message?: string };
      if (e.status) return res.status(e.status).json({ error: e.message, code: e.code });
      return next(err);
    }
  }
);

// POST /api/payments/verify — auth required
// Never trusts client-supplied payment status; always re-verifies signature.
paymentsRouter.post(
  "/verify",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body as {
        orderId?: string;
        gatewayOrderId?: string;
        gatewayPaymentId?: string;
        gatewaySignature?: string;
      };

      if (!orderId || !gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
        return res.status(400).json({
          error: "orderId, gatewayOrderId, gatewayPaymentId, and gatewaySignature are required",
        });
      }

      const result = await paymentService.verify({
        orderId,
        userId: req.user!.id,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
      });
      return res.status(200).json({ data: result });
    } catch (err: unknown) {
      const e = err as { status?: number; code?: string; message?: string };
      if (e.status) return res.status(e.status).json({ error: e.message, code: e.code });
      return next(err);
    }
  }
);

// POST /api/payments/simulate — dev payment simulator (one-shot: create + auto-verify)
paymentsRouter.post(
  "/simulate",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderNumber } = req.body as { orderNumber?: string };
      if (!orderNumber) {
        return res.status(400).json({ error: "orderNumber is required" });
      }

      const order = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true, userId: true, customerEmail: true, paymentStatus: true },
      });
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Ownership: userId match if set, otherwise fall back to email; admin may bypass
      const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
      const isOwner = order.userId
        ? order.userId === req.user!.id
        : order.customerEmail === req.user!.email;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Duplicate prevention: already captured → idempotent success
      if (order.paymentStatus === "CAPTURED") {
        const existing = await orderRepository.findByOrderNumber(orderNumber);
        return res.status(200).json({ data: { success: true, orderId: orderNumber, order: existing } });
      }

      const result = await orderRepository.pay(orderNumber);
      return res.status(200).json({ data: { success: true, orderId: orderNumber, order: result } });
    } catch (err: unknown) {
      const e = err as { status?: number; code?: string; message?: string };
      if (e.status) return res.status(e.status).json({ error: e.message, code: e.code });
      return next(err);
    }
  }
);

// POST /api/payments/webhook — NO authentication; signature is verified inside the service.
// Razorpay sends signature in X-Razorpay-Signature; generic/simulated tests use X-Payment-Signature.
paymentsRouter.post("/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature =
      (req.headers["x-razorpay-signature"] as string | undefined) ??
      (req.headers["x-payment-signature"] as string | undefined) ??
      "";

    const rawBody = req.rawBody ?? "";
    const result = await paymentService.handleWebhook(rawBody, signature);
    return res.status(200).json({ data: result });
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    if (e.status) return res.status(e.status).json({ error: e.message, code: e.code });
    return next(err);
  }
});
