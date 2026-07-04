import { createHmac } from "node:crypto";
import { config } from "../../env.js";
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

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
}

export class RazorpayProvider implements PaymentGateway {
  readonly provider = "RAZORPAY";

  private get keyId(): string {
    const k = config.payment.razorpayKeyId;
    if (!k) throw new Error("RAZORPAY_KEY_ID is not configured");
    return k;
  }

  private get keySecret(): string {
    const s = config.payment.razorpayKeySecret;
    if (!s) throw new Error("RAZORPAY_KEY_SECRET is not configured");
    return s;
  }

  private get webhookSecret(): string {
    const s = config.payment.razorpayWebhookSecret;
    if (!s) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    return s;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        receipt: input.orderNumber,
        notes: { orderId: input.orderId, email: input.userEmail },
      }),
    });

    if (!response.ok) {
      const body = await response.json() as Record<string, unknown>;
      throw new Error(`Razorpay order creation failed: ${JSON.stringify(body)}`);
    }

    const data = (await response.json()) as RazorpayOrderResponse;
    return {
      gatewayOrderId: data.id,
      gatewayKeyId: this.keyId,
      provider: this.provider,
      amountPaise: data.amount,
      currency: data.currency,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const expected = createHmac("sha256", this.keySecret)
      .update(`${input.gatewayOrderId}|${input.gatewayPaymentId}`)
      .digest("hex");

    if (expected !== input.gatewaySignature) {
      return { success: false, errorMessage: "Invalid payment signature" };
    }
    return { success: true };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${input.gatewayPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({ amount: input.amountPaise, notes: { reason: input.reason ?? "" } }),
      }
    );

    if (!response.ok) {
      const body = await response.json() as Record<string, unknown>;
      throw new Error(`Razorpay refund failed: ${JSON.stringify(body)}`);
    }

    const data = (await response.json()) as { id: string; status: string; amount: number };
    return { refundId: data.id, status: data.status, amountPaise: data.amount };
  }

  // Signature header: X-Razorpay-Signature
  // Payload: HMAC-SHA256(webhookSecret, rawBody)
  async parseWebhook(rawBody: string, signature: string): Promise<ParsedWebhookEvent> {
    const expected = createHmac("sha256", this.webhookSecret)
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
      eventId: (data.id as string) ?? `rzp_${Date.now()}`,
      eventType: (data.event as string) ?? "unknown",
      gatewayOrderId: entity?.order_id as string | undefined,
      gatewayPaymentId: entity?.id as string | undefined,
      status: entity?.status as string | undefined,
      provider: this.provider,
      rawData: data,
    };
  }
}
