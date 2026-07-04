import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../auth.types.js";

/**
 * authorize — factory that returns role-enforcement middleware.
 *
 * Must be used AFTER authenticate (depends on req.user being set).
 * Returns 403 (Forbidden) when the authenticated user's role is not in the
 * allowed list. The distinction between 401 and 403 is intentional: 401 means
 * "who are you?"; 403 means "I know who you are, but you may not do this."
 *
 * Usage:
 *   router.get("/admin-only", authenticate, authorize("ADMIN", "SUPER_ADMIN"), handler)
 */
export function authorize(...roles: UserRole[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
