/**
 * promote-admin.mjs — Development utility to promote a CUSTOMER to ADMIN or SUPER_ADMIN.
 *
 * Usage:
 *   node apps/backend/scripts/promote-admin.mjs <email> [role]
 *
 * Arguments:
 *   email   Required. The registered user's email address.
 *   role    Optional. ADMIN (default) or SUPER_ADMIN.
 *
 * Examples:
 *   node apps/backend/scripts/promote-admin.mjs alice@example.com
 *   node apps/backend/scripts/promote-admin.mjs alice@example.com SUPER_ADMIN
 *
 * The script reads DATABASE_URL from apps/backend/.env automatically.
 * Never hardcode credentials — always supply the email at runtime.
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load .env from apps/backend/.env ─────────────────────────────────────────

const envPath = resolve(__dirname, "../.env");
try {
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env absent — DATABASE_URL must already be in environment
}

// ── Validate arguments ────────────────────────────────────────────────────────

const email = process.argv[2];
const role  = (process.argv[3] ?? "ADMIN").toUpperCase();

if (!email) {
  console.error("Usage: node scripts/promote-admin.mjs <email> [ADMIN|SUPER_ADMIN]");
  process.exit(1);
}

if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
  console.error(`Invalid role "${role}". Must be ADMIN or SUPER_ADMIN.`);
  process.exit(1);
}

// ── Promote ───────────────────────────────────────────────────────────────────

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

try {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!existing) {
    console.error(`No user found with email: ${email}`);
    console.error("Register first at /register, then re-run this script.");
    process.exit(1);
  }

  if (existing.role === role) {
    console.log(`User ${email} already has role ${role}. No change made.`);
    process.exit(0);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  console.log("\n── Promotion complete ─────────────────────────────────────");
  console.table([updated]);
  console.log(`\nThe user can now log in at /admin with their registered credentials.\n`);
} finally {
  await prisma.$disconnect();
}
