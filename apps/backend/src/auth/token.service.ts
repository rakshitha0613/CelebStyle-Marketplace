import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import { config } from "../env.js";
import type { TokenPayload } from "./auth.types.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_BYTES = 32;

// Claim constants exported so tests can construct tokens with the same values.
export const TOKEN_ISSUER = "celebstyle-api";
export const TOKEN_AUDIENCE = "celebstyle-client";

// Encoded once at module load — config.jwtSecret is validated at startup.
const secret = new TextEncoder().encode(config.jwtSecret);

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    emailVerified: payload.emailVerified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

  return {
    sub: payload.sub as string,
    email: payload["email"] as string,
    role: payload["role"] as TokenPayload["role"],
    emailVerified: payload["emailVerified"] as boolean,
  };
}

// Returns a 64-character hex string (32 random bytes).
// The CALLER must store hashRefreshToken(raw) in the database — never raw.
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
}

// One-way SHA-256 hash — safe to store in the database.
// Compare by hashing the incoming cookie value and checking for equality.
export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
