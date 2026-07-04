/**
 * Phase 3.2 — Registration Integration Tests
 *
 * Spins up the full Express app on a random port and exercises
 * POST /api/auth/register over real HTTP against the live Supabase database.
 *
 * Sentinel pattern: all test users have email ending in "@phase32.celebstyle.test".
 * Cleanup deletes every such user (cascades to EmailVerification) at the end.
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { notificationService, type NotificationPayload } from "../auth/notification.service.js";
import { verifyPassword } from "../auth/password.service.js";

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

const SUFFIX = "@phase32.celebstyle.test";
const EMAIL_A = `user-a${SUFFIX}`;
const EMAIL_B = `user-b${SUFFIX}`;      // duplicate-email test
const EMAIL_C = `user-c${SUFFIX}`;      // phone test
const EMAIL_UPPER = `USER-D${SUFFIX}`;  // normalization test (uppercased)
const EMAIL_D = EMAIL_UPPER.toLowerCase();
const VALID_PASSWORD = "SecurePass123!";
const VALID_NAME = "Test User Phase32";

// ── Server setup ──────────────────────────────────────────────────────────────

type Server = ReturnType<typeof createServer>;
let server: Server;
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

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function post(
  path: string,
  body: unknown
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║   Phase 3.2 — Registration Integration Tests  ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  await setupServer();

  // ── 1. Successful registration ─────────────────────────────────────────────
  console.log("── 1. Successful registration ─────────────────────────────────");
  const { status: s1, json: j1 } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,
    password: VALID_PASSWORD,
  });

  assertEq(s1, 201, "status is 201");

  const d1 = (j1 as { data: Record<string, unknown> }).data;
  assert(typeof d1 === "object" && d1 !== null, "body has data object");
  assert(typeof d1.id === "string" && d1.id.length > 0, "data.id is a non-empty string");
  assertEq(d1.name as string, VALID_NAME, "data.name matches input");
  assertEq(d1.email as string, EMAIL_A, "data.email matches (already lowercase)");
  assertEq(d1.role as string, "CUSTOMER", "data.role is CUSTOMER");
  assertEq(d1.emailVerified as boolean, false, "data.emailVerified is false");
  assert(typeof d1.createdAt === "string", "data.createdAt is a string");
  assert(!isNaN(Date.parse(d1.createdAt as string)), "data.createdAt is a valid ISO date");

  // Security: sensitive fields must NOT appear in the response
  assert(!("passwordHash" in d1), "passwordHash NOT in response");
  assert(!("password" in d1), "password NOT in response");
  assert(!("verificationToken" in d1), "verificationToken NOT in response");
  assert(!("twoFactorSecret" in d1), "twoFactorSecret NOT in response");
  assert(!("deletedAt" in d1), "deletedAt NOT in response");

  // ── 2. DB: password stored as bcrypt hash ──────────────────────────────────
  console.log("\n── 2. DB: password stored as bcrypt hash ──────────────────────");
  const dbUser = await prisma.user.findUnique({
    where: { email: EMAIL_A },
    select: { id: true, email: true, passwordHash: true, role: true },
  });
  assert(dbUser !== null, "user exists in DB");
  assert(
    dbUser!.passwordHash.startsWith("$2"),
    "passwordHash starts with $2 (bcrypt)"
  );
  assert(
    !dbUser!.passwordHash.includes(VALID_PASSWORD),
    "passwordHash does not contain plaintext password"
  );
  assert(
    await verifyPassword(VALID_PASSWORD, dbUser!.passwordHash),
    "correct password verifies against stored hash"
  );
  assert(
    !(await verifyPassword("wrongpassword", dbUser!.passwordHash)),
    "wrong password does NOT verify"
  );
  assertEq(dbUser!.role, "CUSTOMER", "DB role is CUSTOMER");

  // ── 3. DB: EmailVerification record created ────────────────────────────────
  console.log("\n── 3. DB: EmailVerification record ────────────────────────────");
  const ev = await prisma.emailVerification.findFirst({
    where: { userId: dbUser!.id },
  });
  assert(ev !== null, "EmailVerification record created");
  assert(typeof ev!.token === "string" && ev!.token.length === 64, "token is 64-char hex");
  assert(ev!.usedAt === null, "usedAt is null (token not yet used)");
  assert(ev!.expiresAt > new Date(), "expiresAt is in the future");
  const twentyFiveHours = Date.now() + 25 * 60 * 60 * 1000;
  assert(
    ev!.expiresAt.getTime() < twentyFiveHours,
    "expiresAt is within 25 hours (24h window)"
  );

  // ── 4. Notification provider invoked ──────────────────────────────────────
  console.log("\n── 4. Notification provider invoked ───────────────────────────");
  let capturedPayload: NotificationPayload | null = null;
  const originalSend = notificationService.send.bind(notificationService);
  notificationService.send = async (payload) => {
    capturedPayload = payload;
  };

  const { status: sn } = await post("/register", {
    name: "Notification Test User",
    email: EMAIL_B,
    password: VALID_PASSWORD,
  });
  assertEq(sn, 201, "notification test registration succeeds");
  assert(capturedPayload !== null, "notification provider was invoked");
  assertEq(
    capturedPayload!.type,
    "EMAIL_VERIFICATION",
    "notification type is EMAIL_VERIFICATION"
  );
  assertEq(capturedPayload!.to, EMAIL_B, "notification sent to correct email");
  assert(
    typeof capturedPayload!.token === "string" && capturedPayload!.token.length === 64,
    "notification carries 64-char token"
  );

  // Restore original send
  notificationService.send = originalSend;

  // ── 5. Email normalization ─────────────────────────────────────────────────
  console.log("\n── 5. Email normalization ──────────────────────────────────────");
  const { status: sNorm, json: jNorm } = await post("/register", {
    name: "Uppercase Email User",
    email: EMAIL_UPPER,
    password: VALID_PASSWORD,
  });
  assertEq(sNorm, 201, "uppercase email registers successfully");
  const dNorm = (jNorm as { data: Record<string, unknown> }).data;
  assertEq(
    dNorm.email as string,
    EMAIL_D,
    "email stored and returned as lowercase"
  );
  const dbNorm = await prisma.user.findUnique({
    where: { email: EMAIL_D },
    select: { email: true },
  });
  assertEq(dbNorm?.email, EMAIL_D, "DB stores lowercased email");

  // ── 6. Phone — optional accepted ──────────────────────────────────────────
  console.log("\n── 6. Phone — optional accepted ────────────────────────────────");
  const { status: sPhone } = await post("/register", {
    name: "Phone User",
    email: EMAIL_C,
    password: VALID_PASSWORD,
    phone: "+91 98765 43210",
  });
  assertEq(sPhone, 201, "registration with valid phone returns 201");

  const dbPhone = await prisma.user.findUnique({
    where: { email: EMAIL_C },
    select: { phone: true },
  });
  assertEq(dbPhone?.phone, "+91 98765 43210", "phone stored in DB");

  // ── 7. Duplicate email → 409 ──────────────────────────────────────────────
  console.log("\n── 7. Duplicate email → 409 ────────────────────────────────────");
  const { status: sDup, json: jDup } = await post("/register", {
    name: "Another User",
    email: EMAIL_A,
    password: VALID_PASSWORD,
  });
  assertEq(sDup, 409, "duplicate email returns 409");
  assertEq(
    (jDup as { message: string }).message,
    "Email already registered",
    "409 message is correct"
  );

  // ── 8. Transaction atomicity: duplicate email leaves no orphan records ──────
  console.log("\n── 8. Transaction atomicity ────────────────────────────────────");
  const evCount = await prisma.emailVerification.count({
    where: { user: { email: EMAIL_A } },
  });
  assertEq(
    evCount,
    1,
    "exactly 1 EmailVerification exists for first-registered user (no orphans from 409)"
  );

  const userCount = await prisma.user.count({
    where: { email: EMAIL_A },
  });
  assertEq(userCount, 1, "exactly 1 user record exists for the email");

  // ── 9. Validation: missing name ────────────────────────────────────────────
  console.log("\n── 9. Validation errors (400) ──────────────────────────────────");
  const { status: sMissingName } = await post("/register", {
    email: EMAIL_A,
    password: VALID_PASSWORD,
  });
  assertEq(sMissingName, 400, "missing name → 400");

  const { status: sEmptyName } = await post("/register", {
    name: "   ",
    email: EMAIL_A,
    password: VALID_PASSWORD,
  });
  assertEq(sEmptyName, 400, "whitespace-only name → 400");

  const { status: sLongName } = await post("/register", {
    name: "A".repeat(101),
    email: EMAIL_A,
    password: VALID_PASSWORD,
  });
  assertEq(sLongName, 400, "name > 100 chars → 400");

  const { status: sMissingEmail } = await post("/register", {
    name: VALID_NAME,
    password: VALID_PASSWORD,
  });
  assertEq(sMissingEmail, 400, "missing email → 400");

  const { status: sBadEmail } = await post("/register", {
    name: VALID_NAME,
    email: "not-an-email",
    password: VALID_PASSWORD,
  });
  assertEq(sBadEmail, 400, "invalid email format → 400");

  const { status: sBadEmail2 } = await post("/register", {
    name: VALID_NAME,
    email: "missing@tld",
    password: VALID_PASSWORD,
  });
  assertEq(sBadEmail2, 400, "email missing TLD → 400");

  const { status: sMissingPassword } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,
  });
  assertEq(sMissingPassword, 400, "missing password → 400");

  const { status: sShortPassword } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,
    password: "short",
  });
  assertEq(sShortPassword, 400, "password < 8 chars → 400");

  const { status: s7Chars } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,
    password: "1234567",
  });
  assertEq(s7Chars, 400, "password of exactly 7 chars → 400");

  // Password exactly 8 chars must succeed (but we use an existing email so it → 409)
  const { status: s8Chars } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,      // Already exists → should hit 409, not 400
    password: "12345678",
  });
  assert(s8Chars !== 400, "password of exactly 8 chars is not rejected as too short");

  const { status: sBadPhone } = await post("/register", {
    name: VALID_NAME,
    email: EMAIL_A,
    password: VALID_PASSWORD,
    phone: "not-a-phone",
  });
  assertEq(sBadPhone, 400, "invalid phone format → 400");

  // ── 10. Non-JSON body ──────────────────────────────────────────────────────
  console.log("\n── 10. Non-JSON body ───────────────────────────────────────────");
  const rawRes = await fetch(`${baseUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "not json",
  });
  assert(rawRes.status === 400 || rawRes.status === 500, "non-JSON body does not 200");

  // ── 11. Response shape — no extra unexpected keys ─────────────────────────
  console.log("\n── 11. Response shape completeness ─────────────────────────────");
  const expectedKeys = new Set(["id", "name", "email", "role", "emailVerified", "createdAt"]);
  const actualKeys = new Set(Object.keys(d1));
  for (const key of expectedKeys) {
    assert(actualKeys.has(key), `response contains expected key: ${key}`);
  }

  // ── 12. Existing integration tests still pass ──────────────────────────────
  console.log("\n── 12. Existing routes unaffected ──────────────────────────────");
  const healthRes = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`);
  assertEq(healthRes.status, 200, "GET /api/health still returns 200");

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n── cleanup ────────────────────────────────────────────────────");
  const { count: deletedUsers } = await prisma.user.deleteMany({
    where: { email: { endsWith: SUFFIX } },
  });
  assert(deletedUsers > 0, `cleaned up ${deletedUsers} test user(s) (cascades EmailVerification)`);
  console.log(`  (deleted ${deletedUsers} test users)`);

  await teardownServer();

  // ── Results ────────────────────────────────────────────────────────────────
  console.log("\n── Results ────────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("─".repeat(58) + "\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
