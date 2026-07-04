/**
 * Sprint 4.1 — Cart API Tests
 *
 * Covers:
 *   - GET/DELETE /api/cart
 *   - POST /api/cart/items (add, duplicate, quantity increment)
 *   - PATCH /api/cart/items/:id (update quantity, set to 0 removes item)
 *   - DELETE /api/cart/items/:id (remove item)
 *   - POST /api/cart/merge (best-effort merge with skipped report)
 *   - Auth enforcement (401 with no token)
 *   - Ownership enforcement (403 when accessing another user's cart item)
 *   - Validation errors (400 for bad inputs)
 *   - ProductVariant + Inventory stock checks
 *   - paise storage verification
 *
 * All test accounts use "@cart41.celebstyle.test" sentinel.
 *
 * Run: npm run test:cart
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";
import { Money } from "../lib/money.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

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
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface Result {
  status: number;
  json: unknown;
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get(path: string, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: authHeaders(token) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function post(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function patch(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function del(path: string, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return { status: res.status, json: res.status !== 204 ? await res.json().catch(() => null) : null };
}

// ── Sentinel & state ──────────────────────────────────────────────────────────

const SUFFIX = "@cart41.celebstyle.test";
const TEST_PASSWORD = "CartTest41!";

let token1: string;
let token2: string;
let userId1: string;

// Product confirmed present in seeded DB (basePrice = 28999 rupees)
const TEST_PRODUCT_SLUG = "look-shah-rukh-khan-red-carpet";

// We create a test variant + inventory for stock-check tests
let testVariantId: string;
let testProductId: string;
let testWarehouseId: string;

// ── Setup / Teardown ──────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Cleanup order: CartItems → Carts → Inventory → ProductVariant → Users
  const users = await prisma.user.findMany({
    where:  { email: { endsWith: SUFFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    const carts = await prisma.cart.findMany({
      where:  { userId: { in: userIds } },
      select: { id: true },
    });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((c) => c.id) } } });
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
  }

  // Clean up test inventory + variant + warehouse
  const testVariant = await prisma.productVariant.findUnique({
    where:  { id: "pv-cart41test.cart41test" },
    select: { id: true },
  });
  if (testVariant) {
    await prisma.inventory.deleteMany({ where: { variantId: "pv-cart41test.cart41test" } });
    await prisma.productVariant.delete({ where: { id: "pv-cart41test.cart41test" } });
  }
  const testWh = await prisma.warehouse.findUnique({ where: { id: "wh-cart41test.cart41test" }, select: { id: true } });
  if (testWh) {
    await prisma.warehouse.delete({ where: { id: "wh-cart41test.cart41test" } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function setup(): Promise<void> {
  await cleanup();

  const passwordHash = await hashPassword(TEST_PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: `user1${SUFFIX}`, passwordHash, name: "Cart User One", role: "CUSTOMER" },
      { email: `user2${SUFFIX}`, passwordHash, name: "Cart User Two", role: "CUSTOMER" },
    ],
  });

  const loginAs = async (email: string): Promise<{ token: string; id: string }> => {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const body = await res.json() as { data: { accessToken: string; user: { id: string } } };
    return { token: body.data.accessToken, id: body.data.user.id };
  };

  const [u1, u2] = await Promise.all([
    loginAs(`user1${SUFFIX}`),
    loginAs(`user2${SUFFIX}`),
  ]);
  token1  = u1.token;
  userId1 = u1.id;
  token2  = u2.token;

  // Resolve the test product's DB id
  const product = await prisma.product.findFirst({
    where:  { slug: TEST_PRODUCT_SLUG },
    select: { id: true },
  });
  testProductId = product!.id;

  // Create a warehouse for inventory tests
  const wh = await prisma.warehouse.create({
    data: {
      id:      "wh-cart41test.cart41test",
      slug:    "wh-cart41test",
      name:    "Cart Test Warehouse",
      city:    "Test City",
      state:   "Test State",
      pincode: "000001",
    },
  });
  testWarehouseId = wh.id;

  // Create a ProductVariant with limited stock for stock-check tests
  const variant = await prisma.productVariant.create({
    data: {
      id:              "pv-cart41test.cart41test",
      productId:       testProductId,
      size:            "XXL",
      color:           "Red",
      sku:             "SKU-CART41TEST",
      priceAdjustment: 0,
      isAvailable:     true,
    },
  });
  testVariantId = variant.id;

  // Create inventory: 3 total, 1 reserved → 2 available
  await prisma.inventory.create({
    data: {
      productId:        testProductId,
      variantId:        testVariantId,
      warehouseId:      testWarehouseId,
      quantity:         3,
      reservedQuantity: 1,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testAuthEnforcement(): Promise<void> {
  console.log("\n  [1] Auth enforcement");

  const r1 = await get("/api/cart");
  assertEq(r1.status, 401, "GET /api/cart without token → 401");

  const r2 = await post("/api/cart/items", { productSlug: TEST_PRODUCT_SLUG, size: "M", quantity: 1 });
  assertEq(r2.status, 401, "POST /api/cart/items without token → 401");

  const r3 = await del("/api/cart");
  assertEq(r3.status, 401, "DELETE /api/cart without token → 401");

  const r4 = await post("/api/cart/merge", { items: [] });
  assertEq(r4.status, 401, "POST /api/cart/merge without token → 401");
}

async function testGetCart(): Promise<void> {
  console.log("\n  [2] GET /api/cart — auto-creates empty cart");

  const r = await get("/api/cart", token1);
  assertEq(r.status, 200, "returns 200");
  const cart = (r.json as { data: { items: unknown[]; subtotalPaise: number; itemCount: number } }).data;
  assert(Array.isArray(cart.items), "items is array");
  assertEq(cart.items.length, 0, "empty cart has 0 items");
  assertEq(cart.subtotalPaise, 0, "empty cart subtotal = 0");
  assertEq(cart.itemCount, 0, "empty cart itemCount = 0");
}

async function testAddItem(): Promise<void> {
  console.log("\n  [3] POST /api/cart/items — add item");

  const r = await post("/api/cart/items", {
    productSlug: TEST_PRODUCT_SLUG,
    size:        "M",
    quantity:    1,
  }, token1);
  assertEq(r.status, 201, "returns 201");

  const cart = (r.json as { data: { items: Array<{
    productSlug: string; size: string; quantity: number;
    unitPricePaise: number; totalPricePaise: number; availableStock: number;
  }>; subtotalPaise: number; itemCount: number } }).data;
  assertEq(cart.items.length, 1, "cart has 1 item after add");
  assertEq(cart.items[0].productSlug, TEST_PRODUCT_SLUG, "item has correct productSlug");
  assertEq(cart.items[0].size, "M", "item has correct size");
  assertEq(cart.items[0].quantity, 1, "item quantity = 1");

  // Verify paise: 28999 rupees × 100 = 2899900 paise
  const expectedPaise = Money.toPaise(28999);
  assertEq(cart.items[0].unitPricePaise, expectedPaise, "price stored in paise");
  assertEq(cart.items[0].totalPricePaise, expectedPaise, "total = unit × qty");
  assertEq(cart.subtotalPaise, expectedPaise, "cart subtotal matches");
  assertEq(cart.itemCount, 1, "itemCount = 1");
}

async function testAddItemValidation(): Promise<void> {
  console.log("\n  [4] POST /api/cart/items — validation");

  const r1 = await post("/api/cart/items", { size: "M", quantity: 1 }, token1);
  assertEq(r1.status, 400, "missing productSlug → 400");

  const r2 = await post("/api/cart/items", { productSlug: TEST_PRODUCT_SLUG, quantity: 1 }, token1);
  assertEq(r2.status, 400, "missing size → 400");

  const r3 = await post("/api/cart/items", { productSlug: TEST_PRODUCT_SLUG, size: "M", quantity: 0 }, token1);
  assertEq(r3.status, 400, "quantity=0 → 400");

  const r4 = await post("/api/cart/items", { productSlug: "nonexistent-slug", size: "M", quantity: 1 }, token1);
  assertEq(r4.status, 404, "nonexistent product → 404");
}

async function testDuplicateItemIncrementsQuantity(): Promise<void> {
  console.log("\n  [5] POST /api/cart/items — duplicate increments quantity");

  // Current cart already has 1×M from test [3].
  const r = await post("/api/cart/items", {
    productSlug: TEST_PRODUCT_SLUG,
    size:        "M",
    quantity:    2,
  }, token1);
  assertEq(r.status, 201, "returns 201");

  const cart = (r.json as { data: { items: Array<{ quantity: number; size: string }>; itemCount: number } }).data;
  assertEq(cart.items.length, 1, "still 1 distinct item (same product+size)");
  assertEq(cart.items[0].quantity, 3, "quantity incremented to 3");
  assertEq(cart.itemCount, 3, "itemCount = 3");
}

async function testDifferentSizeAddsSeparateItem(): Promise<void> {
  console.log("\n  [6] POST /api/cart/items — different size adds separate entry");

  const r = await post("/api/cart/items", {
    productSlug: TEST_PRODUCT_SLUG,
    size:        "L",
    quantity:    1,
  }, token1);
  assertEq(r.status, 201, "returns 201");

  const cart = (r.json as { data: { items: Array<{ size: string; quantity: number }> } }).data;
  assertEq(cart.items.length, 2, "2 distinct items (M and L)");
}

async function testUpdateItemQuantity(): Promise<void> {
  console.log("\n  [7] PATCH /api/cart/items/:id — update quantity");

  const cartRes = await get("/api/cart", token1);
  const items = (cartRes.json as { data: { items: Array<{ id: string; size: string; quantity: number }> } }).data.items;
  const mItem = items.find((i) => i.size === "M")!;

  const r = await patch(`/api/cart/items/${mItem.id}`, { quantity: 5 }, token1);
  assertEq(r.status, 200, "returns 200");
  const updated = (r.json as { data: { items: Array<{ id: string; quantity: number }> } }).data.items.find((i) => i.id === mItem.id)!;
  assertEq(updated.quantity, 5, "quantity updated to 5");
}

async function testUpdateItemToZeroRemovesIt(): Promise<void> {
  console.log("\n  [8] PATCH /api/cart/items/:id with quantity=0 removes item");

  const cartRes = await get("/api/cart", token1);
  const items = (cartRes.json as { data: { items: Array<{ id: string; size: string }> } }).data.items;
  const lItem = items.find((i) => i.size === "L")!;

  const r = await patch(`/api/cart/items/${lItem.id}`, { quantity: 0 }, token1);
  assertEq(r.status, 200, "returns 200");
  const cart = (r.json as { data: { items: Array<{ size: string }> } }).data;
  assert(!cart.items.some((i) => i.size === "L"), "L item removed from cart");
  assertEq(cart.items.length, 1, "only M item remains");
}

async function testRemoveItem(): Promise<void> {
  console.log("\n  [9] DELETE /api/cart/items/:id");

  // Add L back so we can delete it
  await post("/api/cart/items", { productSlug: TEST_PRODUCT_SLUG, size: "L", quantity: 1 }, token1);

  const cartRes = await get("/api/cart", token1);
  const items = (cartRes.json as { data: { items: Array<{ id: string; size: string }> } }).data.items;
  const lItem = items.find((i) => i.size === "L")!;

  const r = await del(`/api/cart/items/${lItem.id}`, token1);
  assertEq(r.status, 200, "returns 200");
  const cart = (r.json as { data: { items: Array<{ size: string }> } }).data;
  assert(!cart.items.some((i) => i.size === "L"), "L item gone");
}

async function testOwnershipEnforcement(): Promise<void> {
  console.log("\n  [10] Ownership enforcement — user2 cannot modify user1's cart items");

  const cartRes = await get("/api/cart", token1);
  const items = (cartRes.json as { data: { items: Array<{ id: string }> } }).data.items;
  const itemId = items[0].id;

  const r1 = await patch(`/api/cart/items/${itemId}`, { quantity: 99 }, token2);
  assertEq(r1.status, 403, "PATCH another user's item → 403");

  const r2 = await del(`/api/cart/items/${itemId}`, token2);
  assertEq(r2.status, 403, "DELETE another user's item → 403");
}

async function testClearCart(): Promise<void> {
  console.log("\n  [11] DELETE /api/cart — clear cart");

  const r = await del("/api/cart", token1);
  assertEq(r.status, 204, "returns 204");

  const cartRes = await get("/api/cart", token1);
  const cart = (cartRes.json as { data: { items: unknown[]; subtotalPaise: number } }).data;
  assertEq(cart.items.length, 0, "cart is empty after clear");
  assertEq(cart.subtotalPaise, 0, "subtotal = 0 after clear");
}

async function testStockCheck(): Promise<void> {
  console.log("\n  [12] Stock check — variant with limited inventory (2 available)");

  // Add 2 (exactly available) → should succeed
  const r1 = await post("/api/cart/items", {
    productSlug: TEST_PRODUCT_SLUG,
    size:        "XXL",
    color:       "Red",
    quantity:    2,
  }, token1);
  assertEq(r1.status, 201, "adding 2 (=available) → 201");

  // Clear and try adding 3 → should fail (only 2 available)
  await del("/api/cart", token1);
  const r2 = await post("/api/cart/items", {
    productSlug: TEST_PRODUCT_SLUG,
    size:        "XXL",
    color:       "Red",
    quantity:    3,
  }, token1);
  assertEq(r2.status, 409, "adding 3 (>available) → 409 insufficient stock");
  await del("/api/cart", token1);
}

async function testMergeCart(): Promise<void> {
  console.log("\n  [13] POST /api/cart/merge — best-effort merge");

  const r = await post("/api/cart/merge", {
    items: [
      { productSlug: TEST_PRODUCT_SLUG, size: "S", quantity: 1 },
      { productSlug: TEST_PRODUCT_SLUG, size: "M", quantity: 2 },
      { productSlug: "nonexistent-slug", size: "M", quantity: 1 }, // should be skipped
    ],
  }, token1);
  assertEq(r.status, 200, "returns 200");

  const body = r.json as { data: {
    cart: { items: Array<{ size: string; quantity: number }> };
    skipped: Array<{ productSlug: string; reason: string }>;
  } };
  const { cart, skipped } = body.data;

  assert(cart.items.some((i) => i.size === "S" && i.quantity === 1), "S item merged");
  assert(cart.items.some((i) => i.size === "M" && i.quantity === 2), "M item merged");
  assertEq(skipped.length, 1, "1 item skipped");
  assertEq(skipped[0].productSlug, "nonexistent-slug", "skipped item is the nonexistent one");
  assert(skipped[0].reason.length > 0, "skipped item has a reason");
}

async function testMergeValidation(): Promise<void> {
  console.log("\n  [14] POST /api/cart/merge — validation");

  const r1 = await post("/api/cart/merge", { items: "not-an-array" }, token1);
  assertEq(r1.status, 400, "non-array items → 400");

  const r2 = await post("/api/cart/merge", { items: [{ size: "M", quantity: 1 }] }, token1);
  assertEq(r2.status, 400, "item without productSlug → 400");
}

async function testPaiseStorageInDB(): Promise<void> {
  console.log("\n  [15] Verify paise stored in DB CartItem.priceAtAdd");

  // Add an item and verify DB row has paise
  await del("/api/cart", token1);
  await post("/api/cart/items", { productSlug: TEST_PRODUCT_SLUG, size: "M", quantity: 1 }, token1);

  const user = await prisma.user.findFirst({ where: { email: `user1${SUFFIX}` }, select: { id: true } });
  const cart = await prisma.cart.findUnique({ where: { userId: user!.id }, select: { id: true } });
  const items = await prisma.cartItem.findMany({ where: { cartId: cart!.id }, select: { priceAtAdd: true } });

  assert(items.length > 0, "cart item exists in DB");
  // basePrice = 28999 rupees → 2899900 paise
  assertEq(items[0].priceAtAdd, Money.toPaise(28999), "priceAtAdd is in paise (2899900)");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Sprint 4.1 — Cart API Tests");
  console.log("=".repeat(60));

  await setupServer();

  try {
    await setup();

    await testAuthEnforcement();
    await testGetCart();
    await testAddItem();
    await testAddItemValidation();
    await testDuplicateItemIncrementsQuantity();
    await testDifferentSizeAddsSeparateItem();
    await testUpdateItemQuantity();
    await testUpdateItemToZeroRemovesIt();
    await testRemoveItem();
    await testOwnershipEnforcement();
    await testClearCart();
    await testStockCheck();
    await testMergeCart();
    await testMergeValidation();
    await testPaiseStorageInDB();
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
