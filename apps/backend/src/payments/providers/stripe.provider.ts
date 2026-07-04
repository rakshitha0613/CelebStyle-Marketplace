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

// MockStripeProvider: generates Stripe-shaped IDs and validates signatures without
// hitting Stripe's real API. Intended for staging / development environments.
const MOCK_KEY_ID = "pk_test_mock_stripe";
const MOCK_ENDPOINT_SECRET = "whsec_mock_stripe_secret";

export class MockStripeProvider implements PaymentGateway {
  readonly provider = "STRIPE";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      gatewayOrderId: `pi_${randomUUID().replace(/-/g, "")}`,
      gatewayKeyId: MOCK_KEY_ID,
      provider: this.provider,
      amountPaise: input.amountPaise,
      currency: input.currency ?? "INR",
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    // Stripe uses its own client_secret mechanism; here we validate a mock HMAC.
    const expected = createHmac("sha256", MOCK_ENDPOINT_SECRET)
      .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
      .digest("hex");

    if (expected !== input.gatewaySignature) {
      return { success: false, errorMessage: "Invalid Stripe payment signature" };
    }
    return { success: true };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return {
      refundId: `re_${randomUUID().replace(/-/g, "")}`,
      status: "succeeded",
      amountPaise: input.amountPaise,
    };
  }

  // Stripe webhook signature: t=timestamp,v1=hmac
  // For the mock, signature is just the HMAC of rawBody with MOCK_ENDPOINT_SECRET.
  async parseWebhook(rawBody: string, signature: string): Promise<ParsedWebhookEvent> {
    const expected = createHmac("sha256", MOCK_ENDPOINT_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expected !== signature) {
      throw new Error("Invalid Stripe webhook signature");
    }

    const data = JSON.parse(rawBody) as Record<string, unknown>;
    const object = (
      (data.data as Record<string, unknown>)?.object as Record<string, unknown>
    ) ?? {};

    return {
      eventId: (data.id as string) ?? `evt_${randomUUID()}`,
      eventType: (data.type as string) ?? "unknown",
      gatewayOrderId: (object.id as string | undefined),
      gatewayPaymentId: (object.payment_intent as string | undefined),
      status: (object.status as string | undefined),
      provider: this.provider,
      rawData: data,
    };
  }
}
