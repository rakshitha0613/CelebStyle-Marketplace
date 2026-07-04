import bcrypt from "bcryptjs";

// OWASP recommendation: 12 rounds ≈ 300 ms on a modern server.
// High enough to defeat offline brute-force; low enough to be imperceptible to users.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// bcrypt.compare is constant-time — immune to timing attacks.
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
