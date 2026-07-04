import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { httpRequestsTotal, httpRequestDuration } from "../lib/metrics.js";
import type { Request, Response } from "express";

const isDev = process.env.NODE_ENV !== "production";

function normaliseRoute(req: Request): string {
  const raw = req.route?.path ?? req.path ?? "unknown";
  return raw.replace(/\/[0-9a-f-]{8,}/gi, "/:id").replace(/\/\d+/g, "/:id");
}

// pino-http v10 creates its own logger internally; we configure it via options.
export const requestLoggerMiddleware = pinoHttp({
  level:          process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  autoLogging:    true,
  quietReqLogger: false,
  ...(isDev && {
    transport: {
      target:  "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
  base: { service: "celebstyle-backend" },
  redact: ["req.headers.authorization", "req.headers.cookie"],
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err: Error | undefined): string => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse): string =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (_req: IncomingMessage, _res: ServerResponse, err: Error): string =>
    `request errored: ${err.message}`,
  customProps: (req: IncomingMessage) => ({
    correlationId: (req as unknown as Request).correlationId,
    userAgent:     req.headers["user-agent"],
  }),
  serializers: {
    req: (req: IncomingMessage) => ({ method: req.method, url: req.url }),
    res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
  },
  wrapSerializers: false,
});

export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route    = normaliseRoute(req);
    const labels   = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });
  next();
}
