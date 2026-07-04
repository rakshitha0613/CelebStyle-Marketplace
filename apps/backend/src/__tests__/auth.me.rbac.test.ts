/**
 * Phase 3.6 — GET /api/auth/me and RBAC Middleware Tests
 *
 * 3.6A: GET /api/auth/me — returns the authenticated user profile.
 * 3.6B: authenticate + authorize middleware — role-based access control.
 *
 * RBAC is tested through temporary routes mounted on the Express app BEFORE the
 * server starts. This exercises the full middleware stack without touching any
 * production business routes.
 *
 * All test accounts use the "@phase36.celebstyle.test" sentinel.
 *
 * Run: npm run test:me-rbac
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT } from "jose";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";
import { TOKEN_ISSUER, TOKEN_AUDIENCE } from "../auth/token.service.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { config } from "../env.js";

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

const SUFFIX = "@phase36.celebstyle.test";
const TEST_PASSWORD = "TestPass36!";

// ── Server ────────────────────────────────────────────────────────────────────

type HttpServer = ReturnType<typeof createServer>;
let server: HttpServer;
let port: number;
let baseAuthUrl: string;

async function setupServer(): Promise<void> {
  const app = createApp();

  // ── RBAC test routes — mounted before server starts ───────────────────────
  // These routes are only used by this test file and never in production.

  app.get(
    "/api/test/customer-only",
    authenticate,
    authorize("CUSTOMER"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/celebrity-only",
    authenticate,
    authorize("CELEBRITY"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/manufacturer-only",
    authenticate,
    authorize("MANUFACTURER_PARTNER"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/admin-only",
    authenticate,
    authorize("ADMIN"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/super-admin-only",
    authenticate,
    authorize("SUPER_ADMIN"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/admin-or-super",
    authenticate,
    authorize("ADMIN", "SUPER_ADMIN"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  app.get(
    "/api/test/customer-or-celebrity",
    authenticate,
    authorize("CUSTOMER", "CELEBRITY"),
    (_req, res) => { res.json({ data: { ok: true } }); }
  );

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  baseAuthUrl = `http://127.0.0.1:${port}/api/auth`;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

interface Result {
  status: number;
  json: unknown;
}

async function get(path: string, token?: string): Promise<Result> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function post(path: string, body: unknown = {}): Promise<Result & { setCookie: string | null }> {
  const res = await fetch(`${baseAuthUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

// ── Token factory ─────────────────────────────────────────────────────────────

const jwtSecret = new TextEncoder().encode(config.jwtSecret);

async function makeExpiredToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email, role: "CUSTOMER", emailVerified: false })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now - 3600)
    .setExpirationTime(now - 1800) // expired 30 minutes ago
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(jwtSecret);
}

async function makeTokenWithoutIssuer(userId: string, email: string): Promise<string> {
  return new SignJWT({ email, role: "CUSTOMER", emailVerified: false })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    // No issuer or audience — should be rejected by verifyAccessToken
    .sign(jwtSecret);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

type TokenMap = {
  customer: string;
  celebrity: string;
  manufacturer: string;
  admin: string;
  superAdmin: string;
};

let tokens: TokenMap;
let customerUserId: string;
let inactiveUserId: string;
let deletedUserId: string;

async function setupUsers(): Promise<void> {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  // Register the CUSTOMER via HTTP (full E2E path).
  const { json: regJ } = await post("/register", {
    name: "Me Route User",
    email: `customer${SUFFIX}`,
    password: TEST_PASSWORD,
  });
  customerUserId = (regJ as { data: { id: string } }).data.id;

  // Non-CUSTOMER roles must be created directly via Prisma (register only creates CUSTOMER).
  await prisma.user.createMany({
    data: [
      { email: `celebrity${SUFFIX}`, passwordHash, name: "Celebrity User", role: "CELEBRITY" },
      { email: `manufacturer${SUFFIX}`, passwordHash, name: "Manufacturer User", role: "MANUFACTURER_PARTNER" },
      { email: `admin${SUFFIX}`, passwordHash, name: "Admin User", role: "ADMIN" },
      { email: `superadmin${SUFFIX}`, passwordHash, name: "Super Admin", role: "SUPER_ADMIN" },
    ],
  });

  // Inactive and soft-deleted users for /me rejection tests.
  await prisma.user.createMany({
    data: [
      { email: `inactive${SUFFIX}`, passwordHash, name: "Inactive", role: "CUSTOMER", isActive: false },
      { email: `deleted${SUFFIX}`, passwordHash, name: "Deleted", role: "CUSTOMER", deletedAt: new Date() },
    ],
  });

  const [inactiveUser, deletedUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: `inactive${SUFFIX}` }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: `deleted${SUFFIX}` }, select: { id: true } }),
  ]);
  inactiveUserId = inactiveUser!.id;
  deletedUserId = deletedUser!.id;

  // Login each active user to obtain real access tokens.
  const loginResults = await Promise.all([
    post("/login", { email: `customer${SUFFIX}`, password: TEST_PASSWORD }),
    post("/login", { email: `celebrity${SUFFIX}`, password: TEST_PASSWORD }),
    post("/login", { email: `manufacturer${SUFFIX}`, password: TEST_PASSWORD }),
    post("/login", { email: `admin${SUFFIX}`, password: TEST_PASSWORD }),
    post("/login", { email: `superadmin${SUFFIX}`, password: TEST_PASSWORD }),
  ]);

  tokens = {
    customer: (loginResults[0].json as { data: { accessToken: string } }).data.accessToken,
    celebrity: (loginResults[1].json as { data: { accessToken: string } }).data.accessToken,
    manufacturer: (loginResults[2].json as { data: { accessToken: string } }).data.accessToken,
    admin: (loginResults[3].json as { data: { accessToken: string } }).data.accessToken,
    superAdmin: (loginResults[4].json as { data: { accessToken: string } }).data.accessToken,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   Phase 3.6 — GET /me and RBAC Tests                 ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
  await setupServer();
  await setupUsers();

  // ── 1. GET /me — success ──────────────────────────────────────────────────
  console.log("── 1. GET /me — success ────────────────────────────────────────");

  const { status: sMe, json: jMe } = await get("/api/auth/me", tokens.customer);
  assertEq(sMe, 200, "GET /me returns 200");

  const me = (jMe as { data: Record<string, unknown> }).data;
  assertEq(me.id as string, customerUserId, "data.id matches registered user");
  assertEq(me.name as string, "Me Route User", "data.name correct");
  assertEq(me.email as string, `customer${SUFFIX}`, "data.email correct (lowercase)");
  assertEq(me.role as string, "CUSTOMER", "data.role is CUSTOMER");
  assertEq(me.emailVerified as boolean, false, "data.emailVerified is false");
  assertEq(me.phoneVerified as boolean, false, "data.phoneVerified is false");
  assert(me.avatar === null || typeof me.avatar === "string", "data.avatar is null or string");
  assert(typeof me.createdAt === "string", "data.createdAt is an ISO string");
  assert(!isNaN(Date.parse(me.createdAt as string)), "data.createdAt parses as a valid date");

  // ── 2. Sensitive fields absent from /me ───────────────────────────────────
  console.log("\n── 2. Sensitive fields absent from /me ─────────────────────────");

  assert(!("passwordHash" in me), "passwordHash NOT in /me response");
  assert(!("password" in me), "password NOT in /me response");
  assert(!("twoFactorSecret" in me), "twoFactorSecret NOT in /me response");
  assert(!("deletedAt" in me), "deletedAt NOT in /me response");
  assert(!("isActive" in me), "isActive NOT in /me response");

  // ── 3. GET /me — missing Authorization header ─────────────────────────────
  console.log("\n── 3. GET /me — missing Authorization header ───────────────────");

  assertEq((await get("/api/auth/me")).status, 401, "no Authorization header → 401");

  // ── 4. GET /me — invalid token ────────────────────────────────────────────
  console.log("\n── 4. GET /me — invalid token ──────────────────────────────────");

  assertEq((await get("/api/auth/me", "not.a.jwt")).status, 401, "garbage token → 401");
  assertEq(
    (await get("/api/auth/me", "Bearer ")).status,
    401,
    "empty Bearer value → 401"
  );

  // ── 5. GET /me — expired token ────────────────────────────────────────────
  console.log("\n── 5. GET /me — expired token ──────────────────────────────────");

  const expiredToken = await makeExpiredToken(customerUserId, `customer${SUFFIX}`);
  assertEq((await get("/api/auth/me", expiredToken)).status, 401, "expired token → 401");

  // ── 6. GET /me — token without iss/aud ───────────────────────────────────
  console.log("\n── 6. GET /me — token without issuer/audience ──────────────────");

  const noIssuerToken = await makeTokenWithoutIssuer(customerUserId, `customer${SUFFIX}`);
  assertEq(
    (await get("/api/auth/me", noIssuerToken)).status,
    401,
    "token missing iss/aud → 401"
  );

  // ── 7. GET /me — inactive account ────────────────────────────────────────
  console.log("\n── 7. GET /me — inactive account ───────────────────────────────");

  // Sign a valid-format token for the inactive user's id — middleware will
  // perform the live DB check and detect isActive=false.
  const inactiveToken = await new SignJWT({
    email: `inactive${SUFFIX}`,
    role: "CUSTOMER",
    emailVerified: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(inactiveUserId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(jwtSecret);

  assertEq(
    (await get("/api/auth/me", inactiveToken)).status,
    401,
    "inactive account → 401"
  );

  // ── 8. GET /me — soft-deleted account ────────────────────────────────────
  console.log("\n── 8. GET /me — soft-deleted account ───────────────────────────");

  const deletedToken = await new SignJWT({
    email: `deleted${SUFFIX}`,
    role: "CUSTOMER",
    emailVerified: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(deletedUserId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(jwtSecret);

  assertEq(
    (await get("/api/auth/me", deletedToken)).status,
    401,
    "soft-deleted account → 401"
  );

  // ── 9. GET /me — token for non-existent user ─────────────────────────────
  console.log("\n── 9. GET /me — non-existent user id ───────────────────────────");

  const ghostToken = await new SignJWT({
    email: "ghost@example.com",
    role: "CUSTOMER",
    emailVerified: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("cuid-that-does-not-exist-00000000")
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(jwtSecret);

  assertEq(
    (await get("/api/auth/me", ghostToken)).status,
    401,
    "non-existent user id → 401"
  );

  // ── 10. RBAC — CUSTOMER role ──────────────────────────────────────────────
  console.log("\n── 10. RBAC — CUSTOMER role ────────────────────────────────────");

  assertEq(
    (await get("/api/test/customer-only", tokens.customer)).status,
    200,
    "CUSTOMER accessing customer-only → 200"
  );
  assertEq(
    (await get("/api/test/admin-only", tokens.customer)).status,
    403,
    "CUSTOMER accessing admin-only → 403"
  );
  assertEq(
    (await get("/api/test/super-admin-only", tokens.customer)).status,
    403,
    "CUSTOMER accessing super-admin-only → 403"
  );
  assertEq(
    (await get("/api/test/customer-or-celebrity", tokens.customer)).status,
    200,
    "CUSTOMER accessing customer-or-celebrity → 200"
  );

  // ── 11. RBAC — CELEBRITY role ─────────────────────────────────────────────
  console.log("\n── 11. RBAC — CELEBRITY role ───────────────────────────────────");

  assertEq(
    (await get("/api/test/celebrity-only", tokens.celebrity)).status,
    200,
    "CELEBRITY accessing celebrity-only → 200"
  );
  assertEq(
    (await get("/api/test/customer-only", tokens.celebrity)).status,
    403,
    "CELEBRITY accessing customer-only → 403"
  );
  assertEq(
    (await get("/api/test/customer-or-celebrity", tokens.celebrity)).status,
    200,
    "CELEBRITY accessing customer-or-celebrity → 200"
  );

  // ── 12. RBAC — MANUFACTURER_PARTNER role ─────────────────────────────────
  console.log("\n── 12. RBAC — MANUFACTURER_PARTNER role ────────────────────────");

  assertEq(
    (await get("/api/test/manufacturer-only", tokens.manufacturer)).status,
    200,
    "MANUFACTURER_PARTNER accessing manufacturer-only → 200"
  );
  assertEq(
    (await get("/api/test/admin-only", tokens.manufacturer)).status,
    403,
    "MANUFACTURER_PARTNER accessing admin-only → 403"
  );

  // ── 13. RBAC — ADMIN role ─────────────────────────────────────────────────
  console.log("\n── 13. RBAC — ADMIN role ───────────────────────────────────────");

  assertEq(
    (await get("/api/test/admin-only", tokens.admin)).status,
    200,
    "ADMIN accessing admin-only → 200"
  );
  assertEq(
    (await get("/api/test/admin-or-super", tokens.admin)).status,
    200,
    "ADMIN accessing admin-or-super → 200"
  );
  assertEq(
    (await get("/api/test/customer-only", tokens.admin)).status,
    403,
    "ADMIN accessing customer-only → 403"
  );
  assertEq(
    (await get("/api/test/super-admin-only", tokens.admin)).status,
    403,
    "ADMIN cannot access super-admin-only → 403"
  );

  // ── 14. RBAC — SUPER_ADMIN role ──────────────────────────────────────────
  console.log("\n── 14. RBAC — SUPER_ADMIN role ─────────────────────────────────");

  assertEq(
    (await get("/api/test/super-admin-only", tokens.superAdmin)).status,
    200,
    "SUPER_ADMIN accessing super-admin-only → 200"
  );
  assertEq(
    (await get("/api/test/admin-or-super", tokens.superAdmin)).status,
    200,
    "SUPER_ADMIN accessing admin-or-super → 200"
  );
  assertEq(
    (await get("/api/test/admin-only", tokens.superAdmin)).status,
    403,
    "SUPER_ADMIN cannot access admin-only (different role) → 403"
  );

  // ── 15. RBAC — no auth on protected route ────────────────────────────────
  console.log("\n── 15. RBAC — unauthenticated on protected route ───────────────");

  assertEq(
    (await get("/api/test/admin-only")).status,
    401,
    "no token on admin-only → 401"
  );
  assertEq(
    (await get("/api/test/customer-only")).status,
    401,
    "no token on customer-only → 401"
  );

  // ── 16. RBAC — 403 response shape ────────────────────────────────────────
  console.log("\n── 16. RBAC — error response shapes ────────────────────────────");

  const { json: j403 } = await get("/api/test/admin-only", tokens.customer);
  assertEq((j403 as { message: string }).message, "Forbidden", "403 body has message: Forbidden");

  const { json: j401 } = await get("/api/test/admin-only");
  assertEq((j401 as { message: string }).message, "Unauthorized", "401 body has message: Unauthorized");

  // ── 17. GET /me with each role — role field correct ───────────────────────
  console.log("\n── 17. GET /me — role field for each user type ─────────────────");

  const meAdmin = (await get("/api/auth/me", tokens.admin)).json as { data: { role: string } };
  assertEq(meAdmin.data.role, "ADMIN", "ADMIN user: /me returns role=ADMIN");

  const meSuperAdmin = (await get("/api/auth/me", tokens.superAdmin)).json as { data: { role: string } };
  assertEq(meSuperAdmin.data.role, "SUPER_ADMIN", "SUPER_ADMIN user: /me returns role=SUPER_ADMIN");

  const meCelebrity = (await get("/api/auth/me", tokens.celebrity)).json as { data: { role: string } };
  assertEq(meCelebrity.data.role, "CELEBRITY", "CELEBRITY user: /me returns role=CELEBRITY");

  const meManufacturer = (await get("/api/auth/me", tokens.manufacturer)).json as { data: { role: string } };
  assertEq(meManufacturer.data.role, "MANUFACTURER_PARTNER", "MANUFACTURER_PARTNER user: /me returns correct role");

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n── cleanup ─────────────────────────────────────────────────────");
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: SUFFIX } },
  });
  assert(count >= 7, `cleaned up ${count} test users (cascades Session records)`);
  console.log(`  (deleted ${count} test users)`);

  await teardownServer();

  // ── Results ────────────────────────────────────────────────────────────────
  console.log("\n── Results ─────────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("─".repeat(58) + "\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
