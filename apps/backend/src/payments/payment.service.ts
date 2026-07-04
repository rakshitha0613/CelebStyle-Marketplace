import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getGateway } from "./gateway.factory.js";
import { fulfillmentService } from "../services/fulfillment.service.js";
import { reservationService } from "../services/reservation.service.js";

type SupportedMethod = "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI" | "COD";

interface CreateResult {
  paymentId?: string;
  gatewayOrderId?: string;
  gatewayKeyId?: string;
  provider: string;
  amountPaise: number;
  currency: string;
  method: string;
  confirmed?: boolean;
  orderStatus?: string;
}

interface VerifyResult {
  success: boolean;
  orderId: string;
  orderStatus: string;
}

interface WebhookResult {
  processed: boolean;
  reason?: string;
}

class PaymentService {
  async create(orderId: string, userId: string, method: SupportedMethod = "UPI"): Promise<CreateResult> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw { status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" };
    if (order.userId !== userId) throw { status: 403, code: "FORBIDDEN", message: "Forbidden" };
    if (order.status !== "AWAITING_PAYMENT") {
      throw {
        status: 409,
        code: "ORDER_NOT_PAYABLE",
        message: `Order cannot be paid — current status: ${order.status}`,
      };
    }

    const gateway = getGateway(method);

    // COD: immediately capture and confirm, no gateway session needed for later verify
    if (method === "COD") {
      const codResult = await gateway.createPayment({
        orderId,
        orderNumber: order.orderNumber,
        amountPaise: order.total,
        currency: "INR",
        userEmail: order.customerEmail,
      });

      await prisma.$transaction([
        prisma.payment.create({
          data: {
            orderId,
            provider: "SIMULATED",
            method: "COD",
            amount: order.total,
            currency: "INR",
            status: "CAPTURED",
            providerOrderId: codResult.gatewayOrderId,
            capturedAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { status: "CONFIRMED", paymentStatus: "CAPTURED" },
        }),
      ]);

      return {
        provider: "COD",
        amountPaise: order.total,
        currency: "INR",
        method: "COD",
        confirmed: true,
        orderStatus: "CONFIRMED",
      };
    }

    // Online payment: return cached session if one already exists (idempotency)
    const existing = await prisma.payment.findFirst({
      where: { orderId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.providerOrderId) {
      const meta = existing.metadata as Record<string, unknown> | null;
      return {
        paymentId: existing.id,
        gatewayOrderId: existing.providerOrderId,
        gatewayKeyId: meta?.gatewayKeyId as string | undefined,
        provider: existing.provider,
        amountPaise: existing.amount,
        currency: existing.currency,
        method,
      };
    }

    const gatewayResult = await gateway.createPayment({
      orderId,
      orderNumber: order.orderNumber,
      amountPaise: order.total,
      currency: "INR",
      userEmail: order.customerEmail,
    });

    // Map gateway.provider string to PaymentProvider enum
    const providerEnum = gateway.provider as "RAZORPAY" | "STRIPE" | "SIMULATED";

    const payment = await prisma.payment.create({
      data: {
        orderId,
        provider: providerEnum,
        method: method as "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI",
        amount: order.total,
        currency: "INR",
        status: "PENDING",
        providerOrderId: gatewayResult.gatewayOrderId,
        metadata: { gatewayKeyId: gatewayResult.gatewayKeyId ?? null },
      },
    });

    return {
      paymentId: payment.id,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      gatewayKeyId: gatewayResult.gatewayKeyId,
      provider: gateway.provider,
      amountPaise: order.total,
      currency: "INR",
      method,
    };
  }

  async verify(input: {
    orderId: string;
    userId: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
  }): Promise<VerifyResult> {
    const { orderId, userId, gatewayOrderId, gatewayPaymentId, gatewaySignature } = input;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw { status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" };
    if (order.userId !== userId) throw { status: 403, code: "FORBIDDEN", message: "Forbidden" };
    if (order.status !== "AWAITING_PAYMENT") {
      throw {
        status: 409,
        code: "ORDER_ALREADY_PROCESSED",
        message: "Order has already been processed",
      };
    }

    const payment = await prisma.payment.findFirst({
      where: { orderId, providerOrderId: gatewayOrderId, status: "PENDING" },
    });
    if (!payment) {
      throw { status: 404, code: "PAYMENT_NOT_FOUND", message: "Payment session not found" };
    }

    // NEVER trust the client's claim about payment status — always verify the signature.
    const gateway = getGateway();
    const result = await gateway.verifyPayment({ gatewayOrderId, gatewayPaymentId, gatewaySignature });

    if (!result.success) {
      // Invalid signature = client bug or tampering attempt.
      // Do NOT mark payment as FAILED — the session stays PENDING so the user can retry.
      // Actual payment declines arrive via webhook (payment.failed event).
      throw {
        status: 422,
        code: "PAYMENT_VERIFICATION_FAILED",
        message: result.errorMessage ?? "Payment verification failed",
      };
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          providerPaymentId: gatewayPaymentId,
          capturedAt: new Date(),
          gatewayResponse: { gatewayOrderId, gatewayPaymentId, gatewaySignature } as Prisma.InputJsonValue,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: "PLACED", paymentStatus: "CAPTURED" },
      }),
    ]);
    // Fire-and-forget: allocate inventory after payment capture
    fulfillmentService.allocate(orderId).catch((err) => {
      console.error(`[payment] Failed to allocate order ${orderId}:`, err);
    });

    return { success: true, orderId, orderStatus: "PLACED" };
  }

