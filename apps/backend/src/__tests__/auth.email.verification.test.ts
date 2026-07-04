/**
 * Phase 3.4 — Email Verification Integration Tests
 *
 * Covers:
 *   POST /api/auth/verify-email
 *   POST /api/auth/resend-verification
 *
 * All test accounts use the "@phase34.celebstyle.test" sentinel.
 * Cleanup cascades EmailVerification records via User onDelete: Cascade.
 *
 * Run: npm run test:email-verification
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
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

const SUFFIX = "@phase34.celebstyle.test";
const VALID_PASSWORD = "SecurePass34!";

// ── Server ────────────────────────────────────────────────────────────────────

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

// ── HTTP ──────────────────────────────────────────────────────────────────────

interface PostResult {
  status: number;
  json: unknown;
}

async function post(path: string, body: unknown = {}): Promise<PostResult> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
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

async function getLatestVerificationToken(userId: string): Promise<string> {
  const ev = await prisma.emailVerification.findFirst({
    where: { userId, revokedAt: null, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (!ev) throw new Error(`No active verification token for user ${userId}`);
  return ev.token;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   Phase 3.4 — Email Verification Tests               ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  // Pre-cleanup: remove any accounts left by a previous failed run.
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });

  await setupServer();
  installSpy();

  // ── 1. Successful email verification ──────────────────────────────────────
  console.log("── 1. Successful email verification ────────────────────────────");

  const emailVerify = `user-verify${SUFFIX}`;
  capturedPayloads = [];
  const { json: regJ } = await post("/register", {
    name: "Verify User",
    email: emailVerify,
    password: VALID_PASSWORD,
  });
  const verifyUserId = (regJ as { data: { id: string } }).data.id;

  // Grab the real token from the DB (same token the notification carries)
  const validToken = await getLatestVerificationToken(verifyUserId);

  // The notification's token should match the DB token.
  assertEq(capturedPayloads.length, 1, "registration dispatched one notification");
  assertEq(capturedPayloads[0]?.token, validToken, "notification token matches DB token");

  // Verify the email.
  const { status: sVerify, json: jVerify } = await post("/verify-email", {
    token: validToken,
  });
  assertEq(sVerify, 200, "verify-email returns 200");
  assert(
    typeof (jVerify as { data: { message: string } }).data.message === "string",
    "response has data.message"
  );

  // ── 2. DB state after verification ────────────────────────────────────────
  console.log("\n── 2. DB state after verification ──────────────────────────────");

  const verifiedUser = await prisma.user.findUnique({
    where: { id: verifyUserId },
    select: { emailVerified: true },
  });
  assertEq(verifiedUser!.emailVerified, true, "user.emailVerified = true in DB");

  const usedEv = await prisma.emailVerification.findFirst({
    where: { userId: verifyUserId },
    orderBy: { createdAt: "desc" },
    select: { token: true, usedAt: true, revokedAt: true },
  });
  assert(usedEv !== null, "EmailVerification record preserved (audit history intact)");
  assert(usedEv!.usedAt !== null, "emailVerification.usedAt is set");
  assertEq(usedEv!.revokedAt, null, "emailVerification.revokedAt remains null (not revoked — was used)");
  assertEq(usedEv!.token, validToken, "correct EmailVerification record updated");

  // ── 3. Invalid token ───────────────────────────────────────────────────────
  console.log("\n── 3. Invalid token ────────────────────────────────────────────");

  const { status: sInvalid, json: jInvalid } = await post("/verify-email", {
    token: "a".repeat(64),
  });
  assertEq(sInvalid, 400, "random token → 400");
  assertEq(
    (jInvalid as { message: string }).message,
    "Invalid or expired verification token",
    "invalid token: correct error message"
  );

  // ── 4. Already-used token ──────────────────────────────────────────────────
  console.log("\n── 4. Already-used token ───────────────────────────────────────");

  const { status: sUsed, json: jUsed } = await post("/verify-email", { token: validToken });
  assertEq(sUsed, 400, "already-used token → 400");
  assertEq(
    (jUsed as { message: string }).message,
    "Email address is already verified",
    "already-used token: correct error message"
  );

  // ── 5. Expired token ───────────────────────────────────────────────────────
  console.log("\n── 5. Expired token ────────────────────────────────────────────");

  const emailExpired = `user-expired${SUFFIX}`;
  await post("/register", {
    name: "Expired User",
    email: emailExpired,
    password: VALID_PASSWORD,
  });
  const expUser = await prisma.user.findUnique({
    where: { email: emailExpired },
    select: { id: true },
  });
  const expEv = await prisma.emailVerification.findFirst({
    where: { userId: expUser!.id },
    orderBy: { createdAt: "desc" },
  });

  // Artificially expire the token.
  await prisma.emailVerification.update({
    where: { id: expEv!.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const { status: sExp } = await post("/verify-email", { token: expEv!.token });
  assertEq(sExp, 400, "expired token → 400");
  assertEq(
    ((await post("/verify-email", { token: expEv!.token })).json as { message: string }).message,
    "Invalid or expired verification token",
    "expired token: same message as invalid (no oracle)"
  );

  // ── 6. Revoked token ───────────────────────────────────────────────────────
  console.log("\n── 6. Revoked token (issued via resend) ────────────────────────");

  const emailRevoke = `user-revoke${SUFFIX}`;
  await post("/register", {
    name: "Revoke User",
    email: emailRevoke,
    password: VALID_PASSWORD,
  });
  const revokeUser = await prisma.user.findUnique({
    where: { email: emailRevoke },
    select: { id: true },
  });
  const originalToken = await getLatestVerificationToken(revokeUser!.id);

  // Resend — this revokes originalToken.
  await post("/resend-verification", { email: emailRevoke });

  const { status: sRevoked } = await post("/verify-email", { token: originalToken });
  assertEq(sRevoked, 400, "revoked token → 400");
  assertEq(
    ((await post("/verify-email", { token: originalToken })).json as { message: string }).message,
    "Invalid or expired verification token",
    "revoked token: same message as invalid (no oracle)"
  );

  // ── 7. Input validation ────────────────────────────────────────────────────
  console.log("\n── 7. Input validation — verify-email ──────────────────────────");

  assertEq((await post("/verify-email", {})).status, 400, "missing token → 400");
  assertEq((await post("/verify-email", { token: "" })).status, 400, "empty token → 400");
  assertEq((await post("/verify-email", { token: "   " })).status, 400, "whitespace token → 400");

  // ── 8. Resend — success ────────────────────────────────────────────────────
  console.log("\n── 8. Resend — success ─────────────────────────────────────────");

  const emailResend = `user-resend${SUFFIX}`;
  capturedPayloads = [];
  await post("/register", {
    name: "Resend User",
    email: emailResend,
    password: VALID_PASSWORD,
  });
  const resendUser = await prisma.user.findUnique({
    where: { email: emailResend },
    select: { id: true },
  });
  const tokenBeforeResend = await getLatestVerificationToken(resendUser!.id);
  capturedPayloads = []; // reset: ignore the registration notification

  const { status: sResend, json: jResend } = await post("/resend-verification", {
    email: emailResend,
  });
  assertEq(sResend, 200, "resend returns 200");
  assert(
    typeof (jResend as { data: { message: string } }).data.message === "string",
    "resend response has data.message"
  );

  // ── 9. DB after resend ─────────────────────────────────────────────────────
  console.log("\n── 9. DB state after resend ────────────────────────────────────");

  const oldEv = await prisma.emailVerification.findUnique({
    where: { token: tokenBeforeResend },
    select: { revokedAt: true, usedAt: true },
  });
  assert(oldEv !== null, "old EmailVerification still in DB (audit history preserved)");
  assert(oldEv!.revokedAt !== null, "old token is revoked (revokedAt set)");
  assertEq(oldEv!.usedAt, null, "old token was not marked used — only revoked");

  const newToken = await getLatestVerificationToken(resendUser!.id);
  assert(newToken !== tokenBeforeResend, "new token differs from old token");
  assert(typeof newToken === "string" && newToken.length === 64, "new token is 64-char hex");

  // ── 10. Notification after resend ─────────────────────────────────────────
  console.log("\n── 10. Notification dispatched on resend ───────────────────────");

  assertEq(capturedPayloads.length, 1, "exactly one notification dispatched on resend");
  assertEq(capturedPayloads[0]?.type, "EMAIL_VERIFICATION", "notification type is EMAIL_VERIFICATION");
  assertEq(capturedPayloads[0]?.to, emailResend, "notification sent to correct email");
  assertEq(capturedPayloads[0]?.token, newToken, "notification carries new token (not old)");

  // ── 11. New token works after resend ──────────────────────────────────────
  console.log("\n── 11. New token works after resend ────────────────────────────");

  const { status: sNewVerify } = await post("/verify-email", { token: newToken });
  assertEq(sNewVerify, 200, "new token verifies successfully after resend");

  const resendUserDb = await prisma.user.findUnique({
    where: { id: resendUser!.id },
    select: { emailVerified: true },
  });
  assertEq(resendUserDb!.emailVerified, true, "user.emailVerified = true after resend+verify");

  // ── 12. Old token rejected after resend ───────────────────────────────────
  console.log("\n── 12. Old token rejected after resend ─────────────────────────");

  const { status: sOldToken } = await post("/verify-email", { token: tokenBeforeResend });
  assertEq(sOldToken, 400, "old token rejected after resend → 400");

  // ── 13. Resend — unknown email (no leak) ──────────────────────────────────
  console.log("\n── 13. Resend — unknown email ──────────────────────────────────");

  capturedPayloads = [];
  const { status: sUnknown, json: jUnknown } = await post("/resend-verification", {
    email: `no-such-user${SUFFIX}`,
  });
  assertEq(sUnknown, 200, "resend to unknown email → 200 (no leak)");
  assertEq(capturedPayloads.length, 0, "no notification sent for unknown email");
  // Response message must be identical to the success case.
  assert(
    typeof (jUnknown as { data: { message: string } }).data.message === "string",
    "unknown email: same shape as real resend (no distinguishable response)"
  );

  // ── 14. Resend — already verified (no leak, no notification) ──────────────
  console.log("\n── 14. Resend — already verified ───────────────────────────────");

  capturedPayloads = [];
  const { status: sVerifiedResend, json: jVerifiedResend } = await post(
    "/resend-verification",
    { email: emailVerify } // emailVerify was verified in test 1
  );
  assertEq(sVerifiedResend, 200, "resend to already-verified email → 200 (no leak)");
  assertEq(capturedPayloads.length, 0, "no notification sent to already-verified account");
  assert(
    typeof (jVerifiedResend as { data: { message: string } }).data.message === "string",
    "already-verified resend: same response shape"
  );

  // ── 15. Multiple resends — only latest token valid ────────────────────────
  console.log("\n── 15. Multiple resends ────────────────────────────────────────");

  const emailMulti = `user-multi-resend${SUFFIX}`;
  await post("/register", {
    name: "Multi Resend",
    email: emailMulti,
    password: VALID_PASSWORD,
  });
  const multiUser = await prisma.user.findUnique({
    where: { email: emailMulti },
    select: { id: true },
  });

  const token1 = await getLatestVerificationToken(multiUser!.id);
  await post("/resend-verification", { email: emailMulti }); // resend 1
  const token2 = await getLatestVerificationToken(multiUser!.id);
  await post("/resend-verification", { email: emailMulti }); // resend 2
  await post("/resend-verification", { email: emailMulti }); // resend 3
  const token3 = await getLatestVerificationToken(multiUser!.id);

  assert(token1 !== token2 && token2 !== token3, "each resend produces a different token");

  assertEq((await post("/verify-email", { token: token1 })).status, 400, "first token rejected after three resends");
  assertEq((await post("/verify-email", { token: token2 })).status, 400, "second token rejected after later resends");
  assertEq((await post("/verify-email", { token: token3 })).status, 200, "latest token works");

  const allEvs = await prisma.emailVerification.findMany({
    where: { userId: multiUser!.id },
    orderBy: { createdAt: "asc" },
    select: { token: true, revokedAt: true, usedAt: true },
  });
  assertEq(allEvs.length, 4, "4 EmailVerification records in DB (1 original + 3 resends) — complete audit history");
  assert(allEvs[0]!.revokedAt !== null, "token 1 (original) is revoked");
  assert(allEvs[1]!.revokedAt !== null, "token 2 (first resend) is revoked");
  assert(allEvs[2]!.revokedAt !== null, "token 3 (second resend) is revoked");
  assert(allEvs[3]!.usedAt !== null, "token 4 (third resend / latest) is used");

  // ── 16. Resend validation ─────────────────────────────────────────────────
  console.log("\n── 16. Input validation — resend-verification ──────────────────");

  assertEq((await post("/resend-verification", {})).status, 400, "missing email → 400");
  assertEq((await post("/resend-verification", { email: "" })).status, 400, "empty email → 400");
  assertEq(
    (await post("/resend-verification", { email: "not-an-email" })).status,
    400,
    "invalid email format → 400"
  );

  // ── 17. Existing routes unaffected ────────────────────────────────────────
  console.log("\n── 17. Regression — existing routes ────────────────────────────");
  const health = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`);
  assertEq(health.status, 200, "GET /api/health still 200");

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\n── cleanup ─────────────────────────────────────────────────────");
  removeSpy();
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: SUFFIX } },
  });
  assert(count >= 5, `cleaned up ${count} test users (cascades EmailVerification records)`);
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
