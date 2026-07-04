import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { paymentService } from "../payments/payment.service.js";

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
