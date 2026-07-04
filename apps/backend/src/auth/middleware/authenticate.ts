import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../token.service.js";
import { prisma } from "../../lib/prisma.js";
import type { UserRole } from "../auth.types.js";

/**
 * authenticate — validates the Bearer access token and attaches req.user.
 *
 * Returns 401 if the token is absent, invalid, expired, issued by an unknown
 * issuer/audience, or the account has been suspended or soft-deleted since the
 * token was minted (covers the 15-minute access token window).
 *
 * Does NOT enforce email verification — that is a per-route business decision.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);

    // Live account-status check: detects suspension/soft-delete that occurred
    // after the token was issued within its 15-minute validity window.
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

    if (!user || !user.isActive || user.deletedAt !== null) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      emailVerified: user.emailVerified,
    };

    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}
