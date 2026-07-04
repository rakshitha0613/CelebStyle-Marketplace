/**
 * Phase 3.5 — Password Reset Integration Tests
 *
 * Covers:
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *
 * All test accounts use the "@phase35.celebstyle.test" sentinel.
 * Cleanup cascades Session + PasswordReset records via User onDelete: Cascade.
 *
 * Run: npm run test:password-reset
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../auth/password.service.js";
import { notificationService } from "../auth/notification.service.js";
import type { NotificationPayload } from "../auth/notification.service.js";

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

const SUFFIX = "@phase35.celebstyle.test";
const ORIGINAL_PASSWORD = "OriginalPass35!";
const NEW_PASSWORD = "NewSecurePass35!";

// ── Server ────────────────────────────────────────────────────────────────────

type HttpServer = ReturnType<typeof createServer>;
let server: HttpServer;
let baseUrl: string;
let port: number;

async function setupServer(): Promise<void> {
  const app = createApp();
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}/api/auth`;
}

async function teardownServer(): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

interface PostResult {
  status: number;
  json: unknown;
  setCookie: string | null;
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
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

function extractCookieValue(setCookieHeader: string | null): string | undefined {
  if (!setCookieHeader) return undefined;
  const match = setCookieHeader.match(/refresh_token=([^;]+)/);
  return match?.[1];
}

// ── Notification spy ──────────────────────────────────────────────────────────

let capturedPayloads: NotificationPayload[] = [];
const originalSend = notificationService.send.bind(notificationService);

function installSpy(): void {
  capturedPayloads = [];
  notificationService.send = async (payload) => {
    capturedPayloads.push(payload);
  };
}

function removeSpy(): void {
  notificationService.send = originalSend;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getLatestResetToken(userId: string): Promise<string> {
  const pr = await prisma.passwordReset.findFirst({
    where: { userId, revokedAt: null, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (!pr) throw new Error(`No active reset token for user ${userId}`);
  return pr.token;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   Phase 3.5 — Password Reset Tests                   ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  // Pre-cleanup: remove leftover accounts from any previous failed run.
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });

  await setupServer();
  installSpy();

  // ── 1. Forgot password — unknown email (no leak) ──────────────────────────
  console.log("── 1. Forgot password — unknown email ──────────────────────────");

  capturedPayloads = [];
  const { status: sUnknown, json: jUnknown } = await post("/forgot-password", {
    email: `no-such${SUFFIX}`,
  });
  assertEq(sUnknown, 200, "unknown email → 200 (no leak)");
  assertEq(
    (jUnknown as { data: { message: string } }).data.message,
    "If the account exists, a password reset link has been sent.",
    "unknown email: canonical success message"
  );
  assertEq(capturedPayloads.length, 0, "no notification dispatched for unknown email");

  // ── 2. Forgot password — known email ─────────────────────────────────────
  console.log("\n── 2. Forgot password — known email ────────────────────────────");

  const emailMain = `user-main${SUFFIX}`;
  capturedPayloads = [];
  const { json: regJ } = await post("/register", {
    name: "Reset User",
    email: emailMain,
    password: ORIGINAL_PASSWORD,
  });
  const mainUserId = (regJ as { data: { id: string } }).data.id;
  capturedPayloads = []; // ignore registration notification

  const { status: sForgot, json: jForgot } = await post("/forgot-password", {
    email: emailMain,
  });
  assertEq(sForgot, 200, "known email → 200");
  assertEq(
    (jForgot as { data: { message: string } }).data.message,
    "If the account exists, a password reset link has been sent.",
    "known email: identical message to unknown email (no oracle)"
  );
  assertEq(capturedPayloads.length, 1, "one notification dispatched for known email");
  assertEq(capturedPayloads[0]?.type, "PASSWORD_RESET", "notification type is PASSWORD_RESET");
  assertEq(capturedPayloads[0]?.to, emailMain, "notification sent to correct address");

  const resetToken = await getLatestResetToken(mainUserId);
  assertEq(capturedPayloads[0]?.token, resetToken, "notification carries the DB token");
  assert(resetToken.length === 64, "reset token is 64-char hex");

  // ── 3. Reset password — success ───────────────────────────────────────────
  console.log("\n── 3. Reset password — success ─────────────────────────────────");

  const { status: sReset, json: jReset } = await post("/reset-password", {
    token: resetToken,
    password: NEW_PASSWORD,
  });
  assertEq(sReset, 200, "reset-password returns 200");
  assert(
    typeof (jReset as { data: { message: string } }).data.message === "string",
    "response has data.message"
  );

  // ── 4. DB state after reset ───────────────────────────────────────────────
  console.log("\n── 4. DB state after reset ─────────────────────────────────────");

  const dbUser = await prisma.user.findUnique({
    where: { id: mainUserId },
    select: { passwordHash: true, passwordChangedAt: true },
  });
  assert(
    await verifyPassword(NEW_PASSWORD, dbUser!.passwordHash),
    "DB passwordHash verifies against new password"
  );
  assert(
    !(await verifyPassword(ORIGINAL_PASSWORD, dbUser!.passwordHash)),
    "DB passwordHash does NOT verify against old password"
  );
  assert(dbUser!.passwordChangedAt !== null, "passwordChangedAt set in DB");
  const changedAt = dbUser!.passwordChangedAt!.getTime();
  assert(Date.now() - changedAt < 10_000, "passwordChangedAt is within the last 10 seconds");

  const usedPr = await prisma.passwordReset.findFirst({
    where: { userId: mainUserId },
    orderBy: { createdAt: "desc" },
    select: { token: true, usedAt: true, revokedAt: true },
  });
  assert(usedPr !== null, "PasswordReset record preserved (audit history)");
  assert(usedPr!.usedAt !== null, "PasswordReset.usedAt set after successful reset");
  assertEq(usedPr!.revokedAt, null, "PasswordReset.revokedAt is null (used, not revoked)");

  // ── 5. All sessions revoked after reset ───────────────────────────────────
  console.log("\n── 5. Sessions revoked after reset ─────────────────────────────");

  // Login before reset to create a session, then verify it's revoked.
  // We need a fresh user for this so the reset doesn't affect the main test flow.
  const emailSession = `user-session${SUFFIX}`;
  capturedPayloads = [];
  const { json: regSJ } = await post("/register", {
    name: "Session User",
    email: emailSession,
    password: ORIGINAL_PASSWORD,
  });
  const sessionUserId = (regSJ as { data: { id: string } }).data.id;

  // Login → get refresh cookie.
  const { setCookie: loginCookie } = await post("/login", {
    email: emailSession,
    password: ORIGINAL_PASSWORD,
  });
  const rawRefreshToken = extractCookieValue(loginCookie);
  assert(typeof rawRefreshToken === "string", "login produced a refresh token");

  // Confirm session exists and is active.
  const activeBefore = await prisma.session.count({
    where: { userId: sessionUserId, revokedAt: null },
  });
  assertEq(activeBefore, 1, "one active session before reset");

  // Forgot + reset.
  capturedPayloads = [];
  await post("/forgot-password", { email: emailSession });
  const sessionResetToken = await getLatestResetToken(sessionUserId);
  await post("/reset-password", {
    token: sessionResetToken,
    password: NEW_PASSWORD,
  });

  // Session must be revoked in DB.
  const activeAfter = await prisma.session.count({
    where: { userId: sessionUserId, revokedAt: null },
  });
  assertEq(activeAfter, 0, "all sessions revoked after reset");

  // Old refresh cookie must be rejected.
  const { status: sStaleRefresh } = await post(
    "/refresh",
    {},
    `refresh_token=${rawRefreshToken!}`
  );
  assertEq(sStaleRefresh, 401, "old refresh token rejected after password reset → 401");

  // ── 6. Login with new password succeeds ──────────────────────────────────
  console.log("\n── 6. Login with new password ──────────────────────────────────");

  const { status: sNewLogin } = await post("/login", {
    email: emailSession,
    password: NEW_PASSWORD,
  });
  assertEq(sNewLogin, 200, "login with new password → 200");

  // ── 7. Login with old password fails ─────────────────────────────────────
  console.log("\n── 7. Login with old password fails ────────────────────────────");

  const { status: sOldLogin } = await post("/login", {
    email: emailSession,
    password: ORIGINAL_PASSWORD,
  });
  assertEq(sOldLogin, 401, "login with old password → 401");

  // ── 8. Invalid token ──────────────────────────────────────────────────────
  console.log("\n── 8. Invalid token ────────────────────────────────────────────");

  const { status: sInvalid, json: jInvalid } = await post("/reset-password", {
    token: "b".repeat(64),
    password: NEW_PASSWORD,
  });
  assertEq(sInvalid, 400, "invalid token → 400");
  assertEq(
    (jInvalid as { message: string }).message,
    "Invalid or expired reset token",
    "invalid token: correct error message"
  );

  // ── 9. Expired token ──────────────────────────────────────────────────────
  console.log("\n── 9. Expired token ────────────────────────────────────────────");

  const emailExp = `user-expired${SUFFIX}`;
  capturedPayloads = [];
  const { json: regExpJ } = await post("/register", {
    name: "Expired Reset User",
    email: emailExp,
    password: ORIGINAL_PASSWORD,
  });
  const expUserId = (regExpJ as { data: { id: string } }).data.id;
  capturedPayloads = [];

  await post("/forgot-password", { email: emailExp });
  const expToken = await getLatestResetToken(expUserId);

  // Artificially expire.
  await prisma.passwordReset.update({
    where: { token: expToken },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const { status: sExp } = await post("/reset-password", {
    token: expToken,
    password: NEW_PASSWORD,
  });
  assertEq(sExp, 400, "expired token → 400");
  assertEq(
    ((await post("/reset-password", { token: expToken, password: NEW_PASSWORD })).json as {
      message: string;
    }).message,
    "Invalid or expired reset token",
    "expired token: same message as invalid (no oracle)"
  );

  // ── 10. Revoked token ─────────────────────────────────────────────────────
  console.log("\n── 10. Revoked token ───────────────────────────────────────────");

  const emailRevoke = `user-revoked${SUFFIX}`;
  capturedPayloads = [];
  const { json: regRevJ } = await post("/register", {
    name: "Revoke Reset User",
    email: emailRevoke,
    password: ORIGINAL_PASSWORD,
  });
  const revokeUserId = (regRevJ as { data: { id: string } }).data.id;
  capturedPayloads = [];

  await post("/forgot-password", { email: emailRevoke });
  const oldResetToken = await getLatestResetToken(revokeUserId);

  // Second forgot-password call revokes oldResetToken.
  await post("/forgot-password", { email: emailRevoke });

  const { status: sRevoked } = await post("/reset-password", {
    token: oldResetToken,
    password: NEW_PASSWORD,
  });
  assertEq(sRevoked, 400, "revoked token → 400");
  assertEq(
    ((await post("/reset-password", { token: oldResetToken, password: NEW_PASSWORD })).json as {
      message: string;
    }).message,
    "Invalid or expired reset token",
    "revoked token: same message as invalid (no oracle)"
  );

  // ── 11. Already-used token ────────────────────────────────────────────────
  console.log("\n── 11. Already-used token ──────────────────────────────────────");

  const { status: sUsed, json: jUsed } = await post("/reset-password", {
    token: resetToken, // used in test 3
    password: NEW_PASSWORD,
  });
  assertEq(sUsed, 400, "already-used token → 400");
  assertEq(
    (jUsed as { message: string }).message,
    "This password reset link has already been used",
    "already-used: correct error message"
  );

  // ── 12. Password policy ───────────────────────────────────────────────────
  console.log("\n── 12. Password policy ─────────────────────────────────────────");

  // Get a fresh valid token for policy tests.
  const emailPolicy = `user-policy${SUFFIX}`;
  capturedPayloads = [];
  await post("/register", {
    name: "Policy User",
    email: emailPolicy,
    password: ORIGINAL_PASSWORD,
  });
  const policyUser = await prisma.user.findUnique({
    where: { email: emailPolicy },
    select: { id: true },
  });
  capturedPayloads = [];
  await post("/forgot-password", { email: emailPolicy });
  const policyToken = await getLatestResetToken(policyUser!.id);

  assertEq(
    (await post("/reset-password", { token: policyToken, password: "short" })).status,
    400,
    "password < 8 chars → 400"
  );
  assertEq(
    (await post("/reset-password", { token: policyToken, password: "1234567" })).status,
    400,
    "7-char password → 400"
  );
  // 8 chars exactly should be accepted.
  const { status: sExact8 } = await post("/reset-password", {
    token: policyToken,
    password: "Exact8Ch",
  });
  assertEq(sExact8, 200, "8-char password accepted");

  // ── 13. Input validation ──────────────────────────────────────────────────
  console.log("\n── 13. Input validation ────────────────────────────────────────");

  // forgot-password
  assertEq((await post("/forgot-password", {})).status, 400, "forgot: missing email → 400");
  assertEq(
    (await post("/forgot-password", { email: "" })).status,
    400,
    "forgot: empty email → 400"
  );
  assertEq(
    (await post("/forgot-password", { email: "not-an-email" })).status,
    400,
    "forgot: invalid email format → 400"
  );

  // reset-password
  assertEq(
    (await post("/reset-password", { password: NEW_PASSWORD })).status,
    400,
    "reset: missing token → 400"
  );
  assertEq(
    (await post("/reset-password", { token: resetToken })).status,
    400,
    "reset: missing password → 400"
  );
  assertEq(
    (await post("/reset-password", { token: "", password: NEW_PASSWORD })).status,
    400,
    "reset: empty token → 400"
  );

  // ── 14. Multiple forgot-password calls — audit trail and latest wins ───────
  console.log("\n── 14. Multiple forgot-password calls ──────────────────────────");

  const emailMulti = `user-multi${SUFFIX}`;
  capturedPayloads = [];
  const { json: regMultiJ } = await post("/register", {
    name: "Multi Reset User",
    email: emailMulti,
    password: ORIGINAL_PASSWORD,
  });
  const multiUserId = (regMultiJ as { data: { id: string } }).data.id;
  capturedPayloads = [];

  // Three successive forgot-password calls.
  await post("/forgot-password", { email: emailMulti });
  const mToken1 = await getLatestResetToken(multiUserId);
  await post("/forgot-password", { email: emailMulti });
  const mToken2 = await getLatestResetToken(multiUserId);
  await post("/forgot-password", { email: emailMulti });
  const mToken3 = await getLatestResetToken(multiUserId);

  assert(
    mToken1 !== mToken2 && mToken2 !== mToken3,
    "each forgot-password produces a distinct token"
  );

  // Earlier tokens must be rejected.
  assertEq(
    (await post("/reset-password", { token: mToken1, password: NEW_PASSWORD })).status,
    400,
    "first token rejected after two further forgot-passwords"
  );
  assertEq(
    (await post("/reset-password", { token: mToken2, password: NEW_PASSWORD })).status,
    400,
    "second token rejected"
  );
  assertEq(
    (await post("/reset-password", { token: mToken3, password: NEW_PASSWORD })).status,
    200,
    "latest token (third) accepted"
  );

  // Audit history: all 3 PasswordReset records must exist.
  const allPRs = await prisma.passwordReset.findMany({
    where: { userId: multiUserId },
    orderBy: { createdAt: "asc" },
    select: { token: true, revokedAt: true, usedAt: true },
  });
  assertEq(
    allPRs.length,
    3,
    "3 PasswordReset records in DB (1 per forgot-password) — complete audit history"
  );
  assert(allPRs[0]!.revokedAt !== null, "first token is revoked");
  assert(allPRs[1]!.revokedAt !== null, "second token is revoked");
  assert(allPRs[2]!.usedAt !== null, "third token (latest) is used");

  // ── 15. Inactive account — no token issued (no leak) ─────────────────────
  console.log("\n── 15. Inactive account ────────────────────────────────────────");

  const emailInactive = `user-inactive${SUFFIX}`;
  await prisma.user.create({
    data: {
      email: emailInactive,
      passwordHash: "placeholder",
      name: "Inactive Reset",
      role: "CUSTOMER",
      isActive: false,
    },
  });
  capturedPayloads = [];
  const { status: sInactive } = await post("/forgot-password", { email: emailInactive });
  assertEq(sInactive, 200, "inactive account → 200 (no leak)");
  assertEq(capturedPayloads.length, 0, "no notification for inactive account");

  const prCountInactive = await prisma.passwordReset.count({
    where: { user: { email: emailInactive } },
  });
  assertEq(prCountInactive, 0, "no PasswordReset record created for inactive account");

  // ── 16. Regression — health route unaffected ──────────────────────────────
  console.log("\n── 16. Regression ──────────────────────────────────────────────");
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assertEq(health.status, 200, "GET /api/health still 200");

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n── cleanup ─────────────────────────────────────────────────────");
  removeSpy();
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: SUFFIX } },
  });
  assert(count >= 6, `cleaned up ${count} test users (cascades PasswordReset + Session records)`);
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
  removeSpy();
  console.error("\n[FATAL]", err);
  process.exit(1);
});
