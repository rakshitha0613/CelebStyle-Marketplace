import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { signAccessToken, generateRefreshToken, hashRefreshToken } from "./token.service.js";
import { notificationService } from "./notification.service.js";
import {
  AuthValidationError,
  AuthConflictError,
  AuthUnauthorizedError,
} from "./auth.errors.js";
import type { UserRole } from "./auth.types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[\d\s\-()\\.]{7,20}$/;
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;  // 24 hours
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
const RESET_EXPIRY_MS = 60 * 60 * 1000;              // 1 hour

// Hashed at module load so all code paths execute bcrypt in constant time.
// Prevents email enumeration via response-time side-channels:
// - Valid email + wrong password  → bcrypt.compare(input, realHash)    ~300 ms
// - Unknown email                → bcrypt.compare(input, dummyHash)   ~300 ms
const DUMMY_HASH_PROMISE: Promise<string> = hashPassword(
  "celebstyle-timing-sentinel-2026"
);

// ─── Result types ─────────────────────────────────────────────────────────────

export interface RegisterResult {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

// ─── Input validation helpers ─────────────────────────────────────────────────

function validateRegisterInput(body: unknown): {
  name: string;
  email: string;
  password: string;
  phone?: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }

  const raw = body as Record<string, unknown>;

  const rawName = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!rawName) throw new AuthValidationError("name is required");
  if (rawName.length > 100)
    throw new AuthValidationError("name must be 100 characters or fewer");

  const rawEmail =
    typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!rawEmail) throw new AuthValidationError("email is required");
  if (!EMAIL_RE.test(rawEmail))
    throw new AuthValidationError("email must be a valid email address");

  const password = typeof raw.password === "string" ? raw.password : "";
  if (!password) throw new AuthValidationError("password is required");
  if (password.length < 8)
    throw new AuthValidationError("password must be at least 8 characters");

  let phone: string | undefined;
  if (raw.phone !== undefined && raw.phone !== null && raw.phone !== "") {
    const rawPhone = typeof raw.phone === "string" ? raw.phone.trim() : "";
    if (!rawPhone || !PHONE_RE.test(rawPhone))
      throw new AuthValidationError("phone must be a valid phone number");
    phone = rawPhone;
  }

  return { name: rawName, email: rawEmail, password, phone };
}

function validateLoginInput(body: unknown): { email: string; password: string } {
  if (typeof body !== "object" || body === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }

  const raw = body as Record<string, unknown>;

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email) throw new AuthValidationError("email is required");

  const password = typeof raw.password === "string" ? raw.password : "";
  if (!password) throw new AuthValidationError("password is required");

  return { email, password };
}

// ─── register ────────────────────────────────────────────────────────────────

