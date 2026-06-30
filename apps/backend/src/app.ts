import cors from "cors";
import express from "express";
import { celebritiesRouter } from "./routes/celebrities.js";
import { ordersRouter } from "./routes/orders.js";
import { outfitsRouter } from "./routes/outfits.js";
import { healthRouter } from "./routes/health.js";
import { manufacturersRouter } from "./routes/manufacturers.js";
import { storefrontsRouter } from "./routes/storefronts.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/health", healthRouter);
  app.use("/api/celebrities", celebritiesRouter);
  app.use("/api/outfits", outfitsRouter);
  app.use("/api/manufacturers", manufacturersRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/storefronts", storefrontsRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ message: "Unexpected server error" });
  });

  return app;
}
