/**
 * Sprint 4.3 — Payment Gateway Tests   @pay43.celebstyle.test
 *
 * Covers: POST /api/payments/create, /verify, /webhook
 * Provider: SimulatedProvider (PAYMENT_PROVIDER not set → default "simulated")
 */

import { createHmac, randomBytes } from "node:crypto";
import http from "node:http";
import { prisma } from "../lib/prisma.js";
import { createApp } from "../app.js";

// ── HMAC helpers (mirror SimulatedProvider internals) ─────────────────────────

const SIMULATED_KEY_SECRET = "simulated-key-secret";
const SIMULATED_WEBHOOK_SECRET = "simulated-webhook-secret";

function makePaymentSignature(gatewayOrderId: string, gatewayPaymentId: string): string {
  return createHmac("sha256", SIMULATED_KEY_SECRET)
    .update(`${gatewayOrderId}|${gatewayPaymentId}`)
    .digest("hex");
}

function makeWebhookSignature(rawBody: string): string {
  return createHmac("sha256", SIMULATED_WEBHOOK_SECRET).update(rawBody).digest("hex");
}

function buildWebhookBody(
  eventId: string,
  eventType: string,
  gatewayOrderId: string,
  gatewayPaymentId: string
): string {
  return JSON.stringify({
    id: eventId,
    event: eventType,
    payload: {
      payment: {
        entity: {
          id: gatewayPaymentId,
          order_id: gatewayOrderId,
          status: eventType === "payment.captured" ? "captured" : "failed",
        },
      },
    },
  });
}

// ── Console suppression ───────────────────────────────────────────────────────
const _origErr = console.error.bind(console);
console.error = () => {};

// ── Test runner ───────────────────────────────────────────────────────────────

interface Result {
  status: number;
  body: Record<string, unknown>;
}

let server: http.Server;
let baseUrl: string;

