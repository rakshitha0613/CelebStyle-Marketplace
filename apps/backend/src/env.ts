const rawPort = process.env.PORT ?? "4000";
const port = Number(rawPort);

if (Number.isNaN(port) || port < 1 || port > 65535) {
  throw new Error(
    `[startup] PORT must be a valid port number (1-65535), got: "${rawPort}"`
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith("postgresql://")) {
  throw new Error(
    "[startup] DATABASE_URL must be set to a valid postgresql:// connection string"
  );
}

// DIRECT_URL is only required by Prisma CLI (migrate, seed) to bypass
// pgBouncer's transaction-mode DDL restriction. Prisma Client at runtime
// uses only DATABASE_URL. Default to DATABASE_URL so the app starts cleanly
// in environments that do not use a connection pooler.
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = databaseUrl;
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "[startup] JWT_SECRET must be set and at least 32 characters. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

// Payment provider — defaults to "simulated" so the app works without gateway credentials.
// Set to "razorpay", "stripe", or "cod" in production.
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? "simulated";

export const config = {
  port,
  jwtSecret,
  payment: {
    provider:               PAYMENT_PROVIDER,
    razorpayKeyId:          process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret:      process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret:  process.env.RAZORPAY_WEBHOOK_SECRET,
    stripeSecretKey:        process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret:    process.env.STRIPE_WEBHOOK_SECRET,
  },
} as const;