export async function register(rawBody: unknown): Promise<RegisterResult> {
  const { name, email, password, phone } = validateRegisterInput(rawBody);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new AuthConflictError("Email already registered");

  const passwordHash = await hashPassword(password);

  const verificationToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  // Single nested create — Prisma generates a CTE-based SQL that atomically
  // writes User + EmailVerification in one round-trip. PgBouncer-safe.
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone ?? null,
      role: "CUSTOMER",
      emailVerifications: {
        create: { token: verificationToken, expiresAt },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  try {
    await notificationService.send({
      type: "EMAIL_VERIFICATION",
      to: user.email,
      name: user.name,
      token: verificationToken,
    });
  } catch (err) {
    console.error("[auth] Failed to dispatch verification notification:", err);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(
  rawBody: unknown,
  deviceInfo?: string,
  ipAddress?: string
): Promise<{ result: LoginResult; rawRefreshToken: string }> {
  const { email, password } = validateLoginInput(rawBody);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      passwordHash: true,
      isActive: true,
      deletedAt: true,
    },
  });

  // Always run bcrypt regardless of whether the user was found.
  // This prevents timing-based email enumeration: both paths take ~300 ms.
  if (!user || !user.isActive || user.deletedAt !== null) {
    const dummyHash = await DUMMY_HASH_PROMISE;
    await verifyPassword(password, dummyHash);
    throw new AuthUnauthorizedError("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AuthUnauthorizedError("Invalid email or password");

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
    emailVerified: user.emailVerified,
  });

  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  // Batch $transaction: create Session + update lastLoginAt — PgBouncer-safe.
  await prisma.$transaction([
    prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokenHash,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  return {
    result: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    },
    rawRefreshToken,
  };
}

// ─── refresh ─────────────────────────────────────────────────────────────────

export async function refresh(
  rawRefreshToken: string | undefined
): Promise<{ accessToken: string; rawRefreshToken: string }> {
  if (!rawRefreshToken?.trim()) {
    throw new AuthUnauthorizedError("Refresh token required");
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshToken: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) throw new AuthUnauthorizedError("Invalid refresh token");

  // Reuse detection: a revoked token being presented again is evidence of
  // possible token theft. Nuclear response: revoke ALL active sessions.
  if (session.revokedAt !== null) {
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AuthUnauthorizedError("Refresh token reuse detected");
  }

  if (session.expiresAt <= new Date()) {
    throw new AuthUnauthorizedError("Refresh token has expired");
  }

  if (!session.user.isActive || session.user.deletedAt !== null) {
    throw new AuthUnauthorizedError("Account is inactive");
  }

  const newAccessToken = await signAccessToken({
    sub: session.user.id,
    email: session.user.email,
    role: session.user.role as UserRole,
    emailVerified: session.user.emailVerified,
  });

  const newRawToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  // Token rotation: batch $transaction([revoke old, create new]) — PgBouncer-safe.
  // Marking old session as revokedAt (instead of deleting it) enables reuse
  // detection: if the old token is presented again, we find the revoked session
  // and can respond with nuclear revocation of all remaining sessions.
  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshToken: newHash,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  return { accessToken: newAccessToken, rawRefreshToken: newRawToken };
}

// ─── verifyEmail ─────────────────────────────────────────────────────────────

export interface VerifyEmailResult {
  message: string;
}

function validateVerifyEmailInput(body: unknown): { token: string } {
  if (typeof body !== "object" || body === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }
  const raw = body as Record<string, unknown>;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  if (!token) throw new AuthValidationError("token is required");
  return { token };
}

export async function verifyEmail(rawBody: unknown): Promise<VerifyEmailResult> {
  const { token } = validateVerifyEmailInput(rawBody);

  const ev = await prisma.emailVerification.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, revokedAt: true },
  });

  // Treat "not found" and "revoked" identically — prevents oracle attacks on token validity.
  if (!ev || ev.revokedAt !== null) {
    throw new AuthValidationError("Invalid or expired verification token");
  }

  if (ev.usedAt !== null) {
    throw new AuthValidationError("Email address is already verified");
  }

  if (ev.expiresAt <= new Date()) {
    throw new AuthValidationError("Invalid or expired verification token");
  }

  // Batch $transaction: mark token used + flip emailVerified flag — PgBouncer-safe.
  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: ev.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: ev.userId },
      data: { emailVerified: true },
    }),
  ]);

  return { message: "Email verified successfully" };
}

// ─── resendVerification ───────────────────────────────────────────────────────

const RESEND_SUCCESS = {
  message:
    "If your email is registered and unverified, a new verification link has been sent",
} as const;

