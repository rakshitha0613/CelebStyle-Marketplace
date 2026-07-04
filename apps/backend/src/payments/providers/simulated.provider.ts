import { createHmac, randomUUID } from "node:crypto";
import type {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  ParsedWebhookEvent,
} from "../gateway.interface.js";

// Hardcoded secrets for the simulated provider — safe to commit, test-only.
const KEY_ID = "simulated-key-id";
const KEY_SECRET = "simulated-key-secret";
export const SIMULATED_WEBHOOK_SECRET = "simulated-webhook-secret";

export class SimulatedProvider implements PaymentGateway {
  readonly provider = "SIMULATED";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      gatewayOrderId: `sim_order_${randomUUID().replace(/-/g, "")}`,
      gatewayKeyId: KEY_ID,
      provider: this.provider,
      amountPaise: input.amountPaise,
      currency: input.currency ?? "INR",
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const expected = createHmac("sha256", KEY_SECRET)
      .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
      .digest("hex");

    if (expected !== input.gatewaySignature) {
      return { success: false, errorMessage: "Invalid payment signature" };
    }
    return { success: true };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return {
      refundId: `sim_refund_${randomUUID().replace(/-/g, "")}`,
      status: "PROCESSED",
      amountPaise: input.amountPaise,
    };
  }

  // Expected webhook body (mirrors Razorpay structure):
  // { id: "evt_xxx", event: "payment.captured", payload: { payment: { entity: { id, order_id, status } } } }
  // Signature: HMAC-SHA256(SIMULATED_WEBHOOK_SECRET, rawBody)
  async parseWebhook(rawBody: string, signature: string): Promise<ParsedWebhookEvent> {
    const expected = createHmac("sha256", SIMULATED_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expected !== signature) {
      throw new Error("Invalid webhook signature");
    }

    const data = JSON.parse(rawBody) as Record<string, unknown>;
    const entity = (
      (data.payload as Record<string, unknown>)?.payment as Record<string, unknown>
    )?.entity as Record<string, unknown> | undefined;

    return {
      eventId: (data.id as string) ?? `sim_event_${randomUUID()}`,
      eventType: (data.event as string) ?? "unknown",
      gatewayOrderId: entity?.order_id as string | undefined,
      gatewayPaymentId: entity?.id as string | undefined,
      status: entity?.status as string | undefined,
      provider: this.provider,
      rawData: data,
    };
  }
}