async function request(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<Result> {
  const url = new URL(path, baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json", ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const body = await response.json() as Record<string, unknown>;
  return { status: response.status, body };
}

// ── Pass / fail counting ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓  ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    passed++;
  } else {
    console.log(`  ✗  ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    failed++;
    failures.push(label);
  }
}

function assertTruthy(label: string, value: unknown) {
  if (value) {
    console.log(`  ✓  ${value !== undefined ? label : label}`);
    passed++;
  } else {
    console.log(`  ✗  ${label} (got ${JSON.stringify(value)})`);
    failed++;
    failures.push(label);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_EMAIL = "pay43user@celebstyle.test";
const TEST_EMAIL_2 = "pay43user2@celebstyle.test";
const TEST_PW = "Test1234!";

async function registerAndLogin(email: string): Promise<string> {
  await request("POST", "/api/auth/register", {
    body: { name: "Pay Test", email, password: TEST_PW },
  });
  const res = await request("POST", "/api/auth/login", {
    body: { email, password: TEST_PW },
  });
  return (res.body.data as Record<string, unknown>).accessToken as string;
}

async function getUserId(email: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { email } });
  return u!.id;
}

async function createAddress(userId: string): Promise<string> {
  const a = await prisma.address.create({
    data: {
      userId,
      fullName: "Pay User",
      phone: "9876543210",
      line1: "1 Pay Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
  });
  return a.id;
}

async function createPendingOrder(
  userId: string,
  addressId: string,
  email: string
): Promise<{ id: string; total: number }> {
  const o = await prisma.order.create({
    data: {
      orderNumber: `CS20260703${randomBytes(3).toString("hex").toUpperCase()}`,
      userId,
      addressId,
      shippingName: "Pay User",
      shippingPhone: "9876543210",
      shippingAddress: "1 Pay Street",
      shippingCity: "Mumbai",
      shippingState: "Maharashtra",
      shippingPincode: "400001",
      customerEmail: email,
      subtotal: 1000000,
      shippingAmount: 0,
      taxAmount: 120000,
      total: 1120000,
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
    },
  });
  return { id: o.id, total: o.total };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

async function setup() {
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;

  // Clean up any leftover test data
  await prisma.webhookEvent.deleteMany({ where: { provider: "SIMULATED" } });
  await prisma.payment.deleteMany({
    where: { order: { customerEmail: { endsWith: "@celebstyle.test" } } },
  });
  await prisma.order.deleteMany({ where: { customerEmail: { endsWith: "@celebstyle.test" } } });
  await prisma.address.deleteMany({
    where: { user: { email: { endsWith: "@celebstyle.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@celebstyle.test" } } });
}

async function teardown() {
  await prisma.webhookEvent.deleteMany({ where: { provider: "SIMULATED" } });
  await prisma.payment.deleteMany({
    where: { order: { customerEmail: { endsWith: "@celebstyle.test" } } },
  });
  await prisma.order.deleteMany({ where: { customerEmail: { endsWith: "@celebstyle.test" } } });
  await prisma.address.deleteMany({
    where: { user: { email: { endsWith: "@celebstyle.test" } } },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@celebstyle.test" } } });
  await new Promise<void>((r) => server.close(() => r()));
  console.error = _origErr;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runTests() {
  await setup();

  let token: string;
  let token2: string;
  let userId: string;
  let userId2: string;
  let addressId: string;

  // Shared state set in groups and consumed by later groups
  let orderId: string;
  let orderId2: string;
  let gatewayOrderId: string;

  // ─ [1] Auth enforcement ─────────────────────────────────────────────────────
  console.log("\n  [1] Auth enforcement — 401 without token");
  {
    const r1 = await request("POST", "/api/payments/create", { body: { orderId: "x" } });
    assert("POST /create → 401", r1.status, 401);

    const r2 = await request("POST", "/api/payments/verify", {
      body: { orderId: "x", gatewayOrderId: "x", gatewayPaymentId: "x", gatewaySignature: "x" },
    });
    assert("POST /verify → 401", r2.status, 401);
    // webhook has no auth guard — no test needed here
  }

  // ─ [2] Setup users / address ─────────────────────────────────────────────────
  token = await registerAndLogin(TEST_EMAIL);
  token2 = await registerAndLogin(TEST_EMAIL_2);
  userId = await getUserId(TEST_EMAIL);
  userId2 = await getUserId(TEST_EMAIL_2);
  addressId = await createAddress(userId);

  // ─ [3] POST /create — success ───────────────────────────────────────────────
  console.log("\n  [3] POST /api/payments/create — success");
  {
    const order = await createPendingOrder(userId, addressId, TEST_EMAIL);
    orderId = order.id;

    const r = await request("POST", "/api/payments/create", {
      token,
      body: { orderId },
    });
    assert("returns 200", r.status, 200);
    const d = r.body.data as Record<string, unknown>;
    assertTruthy("has paymentId", d.paymentId);
    assertTruthy("has gatewayOrderId", d.gatewayOrderId);
    assert("gatewayOrderId starts with sim_order_", (d.gatewayOrderId as string).startsWith("sim_order_"), true);
    assertTruthy("has gatewayKeyId", d.gatewayKeyId);
    assert("provider = SIMULATED", d.provider, "SIMULATED");
    assert("amountPaise = 1120000", d.amountPaise, 1120000);
    assert("currency = INR", d.currency, "INR");

    gatewayOrderId = d.gatewayOrderId as string;
  }

  // ─ [4] POST /create — errors ────────────────────────────────────────────────
  console.log("\n  [4] POST /api/payments/create — errors");
  {
    // Missing orderId
    const r1 = await request("POST", "/api/payments/create", { token, body: {} });
    assert("missing orderId → 400", r1.status, 400);

    // Order not found
    const r2 = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: "nonexistent-order-id" },
    });
    assert("order not found → 404", r2.status, 404);
    assert("code = ORDER_NOT_FOUND", (r2.body as Record<string, unknown>).code, "ORDER_NOT_FOUND");

    // Order belongs to another user (403)
    const order3 = await createPendingOrder(userId2, addressId, TEST_EMAIL_2);
    const r3 = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: order3.id },
    });
    assert("other user's order → 403", r3.status, 403);

    // Order already paid (not AWAITING_PAYMENT)
    const paidOrder = await prisma.order.create({
      data: {
        orderNumber: `CS20260703${randomBytes(3).toString("hex").toUpperCase()}`,
        userId,
        shippingName: "Pay User",
        shippingPhone: "9876543210",
        shippingAddress: "1 Pay Street",
        shippingCity: "Mumbai",
        shippingState: "Maharashtra",
        shippingPincode: "400001",
        customerEmail: TEST_EMAIL,
        subtotal: 500000,
        shippingAmount: 0,
        taxAmount: 60000,
        total: 560000,
        status: "PLACED",
        paymentStatus: "CAPTURED",
      },
    });
    const r4 = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: paidOrder.id },
    });
    assert("already-paid order → 409", r4.status, 409);
    assert("code = ORDER_NOT_PAYABLE", (r4.body as Record<string, unknown>).code, "ORDER_NOT_PAYABLE");
  }

  // ─ [5] POST /create — idempotency ───────────────────────────────────────────
  console.log("\n  [5] POST /api/payments/create — idempotency");
  {
    // Same orderId → same gatewayOrderId (cached PENDING payment)
    const r = await request("POST", "/api/payments/create", { token, body: { orderId } });
    assert("second call → 200", r.status, 200);
    const d = r.body.data as Record<string, unknown>;
    assert("same gatewayOrderId returned", d.gatewayOrderId, gatewayOrderId);
    assert("only one Payment in DB", (await prisma.payment.count({ where: { orderId, status: "PENDING" } })), 1);
  }

  // ─ [6] POST /verify — invalid signature ─────────────────────────────────────
  console.log("\n  [6] POST /api/payments/verify — invalid signature");
  {
    const r1 = await request("POST", "/api/payments/verify", {
      token,
      body: { orderId, gatewayOrderId, gatewayPaymentId: "sim_pay_bad", gatewaySignature: "bad_sig" },
    });
    assert("invalid sig → 422", r1.status, 422);
    assert("code = PAYMENT_VERIFICATION_FAILED", (r1.body as Record<string, unknown>).code, "PAYMENT_VERIFICATION_FAILED");
  }

  // ─ [7] POST /verify — missing fields ────────────────────────────────────────
  console.log("\n  [7] POST /api/payments/verify — missing fields");
  {
    const r = await request("POST", "/api/payments/verify", {
      token,
      body: { orderId },
    });
    assert("missing fields → 400", r.status, 400);
  }

  // ─ [8] POST /verify — success ───────────────────────────────────────────────
  console.log("\n  [8] POST /api/payments/verify — success");
  {
    const gatewayPaymentId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const sig = makePaymentSignature(gatewayOrderId, gatewayPaymentId);

    const r = await request("POST", "/api/payments/verify", {
      token,
      body: { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature: sig },
    });
    assert("returns 200", r.status, 200);
    const d = r.body.data as Record<string, unknown>;
    assert("success = true", d.success, true);
    assert("orderStatus = PLACED", d.orderStatus, "PLACED");

    // DB checks
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    assert("order status = PLACED in DB", order?.status, "PLACED");
    assert("order paymentStatus = CAPTURED in DB", order?.paymentStatus, "CAPTURED");

    const payment = await prisma.payment.findFirst({ where: { orderId, status: "CAPTURED" } });
    assertTruthy("payment status = CAPTURED in DB", payment);
    assertTruthy("capturedAt set", payment?.capturedAt);
    assert("providerPaymentId set", payment?.providerPaymentId, gatewayPaymentId);
  }

  // ─ [9] POST /verify — order already processed ───────────────────────────────
  console.log("\n  [9] POST /api/payments/verify — order already PLACED");
  {
    const fakePayId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const sig = makePaymentSignature(gatewayOrderId, fakePayId);
    const r = await request("POST", "/api/payments/verify", {
      token,
      body: { orderId, gatewayOrderId, gatewayPaymentId: fakePayId, gatewaySignature: sig },
    });
    assert("already-processed → 409", r.status, 409);
    assert("code = ORDER_ALREADY_PROCESSED", (r.body as Record<string, unknown>).code, "ORDER_ALREADY_PROCESSED");
  }

  // ─ [10] POST /verify — forbidden ────────────────────────────────────────────
  console.log("\n  [10] POST /api/payments/verify — forbidden");
  {
    const order2 = await createPendingOrder(userId, addressId, TEST_EMAIL);
    orderId2 = order2.id;
    const r1 = await request("POST", "/api/payments/create", { token, body: { orderId: orderId2 } });
    const gw2 = (r1.body.data as Record<string, unknown>).gatewayOrderId as string;

    const fakePayId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const sig = makePaymentSignature(gw2, fakePayId);

    const r = await request("POST", "/api/payments/verify", {
      token: token2, // wrong user
      body: { orderId: orderId2, gatewayOrderId: gw2, gatewayPaymentId: fakePayId, gatewaySignature: sig },
    });
    assert("verify with wrong user → 403", r.status, 403);
  }

  // ─ [11] POST /webhook — invalid signature ───────────────────────────────────
  console.log("\n  [11] POST /api/payments/webhook — invalid signature");
  {
    const body = JSON.stringify({ id: "evt_bad", event: "payment.captured" });
    const r = await request("POST", "/api/payments/webhook", {
      body: JSON.parse(body) as unknown,
      headers: { "x-payment-signature": "badsignature" },
    });
    assert("bad sig → 400", r.status, 400);
    assert("code = INVALID_WEBHOOK_SIGNATURE", (r.body as Record<string, unknown>).code, "INVALID_WEBHOOK_SIGNATURE");
  }

  // ─ [12] POST /webhook — payment.captured event ──────────────────────────────
  console.log("\n  [12] POST /api/payments/webhook — payment.captured");
  {
    // Create a fresh order and payment session
    const whOrder = await createPendingOrder(userId, addressId, TEST_EMAIL);
    const createRes = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: whOrder.id },
    });
    const whGwOrderId = (createRes.body.data as Record<string, unknown>).gatewayOrderId as string;
    const whGwPayId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const eventId = `evt_${randomBytes(8).toString("hex")}`;

    const rawBody = buildWebhookBody(eventId, "payment.captured", whGwOrderId, whGwPayId);
    const sig = makeWebhookSignature(rawBody);

    const r = await request("POST", "/api/payments/webhook", {
      body: JSON.parse(rawBody) as unknown,
      headers: { "x-payment-signature": sig },
    });
    assert("returns 200", r.status, 200);
    const d = r.body.data as Record<string, unknown>;
    assert("processed = true", d.processed, true);

    // DB checks
    const updatedOrder = await prisma.order.findUnique({ where: { id: whOrder.id } });
    assert("order status = PLACED via webhook", updatedOrder?.status, "PLACED");

    const whPayment = await prisma.payment.findFirst({ where: { orderId: whOrder.id } });
    assert("payment CAPTURED via webhook", whPayment?.status, "CAPTURED");

    const whEvent = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: "SIMULATED", eventId } },
    });
    assertTruthy("WebhookEvent stored", whEvent);
    assert("eventType stored", whEvent?.eventType, "payment.captured");
  }

  // ─ [13] POST /webhook — duplicate (idempotency) ─────────────────────────────
  console.log("\n  [13] POST /api/payments/webhook — duplicate event");
  {
    const dupOrder = await createPendingOrder(userId, addressId, TEST_EMAIL);
    const createRes = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: dupOrder.id },
    });
    const dupGwOrderId = (createRes.body.data as Record<string, unknown>).gatewayOrderId as string;
    const dupGwPayId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const dupEventId = `evt_dup_${randomBytes(8).toString("hex")}`;
    const rawBody = buildWebhookBody(dupEventId, "payment.captured", dupGwOrderId, dupGwPayId);
    const sig = makeWebhookSignature(rawBody);

    // First delivery
    await request("POST", "/api/payments/webhook", {
      body: JSON.parse(rawBody) as unknown,
      headers: { "x-payment-signature": sig },
    });

    // Second delivery — same event
    const r2 = await request("POST", "/api/payments/webhook", {
      body: JSON.parse(rawBody) as unknown,
      headers: { "x-payment-signature": sig },
    });
    assert("duplicate returns 200", r2.status, 200);
    const d2 = r2.body.data as Record<string, unknown>;
    assert("processed = false (duplicate)", d2.processed, false);
    assert("reason = duplicate", d2.reason, "duplicate");
  }

  // ─ [14] POST /webhook — payment.failed event ────────────────────────────────
  console.log("\n  [14] POST /api/payments/webhook — payment.failed");
  {
    const failOrder = await createPendingOrder(userId, addressId, TEST_EMAIL);
    const createRes = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: failOrder.id },
    });
    const failGwOrderId = (createRes.body.data as Record<string, unknown>).gatewayOrderId as string;
    const failGwPayId = `sim_pay_${randomBytes(8).toString("hex")}`;
    const eventId = `evt_fail_${randomBytes(8).toString("hex")}`;

    const rawBody = buildWebhookBody(eventId, "payment.failed", failGwOrderId, failGwPayId);
    const sig = makeWebhookSignature(rawBody);

    const r = await request("POST", "/api/payments/webhook", {
      body: JSON.parse(rawBody) as unknown,
      headers: { "x-payment-signature": sig },
    });
    assert("payment.failed → 200", r.status, 200);

    const failPayment = await prisma.payment.findFirst({ where: { orderId: failOrder.id } });
    assert("payment status = FAILED", failPayment?.status, "FAILED");

    // Order should still be AWAITING_PAYMENT (not cancelled by failed payment)
    const failOrderDb = await prisma.order.findUnique({ where: { id: failOrder.id } });
    assert("order stays AWAITING_PAYMENT after failure", failOrderDb?.status, "AWAITING_PAYMENT");
  }

  // ─ [15] COD payment ─────────────────────────────────────────────────────────
  console.log("\n  [15] POST /api/payments/create — COD");
  {
    const codOrder = await createPendingOrder(userId, addressId, TEST_EMAIL);

    const r = await request("POST", "/api/payments/create", {
      token,
      body: { orderId: codOrder.id, method: "COD" },
    });
    assert("COD create → 200", r.status, 200);
    const d = r.body.data as Record<string, unknown>;
    assert("method = COD", d.method, "COD");
    assert("confirmed = true", d.confirmed, true);
    assert("orderStatus = CONFIRMED", d.orderStatus, "CONFIRMED");

    // DB check
    const codOrderDb = await prisma.order.findUnique({ where: { id: codOrder.id } });
    assert("COD order status = CONFIRMED in DB", codOrderDb?.status, "CONFIRMED");
    assert("COD order paymentStatus = CAPTURED", codOrderDb?.paymentStatus, "CAPTURED");

    const codPayment = await prisma.payment.findFirst({ where: { orderId: codOrder.id } });
    assert("COD payment method = COD in DB", codPayment?.method, "COD");
    assert("COD payment status = CAPTURED in DB", codPayment?.status, "CAPTURED");
  }

  await teardown();
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log("============================================================");
console.log("  Sprint 4.3 — Payment Gateway Tests");
console.log("============================================================");

runTests()
  .then(() => {
    console.log("\n============================================================");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    if (failures.length > 0) {
      console.log("\n  Failed:");
      failures.forEach((f) => console.log(`    - ${f}`));
    }
    console.log("============================================================\n");
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Unhandled error in test suite:", err);
    process.exit(1);
  });
