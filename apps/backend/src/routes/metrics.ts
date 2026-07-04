import { Router } from "express";
import { registry } from "../lib/metrics.js";

export const metricsRouter = Router();

// Only accessible by internal scrapers — enforce via Nginx/network policy in production.
metricsRouter.get("/", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});
