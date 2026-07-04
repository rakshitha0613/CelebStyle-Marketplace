import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// Augment Express Request so req.correlationId and req.rawBody are typed throughout the app.
declare module "express-serve-static-core" {
  interface Request {
    correlationId: string;
    rawBody?: string;
  }
}

const HEADER = "x-correlation-id";

// Reads X-Correlation-ID from the incoming request (allows clients to trace
// their own request IDs end-to-end) or generates a fresh UUID when absent.
// The chosen / generated ID is echoed back in the response header so clients
// can correlate logs even when they did not provide their own ID.
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incoming = req.headers[HEADER];
  const id =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();
  req.correlationId = id;
  res.setHeader("X-Correlation-ID", id);
  next();
}
