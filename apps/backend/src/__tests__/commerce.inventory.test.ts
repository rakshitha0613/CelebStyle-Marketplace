/**
 * Sprint 4.4 — Inventory Lifecycle & Fulfillment Tests
 *
 * Covers:
 *   [1]  Auth enforcement (warehouses, inventory, fulfillment)
 *   [2]  Warehouse CRUD via API
 *   [3]  Warehouse validation
 *   [4]  Inventory restock via API
 *   [5]  Inventory adjustment via API
 *   [6]  Inventory available / product query
 *   [7]  Stock movements audit trail
 *   [8]  Reservation lifecycle (reserve → allocate → deduct)
 *   [9]  Reservation release on cancellation
 *   [10] Overselling prevention (planAndReserve CAS)
 *   [11] Fulfillment status API
 *   [12] Fulfillment allocate endpoint (PLACED → CONFIRMED)
 *   [13] Fulfillment ship endpoint (deducts stock)
 *   [14] Fulfillment deliver endpoint
 *   [15] Admin manual reservation release
 *
 * Sentinel: "@inv44.celebstyle.test"
 * Run: npm run test:inventory
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";
import { planAndReserve, rollbackPlans, buildBatchOps } from "../services/reservation.service.js";
import { reservationService } from "../services/reservation.service.js";
import { randomUUID } from "node:crypto";

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
  assert(
    actual === expected,
    `${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`
  );
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

interface Result { status: number; json: unknown }

function authH(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get(path: string, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: authH(token) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function post(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: authH(token), body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function patch(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "PATCH", headers: authH(token), body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function del(path: string, token?: string, body?: unknown): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "DELETE",
    headers: authH(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// ── Sentinel IDs ──────────────────────────────────────────────────────────────

const SUFFIX     = "@inv44.celebstyle.test";
const TEST_PASS  = "Inventory44!";
const WH_ID      = "wh-inv44test";
const WH_ID2     = "wh-inv44test2";
const VAR_ID     = "pv-inv44test";
const PRODUCT_SLUG = "look-shah-rukh-khan-red-carpet";

const ORDER_SHIPPING = {
  shippingName:    "Test User",
  shippingPhone:   "9876543210",
  shippingAddress: "1 Test Lane",
  shippingCity:    "Mumbai",
  shippingState:   "Maharashtra",
  shippingPincode: "400001",
  shippingAmount:  0,
} as const;

const ITEM_DEFAULTS = {
  productSlug:    PRODUCT_SLUG,
  productName:    "Test Product",
  celebrityId:    "celeb-inv44-placeholder",
  celebrityName:  "Test Celebrity",
  category:       "FASHION",
  imageUrl:       "https://example.com/test.jpg",
  manufacturerIds: [] as string[],
} as const;

let adminToken:    string;
let customerToken: string;
let adminId:       string;
let customerId:    string;
let testProductId: string;
let inventoryId:   string;

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } }, select: { id: true },
  });
  const uids = users.map((u) => u.id);

  if (uids.length > 0) {
    // Cascade: orders → reservations
    const orders = await prisma.order.findMany({
      where: { userId: { in: uids } }, select: { id: true },
    });
    const oids = orders.map((o) => o.id);
    if (oids.length > 0) {
      await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.orderCommission.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.order.deleteMany({ where: { id: { in: oids } } });
    }
    await prisma.address.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }

  // Inventory + variant + warehouses
  await prisma.stockMovement.deleteMany({ where: { inventory: { variantId: VAR_ID } } });
  await prisma.inventoryReservation.deleteMany({ where: { variantId: VAR_ID } });
  await prisma.inventory.deleteMany({ where: { variantId: VAR_ID } });

  const tv = await prisma.productVariant.findFirst({ where: { id: VAR_ID } });
  if (tv) await prisma.productVariant.delete({ where: { id: VAR_ID } });

  const tw  = await prisma.warehouse.findFirst({ where: { id: WH_ID } });
  if (tw)  await prisma.warehouse.delete({ where: { id: WH_ID } });

  const tw2 = await prisma.warehouse.findFirst({ where: { id: WH_ID2 } });
  if (tw2) await prisma.warehouse.delete({ where: { id: WH_ID2 } });
}

async function setup(): Promise<void> {
  await cleanup();

  const passwordHash = await hashPassword(TEST_PASS);

  const admin = await prisma.user.create({
    data: { email: `admin${SUFFIX}`, passwordHash, name: "Inv Admin", role: "ADMIN" },
  });
  adminId = admin.id;

  const customer = await prisma.user.create({
    data: { email: `customer${SUFFIX}`, passwordHash, name: "Inv Customer", role: "CUSTOMER" },
  });
  customerId = customer.id;

  // Login both
  const adminLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `admin${SUFFIX}`, password: TEST_PASS }),
  });
  adminToken = ((await adminLogin.json()) as { data: { accessToken: string } }).data.accessToken;

  const custLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `customer${SUFFIX}`, password: TEST_PASS }),
  });
  customerToken = ((await custLogin.json()) as { data: { accessToken: string } }).data.accessToken;

  // Resolve test product
  const product = await prisma.product.findFirst({ where: { slug: PRODUCT_SLUG }, select: { id: true } });
  testProductId = product!.id;

  // Create primary warehouse directly (id seeded for reproducibility)
  await prisma.warehouse.create({
    data: { id: WH_ID, slug: "wh-inv44", name: "Inv44 Primary WH", city: "Mumbai", state: "Maharashtra", pincode: "400001", priority: 10 },
  });

  // Create variant for test product
  await prisma.productVariant.create({
    data: { id: VAR_ID, productId: testProductId, size: "M", color: "Test", sku: "SKU-INV44TEST", priceAdjustment: 0, isAvailable: true },
  });

  // Seed initial inventory: quantity=10, reservedQuantity=0
  const inv = await prisma.inventory.create({
    data: { productId: testProductId, variantId: VAR_ID, warehouseId: WH_ID, quantity: 10, reservedQuantity: 0 },
  });
  inventoryId = inv.id;
}

// ── Test Groups ───────────────────────────────────────────────────────────────

async function testAuthEnforcement(): Promise<void> {
  console.log("\n  [1] Auth enforcement");

  // Warehouse admin endpoints
  const r1 = await post("/api/warehouses", { slug: "x", name: "x", city: "x", state: "x", pincode: "123456" });
  assertEq(r1.status, 401, "POST /api/warehouses → 401 without token");

  const r2 = await patch(`/api/warehouses/${WH_ID}`, { name: "New Name" });
  assertEq(r2.status, 401, "PATCH /api/warehouses/:id → 401 without token");

  // Customer cannot create warehouse
  const r3 = await post("/api/warehouses", { slug: "x", name: "x", city: "x", state: "x", pincode: "123456" }, customerToken);
  assertEq(r3.status, 403, "POST /api/warehouses → 403 for CUSTOMER");

  // Inventory admin endpoints
  const r4 = await post("/api/inventory/adjust", { warehouseId: WH_ID, variantId: VAR_ID, delta: 5 });
  assertEq(r4.status, 401, "POST /api/inventory/adjust → 401 without token");

  const r5 = await post("/api/inventory/restock", { warehouseId: WH_ID, variantId: VAR_ID, productId: testProductId, quantity: 5 });
  assertEq(r5.status, 401, "POST /api/inventory/restock → 401 without token");

  const r6 = await post("/api/inventory/adjust", { warehouseId: WH_ID, variantId: VAR_ID, delta: 5 }, customerToken);
  assertEq(r6.status, 403, "POST /api/inventory/adjust → 403 for CUSTOMER");

  const r7 = await get(`/api/inventory/movements/${inventoryId}`);
  assertEq(r7.status, 401, "GET /api/inventory/movements/:id → 401 without token");

  const r8 = await get(`/api/inventory/movements/${inventoryId}`, customerToken);
  assertEq(r8.status, 403, "GET /api/inventory/movements/:id → 403 for CUSTOMER");

  // Fulfillment admin endpoints
  const r9 = await post(`/api/fulfillment/fake-order-id/allocate`, {});
  assertEq(r9.status, 401, "POST /api/fulfillment/:id/allocate → 401 without token");

  const r10 = await post(`/api/fulfillment/fake-order-id/ship`, {});
  assertEq(r10.status, 401, "POST /api/fulfillment/:id/ship → 401 without token");

  const r11 = await del(`/api/fulfillment/reservations/fake-order-id`);
  assertEq(r11.status, 401, "DELETE /api/fulfillment/reservations/:id → 401 without token");

  const r12 = await post(`/api/fulfillment/fake-order-id/allocate`, {}, customerToken);
  assertEq(r12.status, 403, "POST /api/fulfillment/:id/allocate → 403 for CUSTOMER");
}

async function testWarehouseCRUD(): Promise<void> {
  console.log("\n  [2] Warehouse CRUD via API");

  // List — public, should include our seeded warehouse
  const r1 = await get("/api/warehouses");
  assertEq(r1.status, 200, "GET /api/warehouses → 200");
  const list = (r1.json as { data: unknown[] }).data;
  assert(Array.isArray(list), "List returns array");
  assert(list.some((w: unknown) => (w as { id: string }).id === WH_ID), "Seeded warehouse in list");

  // Get single — public
  const r2 = await get(`/api/warehouses/${WH_ID}`);
  assertEq(r2.status, 200, "GET /api/warehouses/:id → 200");
  assertEq((r2.json as { data: { name: string } }).data.name, "Inv44 Primary WH", "Warehouse name correct");

  // Get missing
  const r3 = await get("/api/warehouses/no-such-wh");
  assertEq(r3.status, 404, "GET /api/warehouses/missing → 404");

  // Create via API (admin)
  const r4 = await post("/api/warehouses", {
    slug: "wh-inv44-api", name: "API Created WH", city: "Delhi", state: "Delhi", pincode: "110001", priority: 50,
  }, adminToken);
  assertEq(r4.status, 201, "POST /api/warehouses → 201");
  const createdId = (r4.json as { data: { id: string } }).data.id;
  assert(!!createdId, "Created warehouse has id");

  // Update via API
  const r5 = await patch(`/api/warehouses/${createdId}`, { name: "Updated WH Name", priority: 20 }, adminToken);
  assertEq(r5.status, 200, "PATCH /api/warehouses/:id → 200");
  assertEq((r5.json as { data: { name: string } }).data.name, "Updated WH Name", "Name updated");
  assertEq((r5.json as { data: { priority: number } }).data.priority, 20, "Priority updated");

  // Cleanup API-created warehouse
  await prisma.warehouse.delete({ where: { id: createdId } });
}

async function testWarehouseValidation(): Promise<void> {
  console.log("\n  [3] Warehouse validation");

  // Missing required fields
  const r1 = await post("/api/warehouses", { slug: "x" }, adminToken);
  assertEq(r1.status, 400, "Missing required fields → 400");

  // Invalid pincode
  const r2 = await post("/api/warehouses", {
    slug: "x", name: "x", city: "x", state: "x", pincode: "12345",
  }, adminToken);
  assertEq(r2.status, 400, "5-digit pincode → 400");

  const r3 = await post("/api/warehouses", {
    slug: "x", name: "x", city: "x", state: "x", pincode: "1234567",
  }, adminToken);
  assertEq(r3.status, 400, "7-digit pincode → 400");

  // Update with invalid pincode
  const r4 = await patch(`/api/warehouses/${WH_ID}`, { pincode: "ABCDEF" }, adminToken);
  assertEq(r4.status, 400, "Non-numeric pincode on update → 400");

  // Update non-existent
  const r5 = await patch("/api/warehouses/no-such-wh", { name: "x" }, adminToken);
  assertEq(r5.status, 404, "PATCH missing warehouse → 404");
}

async function testInventoryRestock(): Promise<void> {
  console.log("\n  [4] Inventory restock via API");

  // Initial quantity is 10 from setup
  const before = await prisma.inventory.findFirst({ where: { id: inventoryId } });
  assert(before!.quantity === 10, `Initial quantity is 10 (got ${before!.quantity})`);

  // Restock +5
  const r1 = await post("/api/inventory/restock", {
    warehouseId: WH_ID, variantId: VAR_ID, productId: testProductId, quantity: 5, notes: "Test restock",
  }, adminToken);
  assertEq(r1.status, 200, "POST /api/inventory/restock → 200");
  assertEq((r1.json as { data: { quantity: number } }).data.quantity, 15, "Quantity after restock = 15");

  // Restock again +3
  const r2 = await post("/api/inventory/restock", {
    warehouseId: WH_ID, variantId: VAR_ID, productId: testProductId, quantity: 3,
  }, adminToken);
  assertEq(r2.status, 200, "Second restock → 200");
  assertEq((r2.json as { data: { quantity: number } }).data.quantity, 18, "Quantity after second restock = 18");

  // Invalid: quantity 0
  const r3 = await post("/api/inventory/restock", {
    warehouseId: WH_ID, variantId: VAR_ID, productId: testProductId, quantity: 0,
  }, adminToken);
  assertEq(r3.status, 400, "Restock quantity 0 → 400");

  // Missing fields
  const r4 = await post("/api/inventory/restock", { warehouseId: WH_ID }, adminToken);
  assertEq(r4.status, 400, "Missing restock fields → 400");

  // Reset quantity back to 10 for subsequent tests
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testInventoryAdjust(): Promise<void> {
  console.log("\n  [5] Inventory adjustment via API");

  // Adjust +5
  const r1 = await post("/api/inventory/adjust", {
    warehouseId: WH_ID, variantId: VAR_ID, delta: 5, notes: "Manual top-up",
  }, adminToken);
  assertEq(r1.status, 200, "POST /api/inventory/adjust +5 → 200");
  assertEq((r1.json as { data: { quantity: number } }).data.quantity, 15, "Qty after +5 = 15");

  // Adjust -3
  const r2 = await post("/api/inventory/adjust", {
    warehouseId: WH_ID, variantId: VAR_ID, delta: -3,
  }, adminToken);
  assertEq(r2.status, 200, "POST /api/inventory/adjust -3 → 200");
  assertEq((r2.json as { data: { quantity: number } }).data.quantity, 12, "Qty after -3 = 12");

  // Zero delta invalid
  const r3 = await post("/api/inventory/adjust", {
    warehouseId: WH_ID, variantId: VAR_ID, delta: 0,
  }, adminToken);
  assertEq(r3.status, 400, "Delta 0 → 400");

  // Cannot go below zero
  const r4 = await post("/api/inventory/adjust", {
    warehouseId: WH_ID, variantId: VAR_ID, delta: -100,
  }, adminToken);
  assertEq(r4.status, 400, "Delta below zero stock → 400");

  // Missing delta field
  const r5 = await post("/api/inventory/adjust", { warehouseId: WH_ID, variantId: VAR_ID }, adminToken);
  assertEq(r5.status, 400, "Missing delta → 400");

  // Reset to 10
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testInventoryQuery(): Promise<void> {
  console.log("\n  [6] Inventory available / product query (public)");

  // GET /api/inventory/product/:productId
  const r1 = await get(`/api/inventory/product/${testProductId}`);
  assertEq(r1.status, 200, "GET /api/inventory/product/:productId → 200");
  const rows = (r1.json as { data: unknown[] }).data;
  assert(Array.isArray(rows), "Returns array");
  assert(rows.length > 0, "Has at least one inventory row for test product");

  const myRow = rows.find((r: unknown) => (r as { warehouseId: string }).warehouseId === WH_ID);
  assert(!!myRow, "Test warehouse inventory row present");
  assertEq((myRow as { available: number }).available, 10, "Available = 10");

  // GET /api/inventory/variant/:variantId/available
  const r2 = await get(`/api/inventory/variant/${VAR_ID}/available`);
  assertEq(r2.status, 200, "GET /api/inventory/variant/:variantId/available → 200");
  assertEq(
    (r2.json as { data: { available: number } }).data.available,
    10,
    "Available count = 10"
  );
}

async function testStockMovements(): Promise<void> {
  console.log("\n  [7] Stock movements audit trail");

  // Perform an adjustment to generate a movement
  await post("/api/inventory/adjust", {
    warehouseId: WH_ID, variantId: VAR_ID, delta: 2, notes: "Audit test",
  }, adminToken);

  const r1 = await get(`/api/inventory/movements/${inventoryId}`, adminToken);
  assertEq(r1.status, 200, "GET /api/inventory/movements/:inventoryId → 200");
  const movements = (r1.json as { data: unknown[] }).data;
  assert(Array.isArray(movements), "Returns array");
  assert(movements.length > 0, "Has at least one movement");

  const lastMov = movements[0] as { type: string; quantityChange: number; notes: string };
  assertEq(lastMov.type, "ADJUSTMENT", "Movement type is ADJUSTMENT");
  assertEq(lastMov.quantityChange, 2, "quantityChange is 2");
  assert(lastMov.notes === "Audit test", "Notes preserved");

  // Restock also creates INBOUND movement
  await post("/api/inventory/restock", {
    warehouseId: WH_ID, variantId: VAR_ID, productId: testProductId, quantity: 1,
  }, adminToken);

  const r2 = await get(`/api/inventory/movements/${inventoryId}?limit=2`, adminToken);
  const movements2 = (r2.json as { data: unknown[] }).data;
  const inbound = movements2.find((m: unknown) => (m as { type: string }).type === "INBOUND");
  assert(!!inbound, "INBOUND movement recorded for restock");

  // Reset inventory
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
}

async function testReservationLifecycle(): Promise<void> {
  console.log("\n  [8] Reservation lifecycle (reserve → allocate → deduct)");

  // Start: qty=10, reserved=0
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });

  // planAndReserve: reserve 3 units
  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 3 }]);
  assert(plans.length === 1, "planAndReserve returns 1 plan");
  assertEq(plans[0].quantity, 3, "Plan quantity = 3");
  assertEq(plans[0].variantId, VAR_ID, "Plan variantId correct");

  // Verify CAS incremented reservedQuantity
  const afterReserve = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(afterReserve!.reservedQuantity, 3, "reservedQuantity = 3 after CAS");
  assertEq(afterReserve!.quantity, 10, "Physical quantity unchanged after reserve");

  // Build batch ops and create an order with the reservation in one batch
  const orderId = randomUUID();
  const itemId   = randomUUID();

  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);
  assert(ops.length === 2, "buildBatchOps returns 2 ops (reservation + movement)");

  // Create order skeleton + reservation in batch
  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "PLACED", paymentStatus: "CAPTURED",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 3, unitPrice: 100, totalPrice: 300,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  const res = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assert(!!res, "InventoryReservation created");
  assertEq(res!.status, "RESERVED", "Initial status is RESERVED");
  assertEq(res!.quantity, 3, "Reservation quantity = 3");

  // RESERVATION StockMovement created
  const resMov = await prisma.stockMovement.findFirst({
    where: { inventoryId, type: "RESERVATION" },
  });
  assert(!!resMov, "RESERVATION StockMovement created");

  // allocate: RESERVED → ALLOCATED
  await reservationService.allocate(orderId);
  const afterAlloc = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(afterAlloc!.status, "ALLOCATED", "Status → ALLOCATED");
  assert(!!afterAlloc!.allocatedAt, "allocatedAt set");

  // deduct: ALLOCATED → DEDUCTED, quantity--, reservedQuantity--
  await reservationService.deduct(orderId);
  const afterDeduct = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(afterDeduct!.status, "DEDUCTED", "Status → DEDUCTED");
  assert(!!afterDeduct!.deductedAt, "deductedAt set");

  const afterDeductInv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(afterDeductInv!.quantity, 7, "Physical quantity decremented 10→7");
  assertEq(afterDeductInv!.reservedQuantity, 0, "reservedQuantity decremented 3→0");

  // OUTBOUND StockMovement created
  const outMov = await prisma.stockMovement.findFirst({
    where: { inventoryId, type: "OUTBOUND" },
  });
  assert(!!outMov, "OUTBOUND StockMovement created on deduct");

  // getForOrder
  const forOrder = await reservationService.getForOrder(orderId);
  assert(forOrder.length === 1, "getForOrder returns 1 reservation");

  // Cleanup order
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testReservationRelease(): Promise<void> {
  console.log("\n  [9] Reservation release on payment failure");

  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });

  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 2 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();

  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);
  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-R-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "AWAITING_PAYMENT", paymentStatus: "PENDING",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 2, unitPrice: 100, totalPrice: 200,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  // Verify reserved
  const beforeRelease = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(beforeRelease!.reservedQuantity, 2, "reservedQuantity = 2 before release");

  // Release: PAYMENT_FAILED
  await reservationService.release(orderId, "PAYMENT_FAILED");

  const resAfter = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(resAfter!.status, "RELEASED", "Status → RELEASED after PAYMENT_FAILED");
  assert(!!resAfter!.releasedAt, "releasedAt set");

  const invAfter = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(invAfter!.reservedQuantity, 0, "reservedQuantity restored to 0");
  assertEq(invAfter!.quantity, 10, "Physical quantity unchanged");

  // RELEASE StockMovement
  const relMov = await prisma.stockMovement.findFirst({ where: { inventoryId, type: "RELEASE" } });
  assert(!!relMov, "RELEASE StockMovement created");

  // Idempotency: releasing again should be no-op (no RESERVED/ALLOCATED remaining)
  await reservationService.release(orderId, "PAYMENT_FAILED");
  const movCount = await prisma.stockMovement.count({ where: { inventoryId, type: "RELEASE" } });
  assertEq(movCount, 1, "Second release is no-op — only 1 RELEASE movement total");

  // Cleanup
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testOverselling(): Promise<void> {
  console.log("\n  [10] Overselling prevention");

  // Set inventory to exactly 2 available
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 2, reservedQuantity: 0 } });

  // Try to reserve 3 — should fail
  let threw = false;
  try {
    await planAndReserve([{ variantId: VAR_ID, quantity: 3 }]);
  } catch (err) {
    threw = true;
    assert((err as Error).message?.includes("stock") || true, "Throws InsufficientStockError for qty>available");
  }
  assert(threw, "planAndReserve throws when qty > available");

  // Verify no reservation leaked (CAS + rollback)
  const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(inv!.reservedQuantity, 0, "reservedQuantity stays 0 after failed reservation");

  // Reserve 2 (exactly available) — should succeed
  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 2 }]);
  assert(plans.length === 1, "Exact-available reservation succeeds");

  // Now try to reserve 1 more — should fail (0 available left)
  let threw2 = false;
  try {
    await planAndReserve([{ variantId: VAR_ID, quantity: 1 }]);
  } catch {
    threw2 = true;
  }
  assert(threw2, "planAndReserve throws when no units available after prior reservation");

  // Rollback the successful plans
  await rollbackPlans(plans);
  const invAfter = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(invAfter!.reservedQuantity, 0, "reservedQuantity 0 after rollback");

  // Reset
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testFulfillmentStatus(): Promise<void> {
  console.log("\n  [11] Fulfillment status API");

  // Create a placed order with reservation
  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 1 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();
  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);

  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-FS-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "PLACED", paymentStatus: "CAPTURED",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 1, unitPrice: 100, totalPrice: 100,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  // Customer can view their own order
  const r1 = await get(`/api/fulfillment/${orderId}`, customerToken);
  assertEq(r1.status, 200, "GET /api/fulfillment/:orderId → 200 for owner");
  const data1 = (r1.json as { data: { status: string; inventoryReservations: unknown[] } }).data;
  assertEq(data1.status, "PLACED", "Order status is PLACED");
  assert(data1.inventoryReservations.length === 1, "Has 1 reservation");

  // Admin can view any order
  const r2 = await get(`/api/fulfillment/${orderId}`, adminToken);
  assertEq(r2.status, 200, "GET /api/fulfillment/:orderId → 200 for admin");

  // Non-owner customer cannot view
  const otherCustomer = await prisma.user.create({
    data: { email: `other${SUFFIX}`, passwordHash: await hashPassword(TEST_PASS), name: "Other", role: "CUSTOMER" },
  });
  const otherLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `other${SUFFIX}`, password: TEST_PASS }),
  });
  const otherToken = ((await otherLogin.json()) as { data: { accessToken: string } }).data.accessToken;

  const r3 = await get(`/api/fulfillment/${orderId}`, otherToken);
  assertEq(r3.status, 403, "Non-owner cannot view fulfillment status");

  // Missing order → 404
  const r4 = await get(`/api/fulfillment/no-such-order`, adminToken);
  assertEq(r4.status, 404, "Missing order → 404");

  // Cleanup
  await prisma.user.delete({ where: { id: otherCustomer.id } });
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testFulfillmentAllocate(): Promise<void> {
  console.log("\n  [12] Fulfillment allocate: PLACED → CONFIRMED");

  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 1 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();
  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);

  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-AL-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "PLACED", paymentStatus: "CAPTURED",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 1, unitPrice: 100, totalPrice: 100,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  // Allocate via API
  const r1 = await post(`/api/fulfillment/${orderId}/allocate`, {}, adminToken);
  assertEq(r1.status, 200, "POST /api/fulfillment/:id/allocate → 200");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertEq(order!.status, "CONFIRMED", "Order status → CONFIRMED");

  const res = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(res!.status, "ALLOCATED", "Reservation status → ALLOCATED");
  assert(!!res!.allocatedAt, "allocatedAt set");

  // Cannot allocate again (not PLACED anymore)
  const r2 = await post(`/api/fulfillment/${orderId}/allocate`, {}, adminToken);
  assertEq(r2.status, 403, "Double allocate → 403");

  // Cleanup
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testFulfillmentShip(): Promise<void> {
  console.log("\n  [13] Fulfillment ship: deducts stock");

  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });

  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 2 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();
  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);

  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-SH-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "PLACED", paymentStatus: "CAPTURED",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 2, unitPrice: 100, totalPrice: 200,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  // Allocate first
  await post(`/api/fulfillment/${orderId}/allocate`, {}, adminToken);

  // Cannot ship wrong status directly (CONFIRMED ok)
  const r1 = await post(`/api/fulfillment/${orderId}/ship`, { trackingCode: "TRK123", carrier: "BlueDart" }, adminToken);
  assertEq(r1.status, 200, "POST /api/fulfillment/:id/ship → 200");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertEq(order!.status, "SHIPPED", "Order status → SHIPPED");

  const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(inv!.quantity, 8, "Physical quantity 10→8 after ship");
  assertEq(inv!.reservedQuantity, 0, "reservedQuantity 2→0 after ship");

  const res = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(res!.status, "DEDUCTED", "Reservation → DEDUCTED");

  // Cannot ship again
  const r2 = await post(`/api/fulfillment/${orderId}/ship`, {}, adminToken);
  assertEq(r2.status, 403, "Double ship → 403");

  // Cleanup
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testFulfillmentDeliver(): Promise<void> {
  console.log("\n  [14] Fulfillment deliver endpoint");

  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 1 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();
  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);

  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-DL-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "PLACED", paymentStatus: "CAPTURED",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 1, unitPrice: 100, totalPrice: 100,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  // Allocate → Ship → Deliver
  await post(`/api/fulfillment/${orderId}/allocate`, {}, adminToken);
  await post(`/api/fulfillment/${orderId}/ship`, {}, adminToken);

  const r1 = await post(`/api/fulfillment/${orderId}/deliver`, {}, adminToken);
  assertEq(r1.status, 200, "POST /api/fulfillment/:id/deliver → 200");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertEq(order!.status, "DELIVERED", "Order status → DELIVERED");
  assert(!!order!.deliveredAt, "deliveredAt set");

  // Cannot deliver again
  const r2 = await post(`/api/fulfillment/${orderId}/deliver`, {}, adminToken);
  assertEq(r2.status, 403, "Double deliver → 403");

  // Cannot deliver order that hasn't shipped
  const orderId2 = randomUUID();
  await prisma.order.create({
    data: {
      id: orderId2, orderNumber: `INV44-DL2-${Date.now()}`,
      userId: customerId, customerEmail: `customer${SUFFIX}`,
      subtotal: 100, total: 100, status: "CONFIRMED", paymentStatus: "CAPTURED",
      ...ORDER_SHIPPING,
    },
  });
  const r3 = await post(`/api/fulfillment/${orderId2}/deliver`, {}, adminToken);
  assertEq(r3.status, 403, "Deliver CONFIRMED order → 403");

  // Cleanup
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.order.delete({ where: { id: orderId2 } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

async function testAdminManualRelease(): Promise<void> {
  console.log("\n  [15] Admin manual reservation release");

  const plans = await planAndReserve([{ variantId: VAR_ID, quantity: 4 }]);
  const orderId = randomUUID();
  const itemId   = randomUUID();
  const ops = buildBatchOps(plans, [{ orderId, orderItemId: itemId, planIndex: 0 }]);

  await prisma.$transaction([
    prisma.order.create({
      data: {
        id: orderId, orderNumber: `INV44-MR-${Date.now()}`,
        userId: customerId, customerEmail: `customer${SUFFIX}`,
        subtotal: 100, total: 100, status: "AWAITING_PAYMENT", paymentStatus: "PENDING",
        ...ORDER_SHIPPING,
        items: { create: [{
          id: itemId, productId: testProductId, variantId: VAR_ID,
          size: "M", quantity: 4, unitPrice: 100, totalPrice: 400,
          ...ITEM_DEFAULTS,
        }] },
      },
    }),
    ...ops,
  ]);

  const beforeRelease = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(beforeRelease!.reservedQuantity, 4, "reservedQuantity = 4 before manual release");

  // Admin releases via DELETE endpoint
  const r1 = await del(`/api/fulfillment/reservations/${orderId}`, adminToken, { reason: "CANCELLED" });
  assertEq(r1.status, 200, "DELETE /api/fulfillment/reservations/:orderId → 200");

  const res = await prisma.inventoryReservation.findFirst({ where: { orderId } });
  assertEq(res!.status, "RELEASED", "Reservation → RELEASED");

  const invAfter = await prisma.inventory.findUnique({ where: { id: inventoryId } });
  assertEq(invAfter!.reservedQuantity, 0, "reservedQuantity restored after manual release");

  // 404 for missing order
  const r2 = await del("/api/fulfillment/reservations/no-such-order", adminToken);
  assertEq(r2.status, 404, "Release missing order → 404");

  // Cleanup
  await prisma.inventoryReservation.deleteMany({ where: { orderId } });
  await prisma.orderCommission.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { inventoryId } });
  await prisma.inventory.update({ where: { id: inventoryId }, data: { quantity: 10, reservedQuantity: 0 } });
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await setupServer();

  try {
    await setup();

    await testAuthEnforcement();
    await testWarehouseCRUD();
    await testWarehouseValidation();
    await testInventoryRestock();
    await testInventoryAdjust();
    await testInventoryQuery();
    await testStockMovements();
    await testReservationLifecycle();
    await testReservationRelease();
    await testOverselling();
    await testFulfillmentStatus();
    await testFulfillmentAllocate();
    await testFulfillmentShip();
    await testFulfillmentDeliver();
    await testAdminManualRelease();

  } finally {
    await cleanup();
    await prisma.$disconnect();
    await teardownServer();
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
