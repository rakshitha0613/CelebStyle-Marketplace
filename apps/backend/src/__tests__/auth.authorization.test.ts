/**
 * Phase 3.7 — API Authorization Tests
 *
 * Verifies that all business routes enforce the correct access policy:
 *   - Public reads (GET /celebrities, /outfits, /manufacturers, /storefronts) require no auth
 *   - Protected write endpoints reject unauthenticated requests with 401
 *   - CUSTOMER role is denied admin-only endpoints with 403
 *   - ADMIN can reach ADMIN-guarded endpoints (business logic, not auth, determines final status)
 *   - SUPER_ADMIN can reach DELETE endpoints that ADMIN cannot
 *   - Order GET/:id and POST/:id/pay enforce owner-or-admin ownership
 *
 * Test orders are created in the live DB and cleaned up by sentinel email prefix.
 *
 * All accounts use the "@phase37.celebstyle.test" sentinel.
 *
 * Run: npm run test:api-authorization
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
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)})`);
}

// ── Sentinel ──────────────────────────────────────────────────────────────────

const SUFFIX = "@phase37.celebstyle.test";
const TEST_PASSWORD = "TestPass37!";

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

async function put(path: string, body: unknown, token?: string): Promise<Result> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "PUT",
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

// ── Token setup ───────────────────────────────────────────────────────────────

type Tokens = {
  customer1: string;
  customer2: string;
  admin: string;
  superAdmin: string;
};

let tokens: Tokens;
let customer1Email: string;
let customer2Email: string;

async function setupUsers(): Promise<void> {
  customer1Email = `customer1${SUFFIX}`;
  customer2Email = `customer2${SUFFIX}`;

  const passwordHash = await hashPassword(TEST_PASSWORD);

  // Create all test users directly via Prisma (skips notification side effects)
  await prisma.user.createMany({
    data: [
      { email: customer1Email,           passwordHash, name: "Customer One", role: "CUSTOMER"   },
      { email: customer2Email,           passwordHash, name: "Customer Two", role: "CUSTOMER"   },
      { email: `admin${SUFFIX}`,         passwordHash, name: "Admin User",   role: "ADMIN"      },
      { email: `superadmin${SUFFIX}`,    passwordHash, name: "Super Admin",  role: "SUPER_ADMIN"},
    ],
  });

  // Login all four in parallel to obtain real Bearer tokens
  const loginUrl = `http://127.0.0.1:${port}/api/auth/login`;
  const loginAs = async (email: string): Promise<string> => {
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const body = await res.json() as { data: { accessToken: string } };
    return body.data.accessToken;
  };

  const [t1, t2, t3, t4] = await Promise.all([
    loginAs(customer1Email),
    loginAs(customer2Email),
    loginAs(`admin${SUFFIX}`),
    loginAs(`superadmin${SUFFIX}`),
  ]);

  tokens = { customer1: t1, customer2: t2, admin: t3, superAdmin: t4 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   Phase 3.7 — API Authorization Tests                ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  // Pre-cleanup: remove any data left by a previous failed run
  await prisma.order.deleteMany({ where: { customerEmail: { endsWith: SUFFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });

  await setupServer();
  await setupUsers();

  // ── 1. Public reads — no authentication required ──────────────────────────
  console.log("── 1. Public reads — no auth required ──────────────────────────");

  assertEq((await get("/api/celebrities")).status,                           200, "GET /celebrities → 200 (no auth)");
  assertEq((await get("/api/celebrities/shah-rukh-khan")).status,            200, "GET /celebrities/:id → 200 (no auth)");
  assertEq((await get("/api/outfits")).status,                               200, "GET /outfits → 200 (no auth)");
  assertEq((await get("/api/outfits/look-shah-rukh-khan-red-carpet")).status, 200, "GET /outfits/:id → 200 (no auth)");
  assertEq((await get("/api/manufacturers")).status,                         200, "GET /manufacturers → 200 (no auth)");
  assertEq((await get("/api/storefronts")).status,                           200, "GET /storefronts → 200 (no auth)");

  // ── 2. Protected endpoints — 401 without token ───────────────────────────
  console.log("\n── 2. Protected endpoints → 401 without token ──────────────────");

  assertEq((await post("/api/celebrities",                      {})).status, 401, "POST /celebrities → 401");
  assertEq((await put ("/api/celebrities/x",                    {})).status, 401, "PUT /celebrities/:id → 401");
  assertEq((await del ("/api/celebrities/x"                       )).status, 401, "DELETE /celebrities/:id → 401");
  assertEq((await post("/api/outfits",                          {})).status, 401, "POST /outfits → 401");
  assertEq((await put ("/api/outfits/x",                        {})).status, 401, "PUT /outfits/:id → 401");
  assertEq((await del ("/api/outfits/x"                           )).status, 401, "DELETE /outfits/:id → 401");
  assertEq((await post("/api/manufacturers",                    {})).status, 401, "POST /manufacturers → 401");
  assertEq((await put ("/api/manufacturers/x",                  {})).status, 401, "PUT /manufacturers/:id → 401");
  assertEq((await del ("/api/manufacturers/x"                     )).status, 401, "DELETE /manufacturers/:id → 401");
  assertEq((await get ("/api/orders"                              )).status, 401, "GET /orders → 401");
  assertEq((await post("/api/orders",                           {})).status, 401, "POST /orders → 401");
  assertEq((await get ("/api/orders/nonexistent-order"            )).status, 401, "GET /orders/:id → 401");
  assertEq((await post("/api/orders/nonexistent-order/pay",     {})).status, 401, "POST /orders/:id/pay → 401");
  assertEq((await patch("/api/orders/nonexistent-order/status", {})).status, 401, "PATCH /orders/:id/status → 401");
  assertEq((await post("/api/storefronts",                      {})).status, 401, "POST /storefronts → 401");
  assertEq((await get ("/api/storefronts/metrics/commission"      )).status, 401, "GET /storefronts/metrics/commission → 401");

  // ── 3. Admin-only endpoints — 403 for CUSTOMER ───────────────────────────
  console.log("\n── 3. Admin-only endpoints → 403 for CUSTOMER ──────────────────");

  assertEq((await post("/api/celebrities",                       {}, tokens.customer1)).status, 403, "POST /celebrities with CUSTOMER → 403");
  assertEq((await put ("/api/celebrities/x",                     {}, tokens.customer1)).status, 403, "PUT /celebrities/:id with CUSTOMER → 403");
  assertEq((await del ("/api/celebrities/x",                         tokens.customer1)).status, 403, "DELETE /celebrities/:id with CUSTOMER → 403");
  assertEq((await post("/api/outfits",                           {}, tokens.customer1)).status, 403, "POST /outfits with CUSTOMER → 403");
  assertEq((await put ("/api/outfits/x",                         {}, tokens.customer1)).status, 403, "PUT /outfits/:id with CUSTOMER → 403");
  assertEq((await del ("/api/outfits/x",                             tokens.customer1)).status, 403, "DELETE /outfits/:id with CUSTOMER → 403");
  assertEq((await post("/api/manufacturers",                     {}, tokens.customer1)).status, 403, "POST /manufacturers with CUSTOMER → 403");
  assertEq((await put ("/api/manufacturers/x",                   {}, tokens.customer1)).status, 403, "PUT /manufacturers/:id with CUSTOMER → 403");
  assertEq((await del ("/api/manufacturers/x",                       tokens.customer1)).status, 403, "DELETE /manufacturers/:id with CUSTOMER → 403");
  assertEq((await get ("/api/orders",                                tokens.customer1)).status, 403, "GET /orders with CUSTOMER → 403");
  assertEq((await post("/api/storefronts",                       {}, tokens.customer1)).status, 403, "POST /storefronts with CUSTOMER → 403");
  assertEq((await get ("/api/storefronts/metrics/commission",        tokens.customer1)).status, 403, "GET /storefronts/metrics/commission with CUSTOMER → 403");
  assertEq((await patch("/api/orders/fake/status", { status: "shipped" }, tokens.customer1)).status, 403, "PATCH /orders/:id/status with CUSTOMER → 403");

  // ── 4. DELETE endpoints — 403 for ADMIN (SUPER_ADMIN only) ───────────────
  console.log("\n── 4. DELETE → 403 for ADMIN (SUPER_ADMIN required) ────────────");

  assertEq((await del("/api/celebrities/nonexistent",   tokens.admin)).status, 403, "DELETE /celebrities/:id with ADMIN → 403");
  assertEq((await del("/api/manufacturers/nonexistent", tokens.admin)).status, 403, "DELETE /manufacturers/:id with ADMIN → 403");

  // ── 5. ADMIN passes auth guard — business-logic response confirms it ──────
  console.log("\n── 5. ADMIN bypasses guard → business-logic response ────────────");

  assertEq((await post("/api/celebrities",   {},                 tokens.admin)).status, 400, "POST /celebrities with ADMIN → 400 (auth passed, missing fields)");
  assertEq((await post("/api/outfits",       {},                 tokens.admin)).status, 400, "POST /outfits with ADMIN → 400 (auth passed, missing fields)");
  assertEq((await post("/api/manufacturers", {},                 tokens.admin)).status, 400, "POST /manufacturers with ADMIN → 400 (auth passed, missing fields)");
  assertEq((await put ("/api/celebrities/nonexistent",   { name: "X" }, tokens.admin)).status, 404, "PUT /celebrities/nonexistent with ADMIN → 404");
  assertEq((await put ("/api/manufacturers/nonexistent", { name: "X" }, tokens.admin)).status, 404, "PUT /manufacturers/nonexistent with ADMIN → 404");

  const ordersRes = await get("/api/orders", tokens.admin);
  assertEq(ordersRes.status, 200, "GET /orders with ADMIN → 200");
  assert(Array.isArray((ordersRes.json as { data: unknown[] }).data), "GET /orders returns array");

  const commissionRes = await get("/api/storefronts/metrics/commission", tokens.admin);
  assertEq(commissionRes.status, 200, "GET /storefronts/metrics/commission with ADMIN → 200");

  assertEq((await del("/api/celebrities/nonexistent",   tokens.superAdmin)).status, 404, "DELETE /celebrities with SUPER_ADMIN → 404 (auth passed)");
  assertEq((await del("/api/manufacturers/nonexistent", tokens.superAdmin)).status, 404, "DELETE /manufacturers with SUPER_ADMIN → 404 (auth passed)");

  // ── 6. POST /orders — any authenticated user can place an order ───────────
  console.log("\n── 6. POST /orders — any authenticated user ─────────────────────");

  const createRes = await post(
    "/api/orders",
    {
      customerName:  "Customer One",
      customerEmail: customer1Email,
      address:       "123 Test Street, Mumbai, MH 400001",
      items: [{ outfitId: "look-shah-rukh-khan-red-carpet", size: "M" }],
    },
    tokens.customer1
  );
  assertEq(createRes.status, 201, "POST /orders with CUSTOMER → 201");
  const orderId = (createRes.json as { data: { id: string } }).data?.id;
  assert(typeof orderId === "string" && orderId.startsWith("ord-"), "created order has valid orderNumber");

  // ── 7. GET /orders/:id — owner-or-admin ownership ────────────────────────
  console.log("\n── 7. GET /orders/:id — ownership enforcement ───────────────────");

  assertEq((await get(`/api/orders/${orderId}`)).status,                   401, "GET /orders/:id without token → 401");
  assertEq((await get(`/api/orders/${orderId}`, tokens.customer1)).status, 200, "GET /orders/:id with owner (CUSTOMER1) → 200");
  assertEq((await get(`/api/orders/${orderId}`, tokens.customer2)).status, 403, "GET /orders/:id with non-owner (CUSTOMER2) → 403");
  assertEq((await get(`/api/orders/${orderId}`, tokens.admin)).status,     200, "GET /orders/:id with ADMIN → 200 (bypasses ownership)");
  assertEq((await get(`/api/orders/${orderId}`, tokens.superAdmin)).status, 200, "GET /orders/:id with SUPER_ADMIN → 200 (bypasses ownership)");
  assertEq((await get("/api/orders/nonexistent-order-99", tokens.customer1)).status, 404, "GET /orders/nonexistent with auth → 404 (auth passed)");

  // ── 8. POST /orders/:id/pay — owner-or-admin ownership ───────────────────
  console.log("\n── 8. POST /orders/:id/pay — ownership enforcement ─────────────");

  assertEq((await post(`/api/orders/${orderId}/pay`,     {})).status,                   401, "POST /orders/:id/pay without token → 401");
  assertEq((await post(`/api/orders/${orderId}/pay`, {}, tokens.customer2)).status,     403, "POST /orders/:id/pay with non-owner → 403");

  const payRes = await post(`/api/orders/${orderId}/pay`, {}, tokens.customer1);
  assertEq(payRes.status, 200, "POST /orders/:id/pay with owner (CUSTOMER1) → 200");
  assertEq((payRes.json as { data: { paymentStatus: string } }).data?.paymentStatus, "paid", "paymentStatus is 'paid' after payment");

  // ADMIN can also trigger pay (idempotent — already captured)
  assertEq((await post(`/api/orders/${orderId}/pay`, {}, tokens.admin)).status, 200, "POST /orders/:id/pay with ADMIN on already-paid order → 200 (idempotent)");

  // ── 9. PATCH /orders/:id/status — ADMIN / SUPER_ADMIN only ───────────────
  console.log("\n── 9. PATCH /orders/:id/status — ADMIN only ─────────────────────");

  const shippedRes = await patch(`/api/orders/${orderId}/status`, { status: "shipped" }, tokens.admin);
  assertEq(shippedRes.status, 200, "PATCH /orders/:id/status with ADMIN → 200");
  assertEq((shippedRes.json as { data: { status: string } }).data?.status, "shipped", "status updated to 'shipped'");

  const deliveredRes = await patch(`/api/orders/${orderId}/status`, { status: "delivered" }, tokens.superAdmin);
  assertEq(deliveredRes.status, 200, "PATCH /orders/:id/status with SUPER_ADMIN → 200");
  assertEq((deliveredRes.json as { data: { status: string } }).data?.status, "delivered", "status updated to 'delivered'");

  // ── 10. Storefronts — write guard + SUPER_ADMIN can write ────────────────
  console.log("\n── 10. Storefronts — protected write ────────────────────────────");

  // POST with ADMIN using nonexistent celebrity → 404 proves auth guard passed
  const sfRes = await post("/api/storefronts", { celebrityId: "nonexistent-celeb", displayName: "Test" }, tokens.admin);
  assertEq(sfRes.status, 404, "POST /storefronts with ADMIN + nonexistent celebrity → 404 (auth passed)");

  // SUPER_ADMIN gets same business-logic response
  const sfResSuper = await post("/api/storefronts", { celebrityId: "nonexistent-celeb", displayName: "Test" }, tokens.superAdmin);
  assertEq(sfResSuper.status, 404, "POST /storefronts with SUPER_ADMIN + nonexistent celebrity → 404 (auth passed)");

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await teardownServer();
  await prisma.order.deleteMany({ where: { customerEmail: { endsWith: SUFFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
  await prisma.$disconnect();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
