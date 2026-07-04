import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import type { RequestHandler, Request } from "express";

// ── Helmet — security response headers ────────────────────────────────────────

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:", "https:"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      mediaSrc:       ["'self'"],
      frameSrc:       ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ── CORS — validated origin list ───────────────────────────────────────────────

const ALLOWED_ORIGINS_RAW = process.env.ALLOWED_ORIGINS ?? "";
const ALLOWED_ORIGINS: string[] = ALLOWED_ORIGINS_RAW
  ? ALLOWED_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export function corsOriginValidator(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) return callback(null, true);
  if (ALLOWED_ORIGINS.length === 0 || process.env.NODE_ENV === "development") {
    return callback(null, true);
  }
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  callback(new Error(`CORS: origin '${origin}' is not allowed`));
}

// ── Rate limiting ──────────────────────────────────────────────────────────────

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      process.env.NODE_ENV === "production" ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many requests, please try again later." },
  skip: (req: Request) => req.path === "/api/health" || req.path === "/metrics",
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      process.env.NODE_ENV === "production" ? 20 : 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Too many authentication attempts, please try again later." },
  keyGenerator: (req: Request): string => req.ip ?? "unknown",
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max:      process.env.NODE_ENV === "production" ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "API rate limit exceeded." },
});

// ── Compression ────────────────────────────────────────────────────────────────

export const compressionMiddleware: RequestHandler = compression({
  level:     6,
  threshold: 1024,
}) as RequestHandler;

// ── Trusted proxy ──────────────────────────────────────────────────────────────

export const TRUST_PROXY: number | false = process.env.TRUST_PROXY === "true" ? 1 : false;
