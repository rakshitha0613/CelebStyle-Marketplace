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

// Cloudinary — optional; falls back to URL passthrough when not set.
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;

// Redis — optional; falls back to in-memory cache when not set.
const REDIS_URL = process.env.REDIS_URL;

// Email / SMTP — optional; disables email dispatch when not set.
const SMTP_HOST    = process.env.SMTP_HOST;
const SMTP_PORT    = Number(process.env.SMTP_PORT   ?? "587");
const SMTP_USER    = process.env.SMTP_USER;
const SMTP_PASS    = process.env.SMTP_PASS;
const EMAIL_FROM   = process.env.EMAIL_FROM ?? "noreply@celebstyle.in";

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
  cloudinary: {
    url: CLOUDINARY_URL,
    enabled: !!CLOUDINARY_URL,
  },
  redis: {
    url:     REDIS_URL,
    enabled: !!REDIS_URL,
  },
  email: {
    host:    SMTP_HOST,
    port:    SMTP_PORT,
    user:    SMTP_USER,
    pass:    SMTP_PASS,
    from:    EMAIL_FROM,
    enabled: !!(SMTP_HOST && SMTP_USER && SMTP_PASS),
  },
} as const;
