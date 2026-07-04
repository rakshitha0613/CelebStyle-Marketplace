-- Sprint 4.4: Inventory Lifecycle & Fulfillment

-- 1. Add warehouse priority for allocation ordering (lower = higher priority)
ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

-- 2. Extend StockMovementType enum with reservation-specific values
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'RESERVATION';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'RELEASE';

-- 3. ReservationStatus enum
DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM (
    'RESERVED',
    'ALLOCATED',
    'RELEASED',
    'DEDUCTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. InventoryReservation table: per-order-item warehouse allocation tracking
CREATE TABLE IF NOT EXISTS "InventoryReservation" (
  "id"          TEXT                NOT NULL,
  "orderId"     TEXT                NOT NULL,
  "orderItemId" TEXT                NOT NULL,
  "inventoryId" TEXT                NOT NULL,
  "warehouseId" TEXT                NOT NULL,
  "variantId"   TEXT                NOT NULL,
  "quantity"    INTEGER             NOT NULL,
  "status"      "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "reservedAt"  TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allocatedAt" TIMESTAMP(3),
  "releasedAt"  TIMESTAMP(3),
  "deductedAt"  TIMESTAMP(3),
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- FK constraints
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_inventoryId_fkey"
    FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "InventoryReservation_orderId_idx"
  ON "InventoryReservation"("orderId");

CREATE INDEX IF NOT EXISTS "InventoryReservation_inventoryId_idx"
  ON "InventoryReservation"("inventoryId");

CREATE INDEX IF NOT EXISTS "InventoryReservation_status_idx"
  ON "InventoryReservation"("status");
