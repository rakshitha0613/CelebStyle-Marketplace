/**
 * Sprint 4.2 — Checkout API Tests
 *
 * Covers:
 *   - Auth enforcement on all endpoints (401)
 *   - GET /api/checkout/shipping — free vs paid shipping
 *   - GET /api/checkout/tax — CGST/SGST/IGST breakdown
 *   - POST /api/checkout/coupon/apply — percentage, fixed, expired, below-min, not found
 *   - POST /api/checkout/preview — amounts, empty cart, out of stock, price change warning
 *   - POST /api/checkout/confirm — creates AWAITING_PAYMENT order, reserves inventory,
 *       clears cart, idempotency key deduplication, coupon snapshot, address snapshot
 *
 * Sentinel: "@checkout42.celebstyle.test"
 * Run: npm run test:checkout
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";
import { Money } from "../lib/money.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

// ── Server ────────────────────────────────────────────────────────────────────

type HttpServer = ReturnType<typeof createServer>;
let server: HttpServer;
let port: number;

async function setupServer(): Promise<void> {
  const app = createApp();
  server    = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface Result { status: number; json: unknown }

function authH(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get(path: string, token?: string, extra?: Record<string, string>): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { ...authH(token), ...extra } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function post(path: string, body: unknown, token?: string, extra?: Record<string, string>): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: { ...authH(token), ...extra }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function del(path: string, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method: "DELETE", headers: authH(token) });
  return { status: res.status, json: res.status !== 204 ? await res.json().catch(() => null) : null };
}

// ── Sentinel & state ──────────────────────────────────────────────────────────

const SUFFIX       = "@checkout42.celebstyle.test";
const TEST_PASS    = "Checkout42!";
const PRODUCT_SLUG = "look-shah-rukh-khan-red-carpet"; // basePrice = 28999 rupees = 2899900 paise
const CHEAP_SLUG   = "look-alia-bhatt-gangubai";       // basePrice = 14999 rupees = 1499900 paise

let token1:    string;
let userId1:   string;
let addressId: string;

// Test variant + inventory for stock tests
let testProductId:   string;
let testVariantId:   string;
let testWarehouseId: string;

// Test coupons
let pctCouponCode:   string;
let fixedCouponCode: string;
let expiredCouponCode: string;
let minAmtCouponCode: string;

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    // Orders (deletes cascade to OrderItems, OrderCommission, CouponUsage)
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    // Cart items + carts
    const carts = await prisma.cart.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((c) => c.id) } } });
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Test coupons
  await prisma.coupon.deleteMany({ where: { code: { endsWith: ".CK42TEST" } } });

  // Test inventory + variant + warehouse
  const tv = await prisma.productVariant.findFirst({ where: { id: "pv-ck42test.ck42test" }, select: { id: true } });
  if (tv) {
    // StockMovements reference inventory by FK — must delete before inventory
    await prisma.stockMovement.deleteMany({ where: { inventory: { variantId: "pv-ck42test.ck42test" } } });
    await prisma.inventoryReservation.deleteMany({ where: { variantId: "pv-ck42test.ck42test" } });
    await prisma.inventory.deleteMany({ where: { variantId: "pv-ck42test.ck42test" } });
    await prisma.productVariant.delete({ where: { id: "pv-ck42test.ck42test" } });
  }
  const tw = await prisma.warehouse.findFirst({ where: { id: "wh-ck42test.ck42test" }, select: { id: true } });
  if (tw) await prisma.warehouse.delete({ where: { id: "wh-ck42test.ck42test" } });
}

async function setup(): Promise<void> {
  await cleanup();

  const passwordHash = await hashPassword(TEST_PASS);
  await prisma.user.create({
    data: { email: `user1${SUFFIX}`, passwordHash, name: "Checkout User", role: "CUSTOMER" },
  });

  const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `user1${SUFFIX}`, password: TEST_PASS }),
  });
  const loginBody = await loginRes.json() as { data: { accessToken: string; user: { id: string } } };
  token1  = loginBody.data.accessToken;
  userId1 = loginBody.data.user.id;

  // Create address via API
  const addrRes = await post("/api/addresses", {
    fullName: "Checkout User", phone: "9876543210",
    line1: "1 Test Lane", city: "Mumbai", state: "Maharashtra", pincode: "400001",
  }, token1);
  addressId = (addrRes.json as { data: { id: string } }).data.id;

  // Resolve test product
  const product = await prisma.product.findFirst({ where: { slug: PRODUCT_SLUG }, select: { id: true } });
  testProductId = product!.id;

  // Create warehouse + variant + inventory for stock tests
  const wh = await prisma.warehouse.create({
    data: { id: "wh-ck42test.ck42test", slug: "wh-ck42test", name: "CK42 Warehouse", city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  });
  testWarehouseId = wh.id;

  const variant = await prisma.productVariant.create({
    data: { id: "pv-ck42test.ck42test", productId: testProductId, size: "XS", color: "Gold", sku: "SKU-CK42TEST", priceAdjustment: 0, isAvailable: true },
  });
  testVariantId = variant.id;

  // Inventory: 2 available (3 total, 1 reserved)
  await prisma.inventory.create({
    data: { productId: testProductId, variantId: testVariantId, warehouseId: testWarehouseId, quantity: 3, reservedQuantity: 1 },
  });

  // Test coupons
  const now = new Date();
  pctCouponCode   = "PCT10.CK42TEST";
  fixedCouponCode = "FIXED500.CK42TEST";
  expiredCouponCode = "EXPIRED.CK42TEST";
  minAmtCouponCode  = "MINAMT.CK42TEST";

  await prisma.coupon.createMany({
    data: [
      { code: pctCouponCode,   type: "PERCENTAGE",  value: 10, minOrderAmount: 0,
        startsAt: new Date(now.getTime() - 86400000), expiresAt: new Date(now.getTime() + 86400000), isActive: true },
      { code: fixedCouponCode, type: "FIXED_AMOUNT", value: Money.toPaise(500), minOrderAmount: 0,
        startsAt: new Date(now.getTime() - 86400000), expiresAt: new Date(now.getTime() + 86400000), isActive: true },
      { code: expiredCouponCode, type: "PERCENTAGE", value: 10, minOrderAmount: 0,
        startsAt: new Date(now.getTime() - 172800000), expiresAt: new Date(now.getTime() - 86400000), isActive: true },
      { code: minAmtCouponCode,  type: "PERCENTAGE", value: 10, minOrderAmount: Money.toPaise(100_000), // ₹1 lakh minimum
        startsAt: new Date(now.getTime() - 86400000), expiresAt: new Date(now.getTime() + 86400000), isActive: true },
    ],
  });
}

// ── Test helpers ──────────────────────────────────────────────────────────────

async function addToCart(productSlug: string, size: string, quantity = 1): Promise<void> {
  await post("/api/cart/items", { productSlug, size, quantity }, token1);
}

async function clearCart(): Promise<void> {
  await del("/api/cart", token1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testAuthEnforcement(): Promise<void> {
  console.log("\n  [1] Auth enforcement — 401 without token");

  assertEq((await post("/api/checkout/preview", {})).status,          401, "POST /preview → 401");
  assertEq((await post("/api/checkout/confirm", {})).status,          401, "POST /confirm → 401");
  assertEq((await get("/api/checkout/shipping")).status,              401, "GET /shipping → 401");
  assertEq((await post("/api/checkout/coupon/apply", {})).status,     401, "POST /coupon/apply → 401");
  assertEq((await get("/api/checkout/tax")).status,                   401, "GET /tax → 401");
}

async function testShipping(): Promise<void> {
  console.log("\n  [2] GET /api/checkout/shipping");

  // Cheap item — shipping should be ₹499
  await clearCart();
  await addToCart(CHEAP_SLUG, "M", 1); // ₹14,999 < ₹25,000
  const r1 = await get("/api/checkout/shipping", token1);
  assertEq(r1.status, 200, "returns 200");
  const q1 = (r1.json as { data: { ratePaise: number; isFree: boolean } }).data;
  assertEq(q1.isFree, false, "subtotal < ₹25k → not free");
  assertEq(q1.ratePaise, Money.toPaise(499), "shipping rate = ₹499");

  // Expensive item — free shipping
  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1); // ₹28,999 ≥ ₹25,000
  const r2 = await get("/api/checkout/shipping", token1);
  const q2 = (r2.json as { data: { ratePaise: number; isFree: boolean } }).data;
  assertEq(q2.isFree, true, "subtotal ≥ ₹25k → free shipping");
  assertEq(q2.ratePaise, 0, "rate = 0 when free");

  await clearCart();
}

async function testTax(): Promise<void> {
  console.log("\n  [3] GET /api/checkout/tax");

  // Empty cart → 422
  await clearCart();
  const r1 = await get("/api/checkout/tax", token1);
  assertEq(r1.status, 422, "empty cart → 422");

  // Cart with item
  await addToCart(PRODUCT_SLUG, "M", 1);
  const r2 = await get("/api/checkout/tax", token1);
  assertEq(r2.status, 200, "returns 200");
  const tax = (r2.json as { data: {
    cgstPercent: number; sgstPercent: number; igstPercent: number;
    totalTaxAmount: number; taxableAmount: number; isInterState: boolean;
  } }).data;

  assert("cgstPercent" in tax, "has cgstPercent");
  assert("sgstPercent" in tax, "has sgstPercent");
  assert("igstPercent" in tax, "has igstPercent");
  assert("totalTaxAmount" in tax, "has totalTaxAmount");
  assertEq(tax.isInterState, false, "defaults to intra-state");
  // 12% of 2899900 paise = 347988 paise
  assertEq(tax.totalTaxAmount, Money.percentOf(2899900, 12), "tax = 12% of subtotal");
  assertEq(tax.cgstPercent + tax.sgstPercent, 12, "intra-state: CGST+SGST = 12%");

  await clearCart();
}

async function testCouponApply(): Promise<void> {
  console.log("\n  [4] POST /api/checkout/coupon/apply");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1);

  // Missing code
  const r0 = await post("/api/checkout/coupon/apply", {}, token1);
  assertEq(r0.status, 400, "missing code → 400");

  // Nonexistent coupon
  const r1 = await post("/api/checkout/coupon/apply", { code: "DOESNOTEXIST" }, token1);
  assertEq(r1.status, 404, "nonexistent coupon → 404");

  // Expired coupon
  const r2 = await post("/api/checkout/coupon/apply", { code: expiredCouponCode }, token1);
  assertEq(r2.status, 200, "expired coupon call succeeds (returns result)");
  const exp = (r2.json as { data: { valid: boolean; message: string } }).data;
  assertEq(exp.valid, false, "expired coupon → valid=false");
  assert(exp.message.toLowerCase().includes("expired"), "expired message");

  // Below minimum amount
  const r3 = await post("/api/checkout/coupon/apply", { code: minAmtCouponCode }, token1);
  const min = (r3.json as { data: { valid: boolean } }).data;
  assertEq(min.valid, false, "below-minimum coupon → valid=false");

  // Valid percentage coupon — 10% of 2899900 = 289990
  const r4 = await post("/api/checkout/coupon/apply", { code: pctCouponCode }, token1);
  assertEq(r4.status, 200, "valid pct coupon → 200");
  const pct = (r4.json as { data: { valid: boolean; discountPaise: number; type: string } }).data;
  assertEq(pct.valid, true, "valid percentage coupon");
  assertEq(pct.discountPaise, Money.percentOf(2899900, 10), "10% of subtotal");
  assertEq(pct.type, "PERCENTAGE", "type = PERCENTAGE");

  // Valid fixed coupon — ₹500 = 50000 paise
  const r5 = await post("/api/checkout/coupon/apply", { code: fixedCouponCode }, token1);
  const fix = (r5.json as { data: { valid: boolean; discountPaise: number } }).data;
  assertEq(fix.valid, true, "valid fixed coupon");
  assertEq(fix.discountPaise, Money.toPaise(500), "₹500 off");

  await clearCart();
}

async function testPreviewEmptyCart(): Promise<void> {
  console.log("\n  [5] POST /api/checkout/preview — empty cart");

  await clearCart();
  const r = await post("/api/checkout/preview", {}, token1);
  assertEq(r.status, 422, "empty cart → 422");
  const body = r.json as { code: string };
  assertEq(body.code, "CART_EMPTY", "error code = CART_EMPTY");
}

async function testPreviewAmounts(): Promise<void> {
  console.log("\n  [6] POST /api/checkout/preview — correct amounts");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1); // ₹28,999 → free shipping

  const r = await post("/api/checkout/preview", {}, token1);
  assertEq(r.status, 200, "returns 200");
  const preview = (r.json as { data: {
    subtotalPaise: number; shippingPaise: number; taxPaise: number;
    grandTotalPaise: number; discountPaise: number; isValid: boolean;
    lineItems: Array<{ productSlug: string; quantity: number }>;
    warnings: string[];
  } }).data;

  const subtotal  = 2899900;
  const shipping  = 0;        // free (≥ ₹25k)
  const taxable   = subtotal; // no discount
  const tax       = Money.percentOf(taxable, 12);
  const grandTotal = taxable + shipping + tax;

  assertEq(preview.subtotalPaise,   subtotal,  "subtotal = 2899900 paise");
  assertEq(preview.shippingPaise,   0,         "shipping = 0 (free)");
  assertEq(preview.discountPaise,   0,         "no discount");
  assertEq(preview.taxPaise,        tax,       "tax = 12% of subtotal");
  assertEq(preview.grandTotalPaise, grandTotal, "grand total correct");
  assertEq(preview.lineItems.length, 1,        "1 line item");
  assertEq(preview.lineItems[0].productSlug, PRODUCT_SLUG, "correct product");
  assertEq(preview.isValid, true, "cart is valid");
  assertEq(preview.warnings.length, 0, "no warnings");

  await clearCart();
}

async function testPreviewWithCoupon(): Promise<void> {
  console.log("\n  [7] POST /api/checkout/preview — with coupon");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1);

  const r = await post("/api/checkout/preview", { couponCode: pctCouponCode }, token1);
  assertEq(r.status, 200, "returns 200");
  const preview = (r.json as { data: {
    discountPaise: number; grandTotalPaise: number; coupon: { valid: boolean } | null;
  } }).data;

  const subtotal   = 2899900;
  const discount   = Money.percentOf(subtotal, 10); // 289990
  assertEq(preview.discountPaise, discount, "10% discount applied");
  assert(preview.coupon !== null, "coupon present");
  assertEq(preview.coupon!.valid, true, "coupon valid");

  // Grand total = (subtotal - discount) + shipping + tax on (subtotal - discount)
  const taxable    = subtotal - discount;
  const tax        = Money.percentOf(taxable, 12);
  const grandTotal = taxable + 0 + tax;
  assertEq(preview.grandTotalPaise, grandTotal, "grand total accounts for discount");

  await clearCart();
}

async function testPreviewPaidShipping(): Promise<void> {
  console.log("\n  [8] POST /api/checkout/preview — paid shipping for cheap cart");

  await clearCart();
  await addToCart(CHEAP_SLUG, "S", 1); // ₹14,999 → ₹499 shipping

  const r = await post("/api/checkout/preview", {}, token1);
  const preview = (r.json as { data: { shippingPaise: number; subtotalPaise: number } }).data;
  assertEq(preview.shippingPaise, Money.toPaise(499), "shipping = ₹499");
  assertEq(preview.subtotalPaise, Money.toPaise(14999), "subtotal = ₹14,999");

  await clearCart();
}

async function testPreviewOutOfStock(): Promise<void> {
  console.log("\n  [9] POST /api/checkout/preview — out of stock → isValid=false with warning");

  await clearCart();
  // Add 2 units (exactly available: total=3, reserved=1 → available=2)
  await post("/api/cart/items", { productSlug: PRODUCT_SLUG, size: "XS", color: "Gold", quantity: 2 }, token1);

  // Simulate full depletion: reserve all 3 units → available = 0
  await prisma.inventory.updateMany({
    where: { variantId: testVariantId },
    data:  { reservedQuantity: 3 },
  });

  // Preview returns 200 but isValid=false (soft warning; confirm would be the hard rejection)
  const r = await post("/api/checkout/preview", {}, token1);
  assertEq(r.status, 200, "out-of-stock preview → 200 with isValid=false");
  const preview = (r.json as { data: { isValid: boolean; warnings: string[] } }).data;
  assertEq(preview.isValid, false, "isValid = false when out of stock");
  assert(preview.warnings.length > 0, "warning message present");

  // Restore inventory
  await prisma.inventory.updateMany({
    where: { variantId: testVariantId },
    data:  { reservedQuantity: 1 },
  });
  await clearCart();
}

async function testConfirmMissingAddress(): Promise<void> {
  console.log("\n  [10] POST /api/checkout/confirm — validation errors");

  const r1 = await post("/api/checkout/confirm", {}, token1);
  assertEq(r1.status, 400, "missing addressId → 400");

  const r2 = await post("/api/checkout/confirm", { addressId: "nonexistent-id" }, token1);
  assertEq(r2.status, 404, "nonexistent address → 404");
}

async function testConfirmCreatesOrder(): Promise<void> {
  console.log("\n  [11] POST /api/checkout/confirm — creates order in AWAITING_PAYMENT");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1);

  const r = await post("/api/checkout/confirm", { addressId }, token1);
  assertEq(r.status, 201, "returns 201");

  const result = (r.json as { data: {
    orderId: string; orderNumber: string; status: string;
    grandTotalPaise: number; subtotalPaise: number; taxPaise: number;
    shippingPaise: number; discountPaise: number; itemCount: number;
    isIdempotentRepeat: boolean;
  } }).data;

  assert(result.orderNumber.startsWith("CS"), "orderNumber starts with CS");
  assertEq(result.status, "AWAITING_PAYMENT", "status = AWAITING_PAYMENT");
  assertEq(result.subtotalPaise, 2899900, "subtotal correct");
  assertEq(result.shippingPaise, 0, "free shipping");
  assertEq(result.discountPaise, 0, "no discount");
  assertEq(result.taxPaise, Money.percentOf(2899900, 12), "tax = 12%");
  assertEq(result.itemCount, 1, "1 item");
  assertEq(result.isIdempotentRepeat, false, "not a repeat");

  // Verify DB row
  const dbOrder = await prisma.order.findUnique({
    where: { orderNumber: result.orderNumber },
    select: {
      status: true, total: true, shippingName: true, shippingCity: true,
      taxSnapshot: true, shippingSnapshot: true,
      commission: { select: { platformFee: true } },
    },
  });
  assert(dbOrder !== null, "order in DB");
  assertEq(dbOrder!.status, "AWAITING_PAYMENT", "DB status = AWAITING_PAYMENT");
  assertEq(dbOrder!.shippingName, "Checkout User", "shipping name snapshot");
  assertEq(dbOrder!.shippingCity, "Mumbai", "shipping city snapshot");
  assert(dbOrder!.taxSnapshot !== null, "taxSnapshot stored");
  assert(dbOrder!.shippingSnapshot !== null, "shippingSnapshot stored");
  assert(dbOrder!.commission !== null, "commission created");
}

async function testConfirmCartCleared(): Promise<void> {
  console.log("\n  [12] POST /api/checkout/confirm — cart cleared after confirm");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1);
  await post("/api/checkout/confirm", { addressId }, token1);

  const cartRes = await get("/api/cart", token1);
  const cart    = (cartRes.json as { data: { items: unknown[] } }).data;
  assertEq(cart.items.length, 0, "cart empty after confirm");
}

async function testConfirmInventoryReserved(): Promise<void> {
  console.log("\n  [13] POST /api/checkout/confirm — inventory reservation");

  await clearCart();
  // Add item with known variant (XS/Gold — has 2 available, 1 reserved → 3 total)
  await post("/api/cart/items", { productSlug: PRODUCT_SLUG, size: "XS", color: "Gold", quantity: 1 }, token1);

  const inventoryBefore = await prisma.inventory.findFirst({
    where: { variantId: testVariantId },
    select: { reservedQuantity: true },
  });

  await post("/api/checkout/confirm", { addressId }, token1);

  const inventoryAfter = await prisma.inventory.findFirst({
    where: { variantId: testVariantId },
    select: { reservedQuantity: true },
  });

  assertEq(
    inventoryAfter!.reservedQuantity,
    inventoryBefore!.reservedQuantity + 1,
    "reservedQuantity incremented by 1"
  );
}

async function testConfirmIdempotency(): Promise<void> {
  console.log("\n  [14] POST /api/checkout/confirm — idempotency key deduplication");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 2);

  const key = `idem-test-${Date.now()}`;

  const r1 = await post("/api/checkout/confirm", { addressId, idempotencyKey: key }, token1);
  assertEq(r1.status, 201, "first request → 201");
  const result1 = (r1.json as { data: { orderNumber: string; isIdempotentRepeat: boolean } }).data;
  assertEq(result1.isIdempotentRepeat, false, "first call is not a repeat");

  const r2 = await post("/api/checkout/confirm", { addressId, idempotencyKey: key }, token1);
  assertEq(r2.status, 200, "second request → 200 (idempotent)");
  const result2 = (r2.json as { data: { orderNumber: string; isIdempotentRepeat: boolean } }).data;
  assertEq(result2.orderNumber, result1.orderNumber, "same order returned");
  assertEq(result2.isIdempotentRepeat, true, "second call is a repeat");

  // Only one order created
  const count = await prisma.order.count({ where: { idempotencyKey: key } });
  assertEq(count, 1, "exactly 1 order in DB for this idempotency key");
}

async function testConfirmWithCoupon(): Promise<void> {
  console.log("\n  [15] POST /api/checkout/confirm — with coupon");

  await clearCart();
  await addToCart(PRODUCT_SLUG, "M", 1);

  const r = await post("/api/checkout/confirm", { addressId, couponCode: pctCouponCode }, token1);
  assertEq(r.status, 201, "returns 201");

  const result = (r.json as { data: {
    discountPaise: number; grandTotalPaise: number; orderId: string;
  } }).data;

  assertEq(result.discountPaise, Money.percentOf(2899900, 10), "10% discount applied");

  // Verify coupon snapshot in DB
  const dbOrder = await prisma.order.findUnique({
    where:  { id: result.orderId },
    select: { couponCode: true, couponSnapshot: true, discountAmount: true },
  });
  assertEq(dbOrder!.couponCode, pctCouponCode, "coupon code stored");
  assert(dbOrder!.couponSnapshot !== null, "couponSnapshot stored");
  assertEq(dbOrder!.discountAmount, Money.percentOf(2899900, 10), "discountAmount in paise");

  // Verify couponUsage created
  const coupon = await prisma.coupon.findUnique({ where: { code: pctCouponCode } });
  const usage  = await prisma.couponUsage.findFirst({ where: { couponId: coupon!.id, userId: userId1 } });
  assert(usage !== null, "couponUsage record created");
}

async function testConfirmEmptyCart(): Promise<void> {
  console.log("\n  [16] POST /api/checkout/confirm — empty cart");

  await clearCart();
  const r = await post("/api/checkout/confirm", { addressId }, token1);
  assertEq(r.status, 422, "empty cart → 422");
  assertEq((r.json as { code: string }).code, "CART_EMPTY", "code = CART_EMPTY");
}

async function testIdempotencyViaHeader(): Promise<void> {
  console.log("\n  [17] POST /api/checkout/confirm — idempotency key via X-Idempotency-Key header");

  await clearCart();
  await addToCart(CHEAP_SLUG, "L", 1);

  const key = `header-idem-${Date.now()}`;
  const r1  = await post("/api/checkout/confirm", { addressId }, token1, { "X-Idempotency-Key": key });
  assertEq(r1.status, 201, "first → 201");
  const o1  = (r1.json as { data: { orderNumber: string } }).data;

  const r2  = await post("/api/checkout/confirm", { addressId }, token1, { "X-Idempotency-Key": key });
  assertEq(r2.status, 200, "repeat → 200");
  const o2  = (r2.json as { data: { orderNumber: string } }).data;
  assertEq(o2.orderNumber, o1.orderNumber, "same order returned via header key");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Sprint 4.2 — Checkout API Tests");
  console.log("=".repeat(60));

  await setupServer();

  try {
    await setup();

    await testAuthEnforcement();
    await testShipping();
    await testTax();
    await testCouponApply();
    await testPreviewEmptyCart();
    await testPreviewAmounts();
    await testPreviewWithCoupon();
    await testPreviewPaidShipping();
    await testPreviewOutOfStock();
    await testConfirmMissingAddress();
    await testConfirmCreatesOrder();
    await testConfirmCartCleared();
    await testConfirmInventoryReserved();
    await testConfirmIdempotency();
    await testConfirmWithCoupon();
    await testConfirmEmptyCart();
    await testIdempotencyViaHeader();
  } finally {
    await cleanup();
    await teardownServer();
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