export async function resendVerification(rawBody: unknown): Promise<{ message: string }> {
  if (typeof rawBody !== "object" || rawBody === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }
  const raw = rawBody as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email) throw new AuthValidationError("email is required");
  if (!EMAIL_RE.test(email))
    throw new AuthValidationError("email must be a valid email address");

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      isActive: true,
      deletedAt: true,
    },
  });

  // Never reveal: not found, already verified, inactive, deleted.
  // All these paths return the identical success message.
  if (!user || user.emailVerified || !user.isActive || user.deletedAt !== null) {
    return RESEND_SUCCESS;
  }

  const newToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  // Batch $transaction: revoke all active tokens, then create the new one.
  // Keeps old records intact for audit history (revokedAt instead of delete).
  // PgBouncer-safe (sequential batch, not interactive callback).
  await prisma.$transaction([
    prisma.emailVerification.updateMany({
      where: { userId: user.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.emailVerification.create({
      data: { userId: user.id, token: newToken, expiresAt },
    }),
  ]);

  try {
    await notificationService.send({
      type: "EMAIL_VERIFICATION",
      to: user.email,
      name: user.name,
      token: newToken,
    });
  } catch (err) {
    console.error("[auth] Failed to dispatch resend verification notification:", err);
  }

  return RESEND_SUCCESS;
}

// ─── forgotPassword ──────────────────────────────────────────────────────────

const FORGOT_SUCCESS = {
  message: "If the account exists, a password reset link has been sent.",
} as const;

export async function forgotPassword(rawBody: unknown): Promise<{ message: string }> {
  if (typeof rawBody !== "object" || rawBody === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }
  const raw = rawBody as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email) throw new AuthValidationError("email is required");
  if (!EMAIL_RE.test(email))
    throw new AuthValidationError("email must be a valid email address");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, deletedAt: true },
  });

  // Never reveal whether the account exists — always return the same message.
  if (!user || !user.isActive || user.deletedAt !== null) {
    return FORGOT_SUCCESS;
  }

  const newToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

  // Batch $transaction: revoke active tokens + create new one — PgBouncer-safe.
  await prisma.$transaction([
    prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.passwordReset.create({
      data: { userId: user.id, token: newToken, expiresAt },
    }),
  ]);

  try {
    await notificationService.send({
      type: "PASSWORD_RESET",
      to: user.email,
      name: user.name,
      token: newToken,
    });
  } catch (err) {
    console.error("[auth] Failed to dispatch password reset notification:", err);
  }

  return FORGOT_SUCCESS;
}

// ─── resetPassword ────────────────────────────────────────────────────────────

export async function resetPassword(rawBody: unknown): Promise<{ message: string }> {
  if (typeof rawBody !== "object" || rawBody === null) {
    throw new AuthValidationError("Request body must be a JSON object");
  }
  const raw = rawBody as Record<string, unknown>;

  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  if (!token) throw new AuthValidationError("token is required");

  const password = typeof raw.password === "string" ? raw.password : "";
  if (!password) throw new AuthValidationError("password is required");
  if (password.length < 8)
    throw new AuthValidationError("password must be at least 8 characters");

  const pr = await prisma.passwordReset.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, revokedAt: true },
  });

  // Treat "not found" and "revoked" identically — no oracle on token existence.
  if (!pr || pr.revokedAt !== null) {
    throw new AuthValidationError("Invalid or expired reset token");
  }

  if (pr.usedAt !== null) {
    throw new AuthValidationError("This password reset link has already been used");
  }

  if (pr.expiresAt <= new Date()) {
    throw new AuthValidationError("Invalid or expired reset token");
  }

  // Hash before the transaction — bcrypt is async and can't live inside a
  // batch $transaction array (which takes already-constructed Prisma queries).
  const newHash = await hashPassword(password);
  const now = new Date();

  // Batch $transaction (PgBouncer-safe):
  //  1. Mark token used (preserves audit record)
  //  2. Rotate passwordHash + stamp passwordChangedAt
  //  3. Revoke ALL active refresh sessions — old tokens immediately invalid
  await prisma.$transaction([
    prisma.passwordReset.update({
      where: { id: pr.id },
      data: { usedAt: now },
    }),
    prisma.user.update({
      where: { id: pr.userId },
      data: { passwordHash: newHash, passwordChangedAt: now },
    }),
    prisma.session.updateMany({
      where: { userId: pr.userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  return { message: "Password reset successfully. Please log in with your new password." };
}

// ─── logout ──────────────────────────────────────────────────────────────────

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken?.trim()) return;

  const tokenHash = hashRefreshToken(rawRefreshToken);

  // updateMany is idempotent — no error if session is already revoked or missing.
  await prisma.session.updateMany({
    where: { refreshToken: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
