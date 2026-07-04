/**
 * Sprint 4.1 — Address API Tests
 *
 * Covers:
 *   - GET /api/addresses (list, empty state, only active returned)
 *   - POST /api/addresses (create, first address auto-defaults, validation)
 *   - PATCH /api/addresses/:id (update fields, set default shipping/billing)
 *   - DELETE /api/addresses/:id (soft delete — row persists, isActive=false)
 *   - Auth enforcement (401 with no token)
 *   - Ownership enforcement (403 for other user's address)
 *   - Independent isDefaultShipping / isDefaultBilling flags
 *   - Phone and postalCode validation
 *
 * All test accounts use "@addr41.celebstyle.test" sentinel.
 *
 * Run: npm run test:address
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";

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

// ── Sentinel ──────────────────────────────────────────────────────────────────

const SUFFIX = "@addr41.celebstyle.test";
const TEST_PASSWORD = "AddrTest41!";

let token1: string;
let token2: string;

const VALID_ADDRESS = {
  label:    "Home",
  fullName: "Test User",
  phone:    "9876543210",
  line1:    "123 Test Street",
  city:     "Mumbai",
  state:    "Maharashtra",
  pincode:  "400001",
  country:  "India",
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where:  { email: { endsWith: SUFFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function setup(): Promise<void> {
  await cleanup();

  const passwordHash = await hashPassword(TEST_PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: `user1${SUFFIX}`, passwordHash, name: "Address User One", role: "CUSTOMER" },
      { email: `user2${SUFFIX}`, passwordHash, name: "Address User Two", role: "CUSTOMER" },
    ],
  });

  const loginAs = async (email: string): Promise<string> => {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password: TEST_PASSWORD }),
    });
    const body = await res.json() as { data: { accessToken: string } };
    return body.data.accessToken;
  };

  [token1, token2] = await Promise.all([
    loginAs(`user1${SUFFIX}`),
    loginAs(`user2${SUFFIX}`),
  ]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testAuthEnforcement(): Promise<void> {
  console.log("\n  [1] Auth enforcement");

  const r1 = await get("/api/addresses");
  assertEq(r1.status, 401, "GET /api/addresses without token → 401");

  const r2 = await post("/api/addresses", VALID_ADDRESS);
  assertEq(r2.status, 401, "POST /api/addresses without token → 401");

  const r3 = await patch("/api/addresses/some-id", {});
  assertEq(r3.status, 401, "PATCH /api/addresses/:id without token → 401");

  const r4 = await del("/api/addresses/some-id");
  assertEq(r4.status, 401, "DELETE /api/addresses/:id without token → 401");
}

async function testEmptyList(): Promise<void> {
  console.log("\n  [2] GET /api/addresses — empty list");

  const r = await get("/api/addresses", token1);
  assertEq(r.status, 200, "returns 200");
  const addresses = (r.json as { data: unknown[] }).data;
  assert(Array.isArray(addresses), "data is array");
  assertEq(addresses.length, 0, "empty for new user");
}

async function testCreateFirstAddress(): Promise<void> {
  console.log("\n  [3] POST /api/addresses — first address auto-defaults");

  const r = await post("/api/addresses", VALID_ADDRESS, token1);
  assertEq(r.status, 201, "returns 201");

  const addr = (r.json as { data: {
    id: string; fullName: string; city: string; country: string;
    isDefaultShipping: boolean; isDefaultBilling: boolean;
  } }).data;

  assertEq(addr.fullName, "Test User", "fullName saved");
  assertEq(addr.city, "Mumbai", "city saved");
  assertEq(addr.country, "India", "country saved");
  assert(addr.isDefaultShipping, "first address is default shipping");
  assert(addr.isDefaultBilling, "first address is default billing");
}

async function testCreateSecondAddressNotAutoDefault(): Promise<void> {
  console.log("\n  [4] POST /api/addresses — second address is not auto-default");

  const r = await post("/api/addresses", {
    ...VALID_ADDRESS,
    label:   "Office",
    line1:   "456 Office Park",
    city:    "Pune",
    pincode: "411001",
  }, token1);
  assertEq(r.status, 201, "returns 201");

  const addr = (r.json as { data: { isDefaultShipping: boolean; isDefaultBilling: boolean } }).data;
  assert(!addr.isDefaultShipping, "second address is not default shipping");
  assert(!addr.isDefaultBilling, "second address is not default billing");
}

async function testListAddresses(): Promise<void> {
  console.log("\n  [5] GET /api/addresses — lists active addresses");

  const r = await get("/api/addresses", token1);
  assertEq(r.status, 200, "returns 200");
  const addresses = (r.json as { data: unknown[] }).data;
  assertEq(addresses.length, 2, "2 addresses returned");
}

async function testUpdateAddress(): Promise<void> {
  console.log("\n  [6] PATCH /api/addresses/:id — update fields");

  const listRes = await get("/api/addresses", token1);
  const addresses = (listRes.json as { data: Array<{ id: string; city: string }> }).data;
  const addr = addresses.find((a) => a.city === "Mumbai")!;

  const r = await patch(`/api/addresses/${addr.id}`, { label: "My Home", city: "Delhi" }, token1);
  assertEq(r.status, 200, "returns 200");

  const updated = (r.json as { data: { label: string; city: string } }).data;
  assertEq(updated.label, "My Home", "label updated");
  assertEq(updated.city, "Delhi", "city updated");
}

async function testSetDefaultShipping(): Promise<void> {
  console.log("\n  [7] PATCH — set isDefaultShipping on second address");

  const listRes = await get("/api/addresses", token1);
  const addresses = (listRes.json as { data: Array<{ id: string; isDefaultShipping: boolean }> }).data;
  const nonDefault = addresses.find((a) => !a.isDefaultShipping)!;

  const r = await patch(`/api/addresses/${nonDefault.id}`, { isDefaultShipping: true }, token1);
  assertEq(r.status, 200, "returns 200");
  assert((r.json as { data: { isDefaultShipping: boolean } }).data.isDefaultShipping, "new default shipping set");

  // Old default should now be false
  const listAfter = await get("/api/addresses", token1);
  const allAddrs = (listAfter.json as { data: Array<{ id: string; isDefaultShipping: boolean }> }).data;
  const defaults = allAddrs.filter((a) => a.isDefaultShipping);
  assertEq(defaults.length, 1, "exactly 1 default shipping address");
  assertEq(defaults[0].id, nonDefault.id, "new address is the default");
}

async function testSetDefaultBillingIndependent(): Promise<void> {
  console.log("\n  [8] PATCH — isDefaultBilling is independent of isDefaultShipping");

  const listRes = await get("/api/addresses", token1);
  const addresses = (listRes.json as { data: Array<{ id: string; isDefaultBilling: boolean }> }).data;
  const nonDefaultBilling = addresses.find((a) => !a.isDefaultBilling)!;

  const r = await patch(`/api/addresses/${nonDefaultBilling.id}`, { isDefaultBilling: true }, token1);
  assertEq(r.status, 200, "returns 200");

  const listAfter = await get("/api/addresses", token1);
  const all = (listAfter.json as { data: Array<{ id: string; isDefaultBilling: boolean; isDefaultShipping: boolean }> }).data;
  const billingDefaults = all.filter((a) => a.isDefaultBilling);
  assertEq(billingDefaults.length, 1, "exactly 1 default billing address");

  // Verify shipping defaults not disturbed
  const shippingDefaults = all.filter((a) => a.isDefaultShipping);
  assertEq(shippingDefaults.length, 1, "still exactly 1 default shipping address");
}

async function testOwnershipEnforcement(): Promise<void> {
  console.log("\n  [9] Ownership enforcement");

  const listRes = await get("/api/addresses", token1);
  const addresses = (listRes.json as { data: Array<{ id: string }> }).data;
  const addrId = addresses[0].id;

  const r1 = await patch(`/api/addresses/${addrId}`, { city: "Hacked" }, token2);
  assertEq(r1.status, 403, "PATCH other user's address → 403");

  const r2 = await del(`/api/addresses/${addrId}`, token2);
  assertEq(r2.status, 403, "DELETE other user's address → 403");
}

async function testValidation(): Promise<void> {
  console.log("\n  [10] POST /api/addresses — validation");

  const r1 = await post("/api/addresses", { ...VALID_ADDRESS, pincode: "12345" }, token1);
  assertEq(r1.status, 400, "5-digit pincode → 400");

  const r2 = await post("/api/addresses", { ...VALID_ADDRESS, pincode: "1234567" }, token1);
  assertEq(r2.status, 400, "7-digit pincode → 400");

  const r3 = await post("/api/addresses", { ...VALID_ADDRESS, phone: "123" }, token1);
  assertEq(r3.status, 400, "3-char phone → 400");

  const r4 = await post("/api/addresses", { ...VALID_ADDRESS, fullName: "" }, token1);
  assertEq(r4.status, 400, "empty fullName → 400");

  const r5 = await post("/api/addresses", { ...VALID_ADDRESS, line1: "" }, token1);
  assertEq(r5.status, 400, "empty line1 → 400");
}

async function testSoftDelete(): Promise<void> {
  console.log("\n  [11] DELETE /api/addresses/:id — soft delete");

  const listBefore = await get("/api/addresses", token1);
  const addresses = (listBefore.json as { data: Array<{ id: string }> }).data;
  const addrId = addresses[0].id;

  const r = await del(`/api/addresses/${addrId}`, token1);
  assertEq(r.status, 204, "returns 204");

  // Should not appear in list
  const listAfter = await get("/api/addresses", token1);
  const afterAddrs = (listAfter.json as { data: Array<{ id: string }> }).data;
  assert(!afterAddrs.some((a) => a.id === addrId), "deleted address not in list");

  // But DB row still exists (soft delete)
  const dbRow = await prisma.address.findUnique({ where: { id: addrId }, select: { isActive: true } });
  assert(dbRow !== null, "DB row still exists");
  assert(!dbRow!.isActive, "isActive = false");
}

async function testDeleteNotFound(): Promise<void> {
  console.log("\n  [12] DELETE /api/addresses/:id — 404 for nonexistent");

  const r = await del("/api/addresses/nonexistent-id-xyz", token1);
  assertEq(r.status, 404, "nonexistent address → 404");
}

async function testUpdateNotFound(): Promise<void> {
  console.log("\n  [13] PATCH /api/addresses/:id — 404 for nonexistent");

  const r = await patch("/api/addresses/nonexistent-id-xyz", { city: "Bangalore" }, token1);
  assertEq(r.status, 404, "nonexistent address → 404");
}

async function testDefaultCountry(): Promise<void> {
  console.log("\n  [14] POST /api/addresses — country defaults to India");

  const withoutCountry = { ...VALID_ADDRESS };
  delete (withoutCountry as Record<string, unknown>).country;

  const r = await post("/api/addresses", withoutCountry, token2);
  assertEq(r.status, 201, "returns 201");
  const addr = (r.json as { data: { country: string } }).data;
  assertEq(addr.country, "India", "country defaults to India");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Sprint 4.1 — Address API Tests");
  console.log("=".repeat(60));

  await setupServer();

  try {
    await setup();

    await testAuthEnforcement();
    await testEmptyList();
    await testCreateFirstAddress();
    await testCreateSecondAddressNotAutoDefault();
    await testListAddresses();
    await testUpdateAddress();
    await testSetDefaultShipping();
    await testSetDefaultBillingIndependent();
    await testOwnershipEnforcement();
    await testValidation();
    await testSoftDelete();
    await testDeleteNotFound();
    await testUpdateNotFound();
    await testDefaultCountry();
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
