-- Sprint 4.1: Cart and Address Schema Enhancements
--
-- CartItem changes:
--   • variantId made optional (null when no ProductVariant exists for the product)
--   • size column added (string snapshot of size chosen; unique axis per cart)
--   • color column added (optional)
--   • productSnapshot JSONB column added (name/image at time of adding)
--   • Unique index changed from (cartId, variantId) → (cartId, productId, size)
--     One cart entry per product-size combination.
--
-- Address changes:
--   • isDefaultShipping flag added
--   • isDefaultBilling flag added (independent from shipping default)

-- ── CartItem ──────────────────────────────────────────────────────────────────

-- Make variantId optional so carts can hold products with no seeded variant
ALTER TABLE "CartItem" ALTER COLUMN "variantId" DROP NOT NULL;

-- Size/colour snapshot columns
ALTER TABLE "CartItem" ADD COLUMN "size"            TEXT    NOT NULL DEFAULT 'M';
ALTER TABLE "CartItem" ADD COLUMN "color"           TEXT;
ALTER TABLE "CartItem" ADD COLUMN "productSnapshot" JSONB;

-- Replace old unique index with the new composite (cartId, productId, size)
DROP INDEX IF EXISTS "CartItem_cartId_variantId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_size_key"
  ON "CartItem"("cartId", "productId", "size");

-- ── Address ───────────────────────────────────────────────────────────────────

ALTER TABLE "Address" ADD COLUMN "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Address" ADD COLUMN "isDefaultBilling"  BOOLEAN NOT NULL DEFAULT false;
