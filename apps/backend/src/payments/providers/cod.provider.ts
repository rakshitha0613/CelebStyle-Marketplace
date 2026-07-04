import { randomUUID } from "node:crypto";
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

// CashOnDeliveryProvider: no gateway call. The payment service handles COD orders
// by immediately moving them to CONFIRMED status when createPayment() is called.
export class CashOnDeliveryProvider implements PaymentGateway {
  readonly provider = "SIMULATED";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      gatewayOrderId: `cod_${randomUUID().replace(/-/g, "")}`,
      provider: this.provider,
      amountPaise: input.amountPaise,
      currency: input.currency ?? "INR",
    };
  }

  // COD is always "verified" — customer pays on delivery.
  async verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return { success: true };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return {
      refundId: `cod_refund_${randomUUID().replace(/-/g, "")}`,
      status: "MANUAL_REQUIRED",
      amountPaise: input.amountPaise,
    };
  }

  async parseWebhook(_rawBody: string, _signature: string): Promise<ParsedWebhookEvent> {
    throw new Error("COD orders do not receive payment gateway webhooks");
  }
}
