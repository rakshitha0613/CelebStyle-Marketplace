import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./auth/auth.router.js";
import { celebritiesRouter } from "./routes/celebrities.js";
import { ordersRouter } from "./routes/orders.js";
import { outfitsRouter } from "./routes/outfits.js";
import { healthRouter } from "./routes/health.js";
import { metricsRouter } from "./routes/metrics.js";
import { manufacturersRouter } from "./routes/manufacturers.js";
import { storefrontsRouter } from "./routes/storefronts.js";
import { cartRouter } from "./routes/cart.js";
import { addressesRouter } from "./routes/addresses.js";
import { checkoutRouter } from "./routes/checkout.js";
import { paymentsRouter } from "./routes/payments.js";
import { warehousesRouter } from "./routes/warehouses.js";
import { inventoryRouter } from "./routes/inventory.js";
import { fulfillmentRouter } from "./routes/fulfillment.js";
import { returnsRouter } from "./routes/returns.js";
import { refundsRouter } from "./routes/refunds.js";
import { settlementsRouter, commissionsRouter } from "./routes/settlements.js";
import { invoicesRouter } from "./routes/invoices.js";
import { eventsRouter } from "./routes/events.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { feedbackRouter, analyticsRouter, experimentsRouter } from "./routes/feedback.js";
import { mlRouter } from "./routes/ml.js";
import { opsRouter } from "./routes/ops.js";
import { securityRouter } from "./routes/security.js";
import { releaseRouter } from "./routes/release.js";
import { profileRouter } from "./routes/profile.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { correlationIdMiddleware } from "./lib/correlation.js";
import { logger } from "./lib/logger.js";
import {
  helmetMiddleware,
  corsOriginValidator,
  globalRateLimit,
  authRateLimit,
  checkoutRateLimit,
  compressionMiddleware,
  TRUST_PROXY,
} from "./middleware/security.js";
import { requestLoggerMiddleware, metricsMiddleware } from "./middleware/request-logger.js";

export function createApp() {
  const app = express();

  // Trust proxy headers from Nginx (needed for correct req.ip in rate limiters)
  if (TRUST_PROXY) app.set("trust proxy", TRUST_PROXY);

  // ── Security headers & compression ──────────────────────────────────────────
  app.use(helmetMiddleware);
  app.use(compressionMiddleware);

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(cors({ origin: corsOriginValidator, credentials: true }));

  // ── Body parsing ─────────────────────────────────────────────────────────────
  app.use(
    express.json({
      verify: (_req, _res, buf) => {
        (_req as express.Request).rawBody = buf.toString("utf8");
      },
    })
  );
  app.use(cookieParser());

  // ── Observability ─────────────────────────────────────────────────────────────
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(metricsMiddleware);

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  app.use(globalRateLimit);

  // ── Internal / infrastructure routes (no rate limit) ─────────────────────────
  app.use("/api/health", healthRouter);
  app.use("/metrics", metricsRouter);

  // ── Auth (tighter rate limit) ─────────────────────────────────────────────────
  app.use("/api/auth", authRateLimit, authRouter);

  // ── Application routes ────────────────────────────────────────────────────────
  app.use("/api/celebrities", celebritiesRouter);
  app.use("/api/outfits", outfitsRouter);
  app.use("/api/manufacturers", manufacturersRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/storefronts", storefrontsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/checkout", checkoutRateLimit, checkoutRouter);
  app.use("/api/payments", checkoutRateLimit, paymentsRouter);
  app.use("/api/warehouses", warehousesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/fulfillment", fulfillmentRouter);
  app.use("/api/returns", returnsRouter);
  app.use("/api/refunds", refundsRouter);
  app.use("/api/settlements", settlementsRouter);
  app.use("/api/commissions", commissionsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/recommendations", recommendationsRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/experiments", experimentsRouter);
  app.use("/api/ml", mlRouter);
  app.use("/api/ops", opsRouter);
  app.use("/api/security", securityRouter);
  app.use("/api/release", releaseRouter);

  // ── Global error handler ──────────────────────────────────────────────────────
  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    logger.error({
      err:           error,
      correlationId: request.correlationId,
      method:        request.method,
      url:           request.url,
    }, "Unhandled request error");
    response.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
