-- Sprint 4.2: Checkout pipeline schema additions

-- Add AWAITING_PAYMENT status before PLACED
-- PostgreSQL 12+ allows ALTER TYPE ... ADD VALUE inside a transaction
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT' BEFORE 'PLACED';

-- Add checkout snapshot + idempotency columns to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey"   TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxSnapshot"      JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingSnapshot" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponSnapshot"   JSONB;

-- Partial unique index: enforce uniqueness only when key is present
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key"
  ON "Order"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
