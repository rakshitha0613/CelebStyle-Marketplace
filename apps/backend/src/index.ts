import { createApp } from "./app.js";
import { config } from "./env.js";
import { prisma } from "./lib/prisma.js";
import { runSeed } from "./lib/seeder.js";
import { seedAdminDemoData } from "./data/admin-demo-seed.js";

const app = createApp();

try {
  await prisma.$connect();
} catch (dbErr) {
  console.warn("Database unavailable — Prisma-backed routes will return 503. In-memory routes are fully operational.", dbErr instanceof Error ? dbErr.message : dbErr);
}

app.listen(config.port, () => {
  console.log(`CelebStyle backend listening on port ${config.port}`);
});

// Seed catalogue + admin user (idempotent upserts — runs after server is live).
// Then seed admin demo data (100 users, 250 orders, 40 returns, blog posts, etc.)
setImmediate(async () => {
  try {
    await runSeed(prisma);
    await seedAdminDemoData(prisma);
  } catch (err) {
    console.error("Seed failed (non-fatal):", err);
  }
});
