import type { CookieOptions } from "express";

export const REFRESH_COOKIE_NAME = "refresh_token";

// 30 days in milliseconds — Express CookieOptions.maxAge is in milliseconds.
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// secure: true sends the cookie only over HTTPS.
// In development (http://localhost) it must be false or the browser silently drops it.
const isProduction = process.env.NODE_ENV === "production";

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  // Scoped to the refresh endpoint only — the cookie is never sent to any
  // other API endpoint by the browser.
  path: "/api/auth/refresh",
  maxAge: REFRESH_MAX_AGE_MS,
};

// Used by res.clearCookie — path and security flags must match the Set-Cookie.
export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  path: "/api/auth/refresh",
};
