/**
 * Barrel re-export for auth middleware.
 *
 * Canonical locations:
 *   authenticate → src/auth/middleware/authenticate.ts
 *   authorize    → src/auth/middleware/authorize.ts
 *
 * Legacy aliases (requireAuth, requireRole) are preserved for any existing
 * internal callers until those call-sites are migrated.
 */
export { authenticate } from "./middleware/authenticate.js";
export { authenticate as requireAuth } from "./middleware/authenticate.js";
export { authorize } from "./middleware/authorize.js";
export { authorize as requireRole } from "./middleware/authorize.js";

// ─── optionalAuth ─────────────────────────────────────────────────────────────
// Parses the Bearer token when present and populates req.user.
// Never returns 401 — routes using this serve both guests and authenticated users.

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./token.service.js";
import { prisma } from "../lib/prisma.js";
import type { UserRole } from "./auth.types.js";

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (user && user.isActive && user.deletedAt === null) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        emailVerified: user.emailVerified,
      };
    }
  } catch {
    // Intentionally silent — optional auth never blocks the request.
  }

  next();
}
