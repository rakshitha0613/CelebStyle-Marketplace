/**
 * Phase 3.3 — Login, Refresh, and Logout Integration Tests
 *
 * Spins up the full Express app on a random port.
 * Exercises POST /api/auth/login, /refresh, and /logout over real HTTP
 * against live Supabase, with direct Prisma queries for internal-state checks.
 *
 * Sentinel: all test users have email ending "@phase33.celebstyle.test".
 * Cleanup cascades Session + EmailVerification via User onDelete: Cascade.
 *
 * Run with: npm run test:login  (uses --env-file=.env for JWT_SECRET)
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../auth/password.service.js";
import { verifyAccessToken } from "../auth/token.service.js";
import { REFRESH_COOKIE_NAME } from "../auth/cookie.js";

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

// ── Sentinel values ───────────────────────────────────────────────────────────

const SUFFIX = "@phase33.celebstyle.test";
const EMAIL_ACTIVE = `active${SUFFIX}`;
const EMAIL_INACTIVE = `inactive${SUFFIX}`;
const EMAIL_DELETED = `deleted${SUFFIX}`;
const VALID_PASSWORD = "SecurePass123!";
const VALID_NAME = "Phase33 Test User";

// ── Server setup ──────────────────────────────────────────────────────────────

type HttpServer = ReturnType<typeof createServer>;
let server: HttpServer;
let baseUrl: string;

async function setupServer(): Promise<void> {
  const app = createApp();
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}/api/auth`;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface PostResult {
  status: number;
  json: unknown;
  setCookie: string | null;
  headers: Headers;
}

async function post(
  path: string,
  body: unknown = {},
  cookie?: string
): Promise<PostResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, setCookie, headers: res.headers };
}

function extractCookieValue(setCookieHeader: string | null): string | undefined {
  if (!setCookieHeader) return undefined;
  const match = setCookieHeader.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

function cookieHeader(value: string): string {
  return `${REFRESH_COOKIE_NAME}=${value}`;
}

// ── Test setup ────────────────────────────────────────────────────────────────

let activeUserId: string;

async function setupTestUsers(): Promise<void> {
  // Active user: registered via HTTP so we test the full E2E flow.
  const { json } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_ACTIVE,
    password: VALID_PASSWORD,
  });
  activeUserId = (json as { data: { id: string } }).data.id;

  // Inactive and soft-deleted users created directly via Prisma (faster setup,
  // tests only the login logic — not the registration path).
  await prisma.user.createMany({
    data: [
      {
        email: EMAIL_INACTIVE,
        passwordHash: await hashPassword(VALID_PASSWORD),
        name: "Inactive User",
        role: "CUSTOMER",
        isActive: false,
      },
      {
        email: EMAIL_DELETED,
        passwordHash: await hashPassword(VALID_PASSWORD),
        name: "Deleted User",
        role: "CUSTOMER",
        deletedAt: new Date(Date.now() - 1000),
      },
    ],
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   Phase 3.3 — Login & Token Management Tests         ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  await setupServer();
  await setupTestUsers();

  // ── 1. Login success ───────────────────────────────────────────────────────
  console.log("── 1. Login success ────────────────────────────────────────────");
  const { status: s1, json: j1, setCookie: c1 } = await post("/login", {
    email: EMAIL_ACTIVE,
    password: VALID_PASSWORD,
  });

  assertEq(s1, 200, "status is 200");

  const d1 = (j1 as { data: { accessToken: string; user: Record<string, unknown> } }).data;
  assert(typeof d1.accessToken === "string" && d1.accessToken.split(".").length === 3, "accessToken is a 3-part JWT");
  assert(d1.user !== null && typeof d1.user === "object", "user object present");

  const u1 = d1.user;
  assertEq(u1.id as string, activeUserId, "user.id matches registered id");
  assertEq(u1.name as string, VALID_NAME, "user.name correct");
  assertEq(u1.email as string, EMAIL_ACTIVE, "user.email correct (lowercase)");
  assertEq(u1.role as string, "CUSTOMER", "user.role is CUSTOMER");
  assertEq(u1.emailVerified as boolean, false, "user.emailVerified is false");

  // Sensitive fields must NOT appear
  assert(!("passwordHash" in d1), "passwordHash NOT in response");
  assert(!("password" in d1), "password NOT in response");
  assert(!("refreshToken" in d1), "raw refreshToken NOT in response");

  // ── 2. Cookie verification ─────────────────────────────────────────────────
  console.log("\n── 2. Cookie security ──────────────────────────────────────────");
  assert(c1 !== null, "Set-Cookie header present");
  assert(!!c1?.includes("refresh_token="), "cookie name is refresh_token");
  assert(!!c1?.toLowerCase().includes("httponly"), "cookie has HttpOnly flag");
  assert(!!c1?.toLowerCase().includes("samesite=strict"), "cookie has SameSite=Strict");
  assert(!!c1?.includes("/api/auth/refresh"), "cookie path is /api/auth/refresh");

  const rawCookieA = extractCookieValue(c1);
  assert(typeof rawCookieA === "string" && rawCookieA!.length > 0, "cookie value is non-empty");

  // ── 3. JWT claims validation ───────────────────────────────────────────────
  console.log("\n── 3. JWT claims ───────────────────────────────────────────────");
  const claims = await verifyAccessToken(d1.accessToken);
  assertEq(claims.sub, activeUserId, "JWT sub = user id");
  assertEq(claims.email, EMAIL_ACTIVE, "JWT email = user email");
  assertEq(claims.role, "CUSTOMER", "JWT role = CUSTOMER");
  assertEq(claims.emailVerified, false, "JWT emailVerified = false");

  // ── 4. DB: session created with hashed token ───────────────────────────────
  console.log("\n── 4. DB: session state ────────────────────────────────────────");
  const session = await prisma.session.findFirst({
    where: { userId: activeUserId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  assert(session !== null, "session created in DB");
  assert(session!.refreshToken.length === 64, "stored token is 64-char SHA-256 hash");
  assert(session!.refreshToken !== rawCookieA, "stored value is hash, not raw cookie");
  assert(session!.revokedAt === null, "session is not revoked");
  assert(session!.expiresAt > new Date(), "session expires in the future");
  const thirtyOneDays = Date.now() + 31 * 24 * 60 * 60 * 1000;
  assert(session!.expiresAt.getTime() < thirtyOneDays, "session expires within 31 days");

  // ── 5. DB: lastLoginAt updated ─────────────────────────────────────────────
  console.log("\n── 5. lastLoginAt updated ──────────────────────────────────────");
  const dbUser = await prisma.user.findUnique({
    where: { id: activeUserId },
    select: { lastLoginAt: true },
  });
  assert(dbUser?.lastLoginAt !== null, "lastLoginAt is set after login");
  const loginTime = dbUser!.lastLoginAt!.getTime();
  assert(
    Date.now() - loginTime < 10_000,
    "lastLoginAt is within the last 10 seconds"
  );

  // ── 6. Wrong credentials ───────────────────────────────────────────────────
  console.log("\n── 6. Wrong credentials ────────────────────────────────────────");
  const { status: sWrong, json: jWrong } = await post("/login", {
    email: EMAIL_ACTIVE,
    password: "wrongpassword",
  });
  assertEq(sWrong, 401, "wrong password → 401");
  assertEq(
    (jWrong as { message: string }).message,
    "Invalid email or password",
    "wrong password: generic message (no enumeration)"
  );

  const { status: sUnknown, json: jUnknown } = await post("/login", {
    email: "no-such-user@phase33.celebstyle.test",
    password: VALID_PASSWORD,
  });
  assertEq(sUnknown, 401, "unknown email → 401");
  assertEq(
    (jUnknown as { message: string }).message,
    "Invalid email or password",
    "unknown email: SAME message as wrong password (no enumeration)"
  );

  // ── 7. Account status guards ───────────────────────────────────────────────
  console.log("\n── 7. Account status guards ────────────────────────────────────");
  const { status: sInactive } = await post("/login", {
    email: EMAIL_INACTIVE,
    password: VALID_PASSWORD,
  });
  assertEq(sInactive, 401, "inactive account → 401");

  const { status: sDeleted } = await post("/login", {
    email: EMAIL_DELETED,
    password: VALID_PASSWORD,
  });
  assertEq(sDeleted, 401, "soft-deleted account → 401");

  // ── 8. Login validation ────────────────────────────────────────────────────
  console.log("\n── 8. Login validation ─────────────────────────────────────────");
  assertEq((await post("/login", { password: VALID_PASSWORD })).status, 400, "missing email → 400");
  assertEq((await post("/login", { email: "", password: VALID_PASSWORD })).status, 400, "empty email → 400");
  assertEq((await post("/login", { email: EMAIL_ACTIVE })).status, 400, "missing password → 400");
  assertEq((await post("/login", { email: EMAIL_ACTIVE, password: "" })).status, 400, "empty password → 400");

  // ── 9. Refresh success ─────────────────────────────────────────────────────
  console.log("\n── 9. Refresh — success and rotation ───────────────────────────");

  // Get a fresh session for the rotation tests.
  const { setCookie: cFresh } = await post("/login", {
    email: EMAIL_ACTIVE,
    password: VALID_PASSWORD,
  });
  const rawTokenBefore = extractCookieValue(cFresh)!;

  const { status: sRef, json: jRef, setCookie: cRef } = await post(
    "/refresh",
    {},
    cookieHeader(rawTokenBefore)
  );
  assertEq(sRef, 200, "refresh returns 200");
  const refData = (jRef as { data: { accessToken: string } }).data;
  assert(
    typeof refData.accessToken === "string" && refData.accessToken.split(".").length === 3,
    "refresh returns a valid JWT access token"
  );
  assert(cRef !== null, "refresh sets a new cookie");
  const rawTokenAfter = extractCookieValue(cRef);
  assert(typeof rawTokenAfter === "string", "new refresh token is a string");
  assert(rawTokenAfter !== rawTokenBefore, "new refresh token differs from old (rotation)");

  // ── 10. DB: old session revoked, new session created ──────────────────────
  console.log("\n── 10. DB: rotation state ──────────────────────────────────────");
  const { createHash } = await import("node:crypto");
  const oldHash = createHash("sha256").update(rawTokenBefore).digest("hex");
  const newHash = createHash("sha256").update(rawTokenAfter!).digest("hex");

  const oldSession = await prisma.session.findUnique({ where: { refreshToken: oldHash } });
  assert(oldSession !== null, "old session still in DB (for reuse detection)");
  assert(oldSession!.revokedAt !== null, "old session is revoked (revokedAt set)");

  const newSession = await prisma.session.findUnique({ where: { refreshToken: newHash } });
  assert(newSession !== null, "new session created in DB");
  assert(newSession!.revokedAt === null, "new session is active");

  // ── 11. Old cookie rejected after rotation ─────────────────────────────────
  console.log("\n── 11. Old cookie rejected after rotation ──────────────────────");
  const { status: sOld } = await post("/refresh", {}, cookieHeader(rawTokenBefore));
  assertEq(sOld, 401, "old (rotated) cookie → 401");

  // ── 12. Reuse detection — all sessions nuked ───────────────────────────────
  console.log("\n── 12. Reuse detection ─────────────────────────────────────────");
  // Presenting the old (revoked) token triggers reuse detection and revokes ALL
  // active sessions. The new token (rawTokenAfter) should now also be rejected.
  const { status: sReuse } = await post("/refresh", {}, cookieHeader(rawTokenBefore));
  assertEq(sReuse, 401, "reuse attempt: old revoked token → 401");

  const { status: sNuked } = await post("/refresh", {}, cookieHeader(rawTokenAfter!));
  assertEq(sNuked, 401, "after reuse detection: all sessions nuked — new token also rejected");

  // DB: confirm the new session was also revoked in the nuclear response.
  const nukedSession = await prisma.session.findUnique({ where: { refreshToken: newHash } });
  assert(nukedSession!.revokedAt !== null, "DB confirms: new session revoked during nuclear cleanup");

  // ── 13. Expired refresh token ──────────────────────────────────────────────
  console.log("\n── 13. Expired refresh token ───────────────────────────────────");
  const { setCookie: cExp } = await post("/login", {
    email: EMAIL_ACTIVE,
    password: VALID_PASSWORD,
  });
  const rawExpToken = extractCookieValue(cExp)!;
  const expHash = createHash("sha256").update(rawExpToken).digest("hex");

  // Artificially expire the session.
  await prisma.session.update({
    where: { refreshToken: expHash },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const { status: sExp } = await post("/refresh", {}, cookieHeader(rawExpToken));
  assertEq(sExp, 401, "expired session → 401");

  // ── 14. Refresh without cookie ─────────────────────────────────────────────
  console.log("\n── 14. Refresh without cookie ──────────────────────────────────");
  const { status: sNoCookie } = await post("/refresh", {});
  assertEq(sNoCookie, 401, "refresh without cookie → 401");

  // ── 15. Logout success ─────────────────────────────────────────────────────
  console.log("\n── 15. Logout ──────────────────────────────────────────────────");
  const { setCookie: cLogout } = await post("/login", {
    email: EMAIL_ACTIVE,
    password: VALID_PASSWORD,
  });
  const rawLogoutToken = extractCookieValue(cLogout)!;
  const logoutHash = createHash("sha256").update(rawLogoutToken).digest("hex");

  const { status: sLogout, json: jLogout, setCookie: cAfterLogout } = await post(
    "/logout",
    {},
    cookieHeader(rawLogoutToken)
  );
  assertEq(sLogout, 200, "logout returns 200");
  assertEq((jLogout as { data: { ok: boolean } }).data.ok, true, "logout body: ok = true");
  assert(cAfterLogout !== null, "logout sets Set-Cookie header");
  // A cleared cookie has Max-Age=0 or Expires in the past and empty value.
  assert(
    cAfterLogout!.includes("refresh_token=;") ||
      cAfterLogout!.includes("Max-Age=0") ||
      cAfterLogout!.includes("Expires="),
    "Set-Cookie clears the refresh_token"
  );

  // DB: session is revoked
  const logoutSession = await prisma.session.findUnique({ where: { refreshToken: logoutHash } });
  assert(logoutSession !== null, "session still in DB after logout");
  assert(logoutSession!.revokedAt !== null, "session.revokedAt set after logout");

  // Refresh after logout → 401
  const { status: sPostLogout } = await post("/refresh", {}, cookieHeader(rawLogoutToken));
  assertEq(sPostLogout, 401, "refresh after logout → 401");

  // ── 16. Logout idempotency ─────────────────────────────────────────────────
  console.log("\n── 16. Logout idempotency ──────────────────────────────────────");
  const { status: sLogout2 } = await post("/logout", {}, cookieHeader(rawLogoutToken));
  assertEq(sLogout2, 200, "second logout → still 200 (idempotent)");

  const { status: sLogoutNoCookie } = await post("/logout", {});
  assertEq(sLogoutNoCookie, 200, "logout without cookie → 200 (idempotent)");

  // ── 17. Email case normalization on login ──────────────────────────────────
  console.log("\n── 17. Email normalization on login ────────────────────────────");
  const { status: sUpper } = await post("/login", {
    email: EMAIL_ACTIVE.toUpperCase(),
    password: VALID_PASSWORD,
  });
  assertEq(sUpper, 200, "login with uppercase email succeeds");

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n── cleanup ─────────────────────────────────────────────────────");
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: SUFFIX } },
  });
  assert(count >= 3, `cleaned up ${count} test users (cascades sessions)`);
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
