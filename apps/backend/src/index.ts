import { createApp } from "./app.js";
import { config } from "./env.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();

// Establish the Prisma / PgBouncer connection before accepting requests.
// Without this, the first inbound request races the cold-start pool setup
// and the DB query can time out, returning HTTP 500.
await prisma.$connect();

app.listen(config.port, () => {
  console.log(`CelebStyle backend listening on port ${config.port}`);
});
