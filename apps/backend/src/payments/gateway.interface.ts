export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency?: string;
  userEmail: string;
}

export interface CreatePaymentResult {
  gatewayOrderId: string;
  gatewayKeyId?: string;
  provider: string;
  amountPaise: number;
  currency: string;
}

export interface VerifyPaymentInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  errorMessage?: string;
}

export interface RefundPaymentInput {
  gatewayPaymentId: string;
  amountPaise: number;
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  status: string;
  amountPaise: number;
}

export interface ParsedWebhookEvent {
  eventId: string;
  eventType: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  status?: string;
  provider: string;
  rawData: Record<string, unknown>;
}

export interface PaymentGateway {
  readonly provider: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  parseWebhook(rawBody: string, signature: string): Promise<ParsedWebhookEvent>;
}
