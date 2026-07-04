-- Sprint 4.3: Payment gateway schema additions

-- Add metadata column to Payment for gateway-specific session data
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- WebhookEvent: tracks processed webhook events for idempotency / replay protection
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"          TEXT         NOT NULL,
  "provider"    TEXT         NOT NULL,
  "eventId"     TEXT         NOT NULL,
  "eventType"   TEXT         NOT NULL,
  "orderId"     TEXT,
  "paymentId"   TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Composite unique ensures each (provider, eventId) pair is only processed once
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key"
  ON "WebhookEvent"("provider", "eventId");
