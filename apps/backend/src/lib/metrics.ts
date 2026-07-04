import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

export const registry = new Registry();
registry.setDefaultLabels({ service: "celebstyle-backend" });

collectDefaultMetrics({ register: registry });

// ── HTTP metrics ───────────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name:       "http_requests_total",
  help:       "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers:  [registry],
});

export const httpRequestDuration = new Histogram({
  name:       "http_request_duration_seconds",
  help:       "HTTP request latency",
  labelNames: ["method", "route", "status_code"],
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers:  [registry],
});

// ── Business metrics ───────────────────────────────────────────────────────────

export const activeUsers = new Gauge({
  name:      "celebstyle_active_users",
  help:      "Approximate active authenticated users",
  registers: [registry],
});

export const ordersCreated = new Counter({
  name:      "celebstyle_orders_created_total",
  help:      "Total orders created",
  registers: [registry],
});

export const recommendationsServed = new Counter({
  name:      "celebstyle_recommendations_served_total",
  help:      "Total AI recommendation requests",
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name:      "celebstyle_db_query_duration_seconds",
  help:      "Database query latency",
  labelNames: ["operation"],
  buckets:   [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers:  [registry],
});