  async handleWebhook(rawBody: string, signature: string): Promise<WebhookResult> {
    const gateway = getGateway();

    let parsed;
    try {
      parsed = await gateway.parseWebhook(rawBody, signature);
    } catch {
      throw { status: 400, code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid webhook signature" };
    }

    // Idempotency: reject duplicate webhook deliveries
    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: parsed.provider, eventId: parsed.eventId } },
    });
    if (existing) {
      return { processed: false, reason: "duplicate" };
    }

    const payment = parsed.gatewayOrderId
      ? await prisma.payment.findFirst({ where: { providerOrderId: parsed.gatewayOrderId } })
      : null;

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    if (payment) {
      if (parsed.eventType === "payment.captured" || parsed.eventType === "order.paid") {
        ops.push(
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "CAPTURED",
              providerPaymentId: parsed.gatewayPaymentId,
              capturedAt: new Date(),
              gatewayResponse: parsed.rawData as Prisma.InputJsonValue,
            },
          }),
          prisma.order.update({
            where: { id: payment.orderId },
            data: { status: "PLACED", paymentStatus: "CAPTURED" },
          })
        );
        // Fire-and-forget: allocate inventory after batch completes
        setTimeout(() => {
          fulfillmentService.allocate(payment.orderId).catch((err) => {
            console.error(`[webhook] Failed to allocate order ${payment.orderId}:`, err);
          });
        }, 50);
      } else if (parsed.eventType === "payment.failed") {
        ops.push(
          prisma.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED", gatewayResponse: parsed.rawData as Prisma.InputJsonValue },
          })
        );
        // Fire-and-forget: release reservations after batch completes
        setTimeout(() => {
          reservationService.release(payment.orderId, "PAYMENT_FAILED").catch((err) => {
            console.error(`[webhook] Failed to release reservations for order ${payment.orderId}:`, err);
          });
        }, 50);
      }
    }

    ops.push(
      prisma.webhookEvent.create({
        data: {
          provider: parsed.provider,
          eventId: parsed.eventId,
          eventType: parsed.eventType,
          orderId: payment?.orderId ?? null,
          paymentId: parsed.gatewayPaymentId ?? null,
        },
      })
    );

    await prisma.$transaction(ops);
    return { processed: true };
  }
}

export const paymentService = new PaymentService();
