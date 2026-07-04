import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "./auth.service.js";
import { authenticate } from "./middleware/authenticate.js";
import { prisma } from "../lib/prisma.js";
import {
  AuthValidationError,
  AuthConflictError,
  AuthUnauthorizedError,
} from "./auth.errors.js";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  clearRefreshCookieOptions,
} from "./cookie.js";

export const authRouter = Router();

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Public. Creates a new CUSTOMER account and dispatches an email verification link.

authRouter.post("/register", async (req, res) => {
  try {
    const result = await register(req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    if (err instanceof AuthConflictError) {
      res.status(409).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Public. Returns an access token (body) and sets a refresh-token cookie.

authRouter.post("/login", async (req, res) => {
  try {
    const deviceInfo =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined;
    const ipAddress = req.ip ?? undefined;

    const { result, rawRefreshToken } = await login(req.body, deviceInfo, ipAddress);

    res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, refreshCookieOptions);
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    if (err instanceof AuthUnauthorizedError) {
      res.status(401).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
// Reads the HTTP-only refresh-token cookie, rotates the session, and returns
// a new access token plus a new refresh-token cookie.

authRouter.post("/refresh", async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const { accessToken, rawRefreshToken: newRaw } = await refresh(rawToken);

    res.cookie(REFRESH_COOKIE_NAME, newRaw, refreshCookieOptions);
    res.status(200).json({ data: { accessToken } });
  } catch (err) {
    if (err instanceof AuthUnauthorizedError) {
      // Always clear the cookie on any refresh failure — forces re-login.
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
      res.status(401).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
// Public. Consumes a single-use verification token from the email link.

authRouter.post("/verify-email", async (req, res) => {
  try {
    const result = await verifyEmail(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
// Public. Issues a new verification token. Always returns 200 — never reveals
// whether the email exists or is already verified.

authRouter.post("/resend-verification", async (req, res) => {
  try {
    const result = await resendVerification(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
// Public. Dispatches a reset link if the email exists. Always returns 200.

authRouter.post("/forgot-password", async (req, res) => {
  try {
    const result = await forgotPassword(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Public. Consumes a one-time reset token, updates the password, and revokes
// all active refresh sessions so old tokens are immediately invalid.

authRouter.post("/reset-password", async (req, res) => {
  try {
    const result = await resetPassword(req.body);
    res.status(200).json({ data: result });
  } catch (err) {
    if (err instanceof AuthValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    throw err;
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Protected. Returns the authenticated user's profile.
// authenticate middleware validates the Bearer token and attaches req.user
// before the handler runs. A second DB read fetches the full profile shape.

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      profile: { select: { avatarUrl: true } },
    },
  });

  // Guard against a race where the account was deleted between the middleware
  // check and this DB read (extremely unlikely but defensive).
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  res.status(200).json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      avatar: user.profile?.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Revokes the session and clears the refresh-token cookie.
// Always returns 200 — idempotent even when called without a valid session.

authRouter.post("/logout", async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  try {
    await logout(rawToken);
  } catch {
    // Swallow errors on logout — cookie is cleared regardless.
  }
  res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
  res.status(200).json({ data: { ok: true } });
});
