-- Sprint 4.5: Returns, Refunds & Settlement

-- SettlementStatus enum
DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','ON_HOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RefundType enum
DO $$ BEGIN
  CREATE TYPE "RefundType" AS ENUM ('FULL','PARTIAL','AUTOMATIC','MANUAL','GATEWAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend Invoice with snapshot fields
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "orderSnapshot"    JSONB;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB;

-- Add type to Refund
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "type" "RefundType" NOT NULL DEFAULT 'FULL';

-- Settlement table
CREATE TABLE IF NOT EXISTS "Settlement" (
  "id"                    TEXT         NOT NULL,
  "orderId"               TEXT         NOT NULL,
  "platformFee"           INTEGER      NOT NULL,
  "celebrityCommission"   INTEGER      NOT NULL,
  "manufacturerShare"     INTEGER      NOT NULL,
  "taxDeducted"           INTEGER      NOT NULL DEFAULT 0,
  "netCelebrityAmount"    INTEGER      NOT NULL,
  "netManufacturerAmount" INTEGER      NOT NULL,
  "status"                "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "settledAt"             TIMESTAMP(3),
  "settledById"           TEXT,
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Settlement_orderId_key" ON "Settlement"("orderId");

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Settlement" VALIDATE CONSTRAINT "Settlement_orderId_fkey";

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_settledById_fkey"
  FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "Settlement" VALIDATE CONSTRAINT "Settlement_settledById_fkey";
