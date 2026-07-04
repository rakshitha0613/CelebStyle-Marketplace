import type { UserRole } from "@prisma/client";

export type { UserRole };

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

// Augments express-serve-static-core globally within this compilation unit.
// This is the standard pattern for Express + TypeScript — extends req.user
// on every Request without casting at the call site.
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}
