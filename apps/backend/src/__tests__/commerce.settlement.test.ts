/**
 * Sprint 4.5 — Settlement, Commission & Invoice Tests
 *
 * Covers:
 *   [1]  Auth enforcement — settlements & invoices
 *   [2]  Settlement calculate — amounts and TDS
 *   [3]  Settlement create for delivered order
 *   [4]  Settlement duplicate prevention
 *   [5]  Settlement mark paid (COMPLETED)
 *   [6]  Settlement status update — OrderCommission.settledAt updated
 *   [7]  Settlement list with status filter
 *   [8]  Settlement report aggregate
 *   [9]  Settlement: non-DELIVERED order rejected
 *   [10] Commission report aggregate totals
 *   [11] Commission list (paginated)
 *   [12] Invoice: auto-generate on first GET
 *   [13] Invoice: idempotent (second GET returns same number)
 *   [14] Invoice: admin explicit generate
 *   [15] Invoice: orderSnapshot and customerSnapshot present
 *   [16] Invoice: forbidden for other customer
 *   [17] Commission settled filter
 *
 * Sentinel: "@set45.celebstyle.test"
 * Run: npm run test:settlement
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";

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

// ── Server ─────────────────────────────────────────────────────────────────────

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

// ── HTTP helpers ───────────────────────────────────────────────────────────────

interface Result { status: number; json: Record<string, unknown> }

function authH(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get(path: string, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: authH(token) });
  return { status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}

async function post(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: authH(token), body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}

async function patch(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "PATCH", headers: authH(token), body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) as Record<string, unknown> };
}

// ── Sentinel IDs ──────────────────────────────────────────────────────────────

const SUFFIX    = "@set45.celebstyle.test";
const TEST_PASS = "Settlement45!";

const PRODUCT_SLUG = "look-shah-rukh-khan-red-carpet";

const ORDER_BASE = {
  shippingName:    "Test Settler",
  shippingPhone:   "9876543210",
  shippingAddress: "99 Settlement Road",
  shippingCity:    "Delhi",
  shippingState:   "Delhi",
  shippingPincode: "110001",
  shippingAmount:  0,
  subtotal:        100000,
  discountAmount:  0,
  taxAmount:       18000,
  total:           118000,
  status:          "DELIVERED" as const,
  paymentStatus:   "CAPTURED" as const,
};

let adminToken:    string;
let customerToken: string;
let customer2Token: string;
let adminId:       string;
let customerId:    string;
let customer2Id:   string;
let testProductId: string;

let mainOrderId:  string;
let dupeOrderId:  string;
let placedOrderId: string;

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } }, select: { id: true },
  });
  const uids = users.map((u) => u.id);

  if (uids.length > 0) {
    const orders = await prisma.order.findMany({
      where: { userId: { in: uids } }, select: { id: true },
    });
    const oids = orders.map((o) => o.id);
    if (oids.length > 0) {
      await prisma.refund.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.return.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.invoice.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.settlement.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.orderCommission.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
      await prisma.order.deleteMany({ where: { id: { in: oids } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }
}

async function createDeliveredOrder(userId: string, customerEmail: string, tag: string) {
  const product = await prisma.product.findFirst({ where: { slug: PRODUCT_SLUG }, select: { id: true } });
  if (!product) throw new Error("Seed product not found");

  const order = await prisma.order.create({
    data: {
      ...ORDER_BASE,
      orderNumber:   `SET45-ORD-${tag}-${Date.now()}`,
      userId,
      customerEmail,
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId:         order.id,
      productId:       product.id,
      productSlug:     PRODUCT_SLUG,
      productName:     "Settlement Test Item",
      celebrityId:     "celeb-set45-placeholder",
      celebrityName:   "Test Celebrity",
      category:        "FASHION",
      size:            "L",
      imageUrl:        "https://example.com/set45.jpg",
      unitPrice:       50000,
      quantity:        2,
      totalPrice:      100000,
      manufacturerIds: [],
    },
  });

  await prisma.orderCommission.create({
    data: {
      orderId:             order.id,
      platformFee:         10000,
      celebrityCommission: 5000,
      manufacturerShare:   85000,
      platformFeePercent:  10,
      celebrityPercent:    5,
      manufacturerPercent: 85,
    },
  });

  await prisma.payment.create({
    data: {
      orderId:           order.id,
      provider:          "SIMULATED",
      method:            "UPI",
      amount:            118000,
      status:            "CAPTURED",
      providerPaymentId: `sim_pay_set45_${tag}_${Date.now()}`,
    },
  });

  return order.id;
}

async function setup(): Promise<void> {
  await cleanup();

  const passwordHash = await hashPassword(TEST_PASS);

  const admin = await prisma.user.create({
    data: { email: `admin${SUFFIX}`, passwordHash, name: "Settlement Admin", role: "ADMIN" },
  });
  adminId = admin.id;

  const customer = await prisma.user.create({
    data: { email: `customer${SUFFIX}`, passwordHash, name: "Settlement Customer", role: "CUSTOMER" },
  });
  customerId = customer.id;

  const customer2 = await prisma.user.create({
    data: { email: `customer2${SUFFIX}`, passwordHash, name: "Other Customer", role: "CUSTOMER" },
  });
  customer2Id = customer2.id;

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

  const c2Login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `customer2${SUFFIX}`, password: TEST_PASS }),
  });
  customer2Token = ((await c2Login.json()) as { data: { accessToken: string } }).data.accessToken;

  const product = await prisma.product.findFirst({ where: { slug: PRODUCT_SLUG }, select: { id: true } });
  testProductId = product!.id;

  mainOrderId   = await createDeliveredOrder(customerId, `customer${SUFFIX}`, "main");
  dupeOrderId   = await createDeliveredOrder(customerId, `customer${SUFFIX}`, "dupe");

  // PLACED order for negative test
  placedOrderId = await prisma.order.create({
    data: {
      ...ORDER_BASE,
      orderNumber:   `SET45-PLACED-${Date.now()}`,
      userId:        customerId,
      customerEmail: `customer${SUFFIX}`,
      status:        "PLACED",
      paymentStatus: "PENDING",
    },
  }).then((o) => o.id);
  await prisma.orderItem.create({
    data: {
      orderId: placedOrderId, productId: testProductId, productSlug: PRODUCT_SLUG,
      productName: "Placed Item", celebrityId: "c1", celebrityName: "C",
      category: "FASHION", size: "M", imageUrl: "https://x.com/x.jpg",
      unitPrice: 100000, quantity: 1, totalPrice: 100000, manufacturerIds: [],
    },
  });
  await prisma.orderCommission.create({
    data: {
      orderId: placedOrderId, platformFee: 10000, celebrityCommission: 5000,
      manufacturerShare: 85000, platformFeePercent: 10, celebrityPercent: 5, manufacturerPercent: 85,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testAuthEnforcement() {
  console.log("\n[1] Auth enforcement — settlements & invoices");

  let r = await get("/api/settlements", customerToken);
  assertEq(r.status, 403, "GET /api/settlements customer → 403");

  r = await post("/api/settlements", {}, customerToken);
  assertEq(r.status, 403, "POST /api/settlements customer → 403");

  r = await get("/api/settlements/report", customerToken);
  assertEq(r.status, 403, "GET /api/settlements/report customer → 403");

  r = await get("/api/commissions/report", customerToken);
  assertEq(r.status, 403, "GET /api/commissions/report customer → 403");

  r = await get("/api/commissions", customerToken);
  assertEq(r.status, 403, "GET /api/commissions customer → 403");

  r = await get(`/api/invoices/order/${mainOrderId}`, undefined);
  assertEq(r.status, 401, "GET /api/invoices/order/:id unauthenticated → 401");
}

async function testSettlementCalculate() {
  console.log("\n[2] Settlement calculate — amounts and TDS");

  const { settlementService } = await import("../services/settlement.service.js");
  const calc = await settlementService.calculate(mainOrderId);

  // subtotal = 100000, no refunds
  // platformFee = 10000, celebrity = 5000, mfg = 85000
  // TDS = 5% of 5000 = 250
  assertEq(calc.platformFee,         10000, "platformFee = 10000");
  assertEq(calc.celebrityCommission,  5000, "celebrityCommission = 5000");
  assertEq(calc.manufacturerShare,   85000, "manufacturerShare = 85000");
  assertEq(calc.taxDeducted,           250, "TDS = 5% of celebrity commission = 250");
  assertEq(calc.netCelebrityAmount,   4750, "netCelebrityAmount = 5000 - 250 = 4750");
  assertEq(calc.netManufacturerAmount, 85000, "netManufacturerAmount = 85000");
  assertEq(calc.totalRefunded,           0, "totalRefunded = 0");
  assertEq(calc.netSubtotal,        100000, "netSubtotal = 100000");
}

let settlementId: string;

async function testSettlementCreate() {
  console.log("\n[3] Settlement create for delivered order");

  const r = await post("/api/settlements", { orderId: mainOrderId, notes: "Sprint 4.5 test" }, adminToken);
  assertEq(r.status, 201, "POST /api/settlements → 201");

  const s = (r.json as { data?: { id: string; status: string; platformFee: number; taxDeducted: number } }).data;
  assert(s?.status === "PENDING", "Status = PENDING");
  assertEq(s?.platformFee,   10000, "platformFee = 10000");
  assertEq(s?.taxDeducted,     250, "taxDeducted = 250");
  settlementId = s!.id;
}

async function testSettlementDuplicate() {
  console.log("\n[4] Settlement duplicate prevention");

  // Create settlement for dupeOrderId first
  const first = await post("/api/settlements", { orderId: dupeOrderId }, adminToken);
  assertEq(first.status, 201, "First settlement created");

  // Try again
  const second = await post("/api/settlements", { orderId: dupeOrderId }, adminToken);
  assertEq(second.status, 400, "Duplicate settlement → 400");
}

async function testSettlementMarkPaid() {
  console.log("\n[5] Settlement mark paid");

  const r = await patch(`/api/settlements/${settlementId}/pay`, {}, adminToken);
  assertEq(r.status, 200, "PATCH /pay → 200");
  assertEq((r.json as { data?: { status: string } }).data?.status, "COMPLETED", "Status → COMPLETED");
}

async function testOrderCommissionSettledAt() {
  console.log("\n[6] OrderCommission.settledAt updated after mark paid");

  const commission = await prisma.orderCommission.findUnique({ where: { orderId: mainOrderId } });
  assert(commission?.settledAt !== null, "OrderCommission.settledAt set");
}

async function testSettlementList() {
  console.log("\n[7] Settlement list with status filter");

  const r = await get("/api/settlements", adminToken);
  assertEq(r.status, 200, "GET /api/settlements → 200");
  const payload = r.json as { data?: { settlements?: unknown[]; total?: number } };
  assert(typeof payload.data !== "undefined", "Response has data");

  const rf = await get("/api/settlements?status=COMPLETED", adminToken);
  assertEq(rf.status, 200, "GET /api/settlements?status=COMPLETED → 200");
  const filtered = (rf.json as { data?: { settlements?: unknown[] } }).data?.settlements ?? [];
  assert(
    (filtered as Array<{ status: string }>).every((s) => s.status === "COMPLETED"),
    "All filtered settlements are COMPLETED"
  );
}

async function testSettlementReport() {
  console.log("\n[8] Settlement report aggregate");

  const r = await get("/api/settlements/report", adminToken);
  assertEq(r.status, 200, "GET /api/settlements/report → 200");
  const report = (r.json as { data?: { totals?: { platformFee: number; count: number } } }).data;
  assert(typeof report?.totals !== "undefined", "Report has totals");
  assert((report?.totals?.count ?? 0) >= 1, "At least one settlement in report");
  assert((report?.totals?.platformFee ?? 0) > 0, "Platform fee total > 0");
}

async function testNonDeliveredSettlement() {
  console.log("\n[9] Settlement rejected for non-DELIVERED order");

  const r = await post("/api/settlements", { orderId: placedOrderId }, adminToken);
  assertEq(r.status, 400, "Non-DELIVERED order → 400");
  assert((r.json as { error?: string }).error?.includes("DELIVERED") ?? false, "Error mentions DELIVERED");
}

async function testCommissionReport() {
  console.log("\n[10] Commission report aggregate totals");

  const r = await get("/api/commissions/report", adminToken);
  assertEq(r.status, 200, "GET /api/commissions/report → 200");
  const report = r.json as { data?: { count: number; platformRevenue: number; settled: number; unsettled: number } };
  assert((report.data?.count ?? 0) >= 1, "At least one commission");
  assert((report.data?.platformRevenue ?? 0) > 0, "Platform revenue > 0");
  assert(typeof report.data?.settled === "number", "settled count present");
  assert(typeof report.data?.unsettled === "number", "unsettled count present");
}

async function testCommissionList() {
  console.log("\n[11] Commission list paginated");

  const r = await get("/api/commissions?limit=5&offset=0", adminToken);
  assertEq(r.status, 200, "GET /api/commissions → 200");
  const payload = r.json as { data?: { commissions?: unknown[]; total?: number } };
  assert(Array.isArray(payload.data?.commissions), "commissions is array");
  assert((payload.data?.total ?? 0) >= 1, "total >= 1");
}

let invoiceId: string;
let invoiceNumber: string;

async function testInvoiceAutoGenerate() {
  console.log("\n[12] Invoice: auto-generate on first GET");

  const r = await get(`/api/invoices/order/${mainOrderId}`, customerToken);
  assertEq(r.status, 200, "GET /api/invoices/order/:id → 200");
  const inv = (r.json as { data?: { id: string; invoiceNumber: string; orderId: string } }).data;
  assert(typeof inv?.id === "string", "Invoice id present");
  assert(typeof inv?.invoiceNumber === "string", "Invoice number present");
  assert(inv?.invoiceNumber.startsWith("INV-") ?? false, "Invoice number starts with INV-");
  assertEq(inv?.orderId, mainOrderId, "Invoice orderId matches");
  invoiceId     = inv!.id;
  invoiceNumber = inv!.invoiceNumber;
}

async function testInvoiceIdempotent() {
  console.log("\n[13] Invoice: idempotent (second GET returns same number)");

  const r = await get(`/api/invoices/order/${mainOrderId}`, customerToken);
  assertEq(r.status, 200, "Second GET → 200");
  const inv2 = (r.json as { data?: { invoiceNumber: string } }).data;
  assertEq(inv2?.invoiceNumber, invoiceNumber, "Invoice number unchanged on second GET");
}

async function testInvoiceAdminGenerate() {
  console.log("\n[14] Invoice: admin explicit generate (idempotent)");

  const r = await post(`/api/invoices/order/${mainOrderId}/generate`, {}, adminToken);
  assertEq(r.status, 200, "POST /generate → 200");
  const inv = (r.json as { data?: { invoiceNumber: string } }).data;
  assertEq(inv?.invoiceNumber, invoiceNumber, "Same invoice number returned (idempotent)");
}

async function testInvoiceSnapshots() {
  console.log("\n[15] Invoice: orderSnapshot and customerSnapshot present");

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  assert(inv?.orderSnapshot !== null, "orderSnapshot present");
  assert(inv?.customerSnapshot !== null, "customerSnapshot present");

  const snap = inv?.orderSnapshot as Record<string, unknown>;
  assert(typeof snap?.orderNumber === "string", "orderSnapshot has orderNumber");
  assert(typeof snap?.total === "number", "orderSnapshot has total");

  const custSnap = inv?.customerSnapshot as Record<string, unknown>;
  assert(typeof custSnap?.email === "string", "customerSnapshot has email");
}

async function testInvoiceForbiddenOtherCustomer() {
  console.log("\n[16] Invoice: forbidden for other customer");

  const r = await get(`/api/invoices/order/${mainOrderId}`, customer2Token);
  assertEq(r.status, 403, "Other customer → 403");

  const r2 = await get(`/api/invoices/${invoiceId}`, customer2Token);
  assertEq(r2.status, 403, "GET /api/invoices/:id other customer → 403");
}

async function testCommissionSettledFilter() {
  console.log("\n[17] Commission settled filter");

  const unsettled = await get("/api/commissions?settled=false", adminToken);
  assertEq(unsettled.status, 200, "GET /api/commissions?settled=false → 200");

  const settled = await get("/api/commissions?settled=true", adminToken);
  assertEq(settled.status, 200, "GET /api/commissions?settled=true → 200");

  const settledList = (settled.json as { data?: { commissions?: Array<{ settledAt: string | null }> } }).data?.commissions ?? [];
  assert(settledList.every((c) => c.settledAt !== null), "All settled commissions have settledAt");
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Sprint 4.5 — Settlement, Commission & Invoice");
  console.log("═══════════════════════════════════════════════════");

  await setupServer();
  console.log(`Server on port ${port}`);

  try {
    await setup();
    console.log("Setup complete");

    await testAuthEnforcement();
    await testSettlementCalculate();
    await testSettlementCreate();
    await testSettlementDuplicate();
    await testSettlementMarkPaid();
    await testOrderCommissionSettledAt();
    await testSettlementList();
    await testSettlementReport();
    await testNonDeliveredSettlement();
    await testCommissionReport();
    await testCommissionList();
    await testInvoiceAutoGenerate();
    await testInvoiceIdempotent();
    await testInvoiceAdminGenerate();
    await testInvoiceSnapshots();
    await testInvoiceForbiddenOtherCustomer();
    await testCommissionSettledFilter();
  } finally {
    await cleanup().catch(console.error);
    await teardownServer();
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
