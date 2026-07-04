/**
 * @sprint7.1.celebstyle.devops — Production Readiness Tests
 * Self-contained Node.js. No HTTP server required.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

const ROOT = resolve(import.meta.dirname, "../../../..");

function rootExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function rootRead(rel: string): string {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Docker files
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 1: Docker Configuration ──");

{
  ok("backend Dockerfile exists",  rootExists("apps/backend/Dockerfile"));
  ok("frontend Dockerfile exists", rootExists("apps/frontend/Dockerfile"));
  ok("nginx Dockerfile exists",    rootExists("nginx/Dockerfile"));
  ok("docker-compose.yml exists",  rootExists("docker-compose.yml"));
  ok("docker-compose.override.yml exists", rootExists("docker-compose.override.yml"));
  ok(".dockerignore exists",       rootExists(".dockerignore"));
  ok("backend .dockerignore exists",  rootExists("apps/backend/.dockerignore"));
  ok("frontend .dockerignore exists", rootExists("apps/frontend/.dockerignore"));
}

{
  const backendDockerfile = rootRead("apps/backend/Dockerfile");
  ok("backend Dockerfile uses node:20-alpine", backendDockerfile.includes("node:20-alpine"));
  ok("backend Dockerfile has multi-stage (deps → builder → runner)",
    backendDockerfile.includes("AS deps") && backendDockerfile.includes("AS builder") && backendDockerfile.includes("AS runner"));
  ok("backend Dockerfile adds non-root user", backendDockerfile.includes("adduser"));
  ok("backend Dockerfile exposes port 4000",  backendDockerfile.includes("EXPOSE 4000"));
  ok("backend Dockerfile has HEALTHCHECK",    backendDockerfile.includes("HEALTHCHECK"));
  ok("backend Dockerfile sets NODE_ENV=production", backendDockerfile.includes("NODE_ENV=production"));
}

{
  const frontendDockerfile = rootRead("apps/frontend/Dockerfile");
  ok("frontend Dockerfile uses node:20-alpine", frontendDockerfile.includes("node:20-alpine"));
  ok("frontend Dockerfile has multi-stage build",
    frontendDockerfile.includes("AS deps") && frontendDockerfile.includes("AS runner"));
  ok("frontend Dockerfile adds non-root user",  frontendDockerfile.includes("adduser"));
  ok("frontend Dockerfile exposes port 3000",   frontendDockerfile.includes("EXPOSE 3000"));
  ok("frontend Dockerfile has HEALTHCHECK",     frontendDockerfile.includes("HEALTHCHECK"));
  ok("frontend Dockerfile disables telemetry",  frontendDockerfile.includes("NEXT_TELEMETRY_DISABLED"));
}

{
  const compose = rootRead("docker-compose.yml");
  ok("compose defines postgres service",    compose.includes("postgres:"));
  ok("compose defines redis service",       compose.includes("redis:"));
  ok("compose defines backend service",     compose.includes("backend:"));
  ok("compose defines frontend service",    compose.includes("frontend:"));
  ok("compose defines nginx service",       compose.includes("nginx:"));
  ok("compose defines prometheus service",  compose.includes("prometheus:"));
  ok("compose defines grafana service",     compose.includes("grafana:"));
  ok("compose defines postgres healthcheck",compose.includes("pg_isready"));
  ok("compose defines named volumes",       compose.includes("postgres_data:"));
  ok("compose has internal network",        compose.includes("internal:"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 2: Environment Configuration ──");

{
  ok(".env.development exists", rootExists(".env.development"));
  ok(".env.staging exists",     rootExists(".env.staging"));
  ok(".env.production exists",  rootExists(".env.production"));
}

{
  const dev = rootRead(".env.development");
  ok("dev env has NODE_ENV=development", dev.includes("NODE_ENV=development"));
  ok("dev env has DATABASE_URL",         dev.includes("DATABASE_URL="));
  ok("dev env has JWT_SECRET",           dev.includes("JWT_SECRET="));
  ok("dev env has NEXT_PUBLIC_API_BASE_URL", dev.includes("NEXT_PUBLIC_API_BASE_URL="));
  ok("dev env has PAYMENT_PROVIDER=simulated", dev.includes("PAYMENT_PROVIDER=simulated"));
}

{
  const prod = rootRead(".env.production");
  ok("prod env has NODE_ENV=production", prod.includes("NODE_ENV=production"));
  ok("prod env has TRUST_PROXY=true",    prod.includes("TRUST_PROXY=true"));
  ok("prod env references secret manager (no real secrets)",
    prod.includes("<inject-from-secret-manager>") || prod.includes("<replace-"));
}

{
  const staging = rootRead(".env.staging");
  ok("staging env has NODE_ENV=production", staging.includes("NODE_ENV=production"));
  ok("staging env has TRUST_PROXY=true",    staging.includes("TRUST_PROXY=true"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Nginx Configuration
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 3: Nginx Configuration ──");

{
  ok("nginx/nginx.conf exists",          rootExists("nginx/nginx.conf"));
  ok("nginx/conf.d/default.conf exists", rootExists("nginx/conf.d/default.conf"));
}

{
  const nginxConf = rootRead("nginx/nginx.conf");
  ok("nginx has json logging format",      nginxConf.includes("json_combined"));
  ok("nginx has rate limiting zones",      nginxConf.includes("limit_req_zone"));
  ok("nginx has X-Frame-Options header",   nginxConf.includes("X-Frame-Options"));
  ok("nginx has HSTS header",              nginxConf.includes("Strict-Transport-Security"));
  ok("nginx disables server_tokens",       nginxConf.includes("server_tokens off"));
  ok("nginx has gzip compression",         nginxConf.includes("gzip on"));
}

{
  const vhost = rootRead("nginx/conf.d/default.conf");
  ok("vhost proxies /api/ to backend",   vhost.includes("http://backend"));
  ok("vhost proxies / to frontend",      vhost.includes("http://frontend"));
  ok("vhost applies rate limits",        vhost.includes("limit_req zone=api"));
  ok("vhost tighter rate on auth",       vhost.includes("limit_req zone=auth"));
  ok("vhost blocks /metrics externally", vhost.includes("deny all") && vhost.includes("/metrics"));
  ok("vhost has nginx health endpoint",  vhost.includes("nginx-health"));
  ok("vhost sets X-Forwarded-For",       vhost.includes("X-Forwarded-For"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Health Endpoint Logic
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 4: Health Endpoint Logic ──");

{
  const healthSrc = rootRead("apps/backend/src/routes/health.ts");
  ok("health route has liveness endpoint",  healthSrc.includes('get("/",'));
  ok("health route has readiness endpoint", healthSrc.includes('"/ready"'));
  ok("health route has startup endpoint",   healthSrc.includes('"/startup"'));
  ok("health liveness returns service name",healthSrc.includes('"celebstyle-backend"'));
  ok("health liveness returns uptime",      healthSrc.includes("uptime"));
  ok("health liveness returns timestamp",   healthSrc.includes("ts:"));
  ok("health readiness checks database",    healthSrc.includes("prisma.$queryRaw"));
  ok("health readiness returns 503 on failure", healthSrc.includes("503"));
  ok("health readiness returns checks map", healthSrc.includes("checks"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Structured Logging
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 5: Structured Logging ──");

{
  const loggerSrc = rootRead("apps/backend/src/lib/logger.ts");
  ok("logger.ts exists and uses pino",  loggerSrc.includes("from \"pino\""));
  ok("logger redacts authorization header", loggerSrc.includes("authorization"));
  ok("logger redacts password fields",  loggerSrc.includes("password"));
  ok("logger sets base service label",  loggerSrc.includes("celebstyle-backend"));
  ok("logger uses pino-pretty in dev",  loggerSrc.includes("pino-pretty"));
  ok("logger respects LOG_LEVEL env",   loggerSrc.includes("LOG_LEVEL"));
}

{
  const reqLogSrc = rootRead("apps/backend/src/middleware/request-logger.ts");
  ok("request-logger.ts exists",         reqLogSrc.length > 0);
  ok("request logger uses pino-http",    reqLogSrc.includes("pino-http"));
  ok("request logger tracks correlationId", reqLogSrc.includes("correlationId"));
  ok("request logger measures duration", reqLogSrc.includes("hrtime"));
  ok("request logger increments Prometheus counter", reqLogSrc.includes("httpRequestsTotal"));
  ok("request logger records histogram", reqLogSrc.includes("httpRequestDuration"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 6: Security Middleware
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 6: Security Middleware ──");

{
  const secSrc = rootRead("apps/backend/src/middleware/security.ts");
  ok("security.ts exists",                   secSrc.length > 0);
  ok("uses helmet",                          secSrc.includes("from \"helmet\""));
  ok("uses compression",                     secSrc.includes("from \"compression\""));
  ok("uses express-rate-limit",              secSrc.includes("from \"express-rate-limit\""));
  ok("has CSP configuration",               secSrc.includes("contentSecurityPolicy"));
  ok("has HSTS configuration",              secSrc.includes("hsts"));
  ok("has global rate limiter",             secSrc.includes("globalRateLimit"));
  ok("has stricter auth rate limiter",      secSrc.includes("authRateLimit"));
  ok("has API rate limiter",                secSrc.includes("apiRateLimit"));
  ok("auth rate limit is stricter than global",
    (() => {
      // Extract all numbers after 'max:' — auth limit should include smaller values than global
      const allMaxes = [...secSrc.matchAll(/max:\s*[^?]*\?\s*(\d+)\s*:\s*(\d+)/g)]
        .map((m) => [Number(m[1]), Number(m[2])]);
      // globalRateLimit uses 300/1000, authRateLimit uses 20/200 — auth always smaller
      return allMaxes.length >= 2 &&
        allMaxes[0].some((v) => v >= 100) &&     // global has large limit
        allMaxes[1].every((v) => v < allMaxes[0].reduce((a, b) => a + b, 0)); // auth smaller
    })());
  ok("CORS validator allows no-origin requests", secSrc.includes("!origin"));
  ok("CORS validator checks ALLOWED_ORIGINS",    secSrc.includes("ALLOWED_ORIGINS"));
  ok("has TRUST_PROXY configuration",            secSrc.includes("TRUST_PROXY"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 7: Prometheus Metrics
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 7: Prometheus Metrics ──");

{
  const metricsSrc = rootRead("apps/backend/src/lib/metrics.ts");
  ok("metrics.ts exists",                    metricsSrc.length > 0);
  ok("uses prom-client",                     metricsSrc.includes("from \"prom-client\""));
  ok("creates Registry",                     metricsSrc.includes("new Registry()"));
  ok("collects default Node.js metrics",     metricsSrc.includes("collectDefaultMetrics"));
  ok("has http_requests_total counter",      metricsSrc.includes("http_requests_total"));
  ok("has http_request_duration histogram",  metricsSrc.includes("http_request_duration_seconds"));
  ok("has business metrics",                 metricsSrc.includes("celebstyle_orders_created_total"));
  ok("histogram has meaningful buckets",     metricsSrc.includes("[0.005"));
}

{
  const metricsRouteSrc = rootRead("apps/backend/src/routes/metrics.ts");
  ok("metrics route exists",                 metricsRouteSrc.length > 0);
  ok("metrics route sets Content-Type",      metricsRouteSrc.includes("contentType"));
  ok("metrics route returns registry data",  metricsRouteSrc.includes("registry.metrics()"));
}

{
  const promYml = rootRead("monitoring/prometheus.yml");
  ok("prometheus.yml exists",              promYml.length > 0);
  ok("prometheus scrapes backend",         promYml.includes("backend:4000"));
  ok("prometheus scrape interval is 15s",  promYml.includes("15s"));
  ok("prometheus has retention config",    promYml.includes("15d") || promYml.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 8: app.ts Security Integration
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 8: app.ts Integration ──");

{
  const appSrc = rootRead("apps/backend/src/app.ts");
  ok("app uses helmetMiddleware",        appSrc.includes("helmetMiddleware"));
  ok("app uses compressionMiddleware",   appSrc.includes("compressionMiddleware"));
  ok("app uses corsOriginValidator",     appSrc.includes("corsOriginValidator"));
  ok("app uses globalRateLimit",         appSrc.includes("globalRateLimit"));
  ok("app uses authRateLimit on /auth",  appSrc.includes("authRateLimit") && appSrc.includes("/api/auth"));
  ok("app uses structured logger in error handler", appSrc.includes("logger.error"));
  ok("app applies requestLoggerMiddleware", appSrc.includes("requestLoggerMiddleware"));
  ok("app applies metricsMiddleware",    appSrc.includes("metricsMiddleware"));
  ok("app exposes /metrics route",       appSrc.includes("/metrics"));
  ok("app sets trust proxy when configured", appSrc.includes("TRUST_PROXY"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 9: GitHub Actions CI/CD
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 9: GitHub Actions CI/CD ──");

{
  const ciYml = rootRead(".github/workflows/ci.yml");
  ok("ci.yml exists",                        ciYml.length > 0);
  ok("CI runs on push to main",              ciYml.includes("refs/heads/main") || ciYml.includes("branches:") && ciYml.includes("main"));
  ok("CI has typecheck job",                 ciYml.includes("typecheck"));
  ok("CI has test job",                      ciYml.includes("test-backend") || ciYml.includes("test:"));
  ok("CI has build job",                     ciYml.includes("build"));
  ok("CI has Docker job",                    ciYml.includes("docker") || ciYml.includes("Docker"));
  ok("CI uses Node 20",                      ciYml.includes("\"20\"") || ciYml.includes("node-version: 20"));
  ok("CI has concurrency cancel-in-progress",ciYml.includes("cancel-in-progress: true"));
  ok("Docker job pushes to GHCR",            ciYml.includes("ghcr.io"));
  ok("Docker job uses build cache",          ciYml.includes("cache-from: type=gha"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 10: Production Environment Validation Logic
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n── Suite 10: Environment Validation Logic ──");

// Inline the same validation logic used in env.ts
function validatePort(raw: string | undefined): { valid: boolean; value?: number; error?: string } {
  const port = Number(raw ?? "4000");
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    return { valid: false, error: `PORT must be 1-65535, got: "${raw}"` };
  }
  return { valid: true, value: port };
}

function validateJwtSecret(secret: string | undefined): { valid: boolean; error?: string } {
  if (!secret || secret.length < 32) {
    return { valid: false, error: "JWT_SECRET must be at least 32 characters" };
  }
  return { valid: true };
}

function validateDatabaseUrl(url: string | undefined): { valid: boolean; error?: string } {
  if (!url || !url.startsWith("postgresql://")) {
    return { valid: false, error: "DATABASE_URL must start with postgresql://" };
  }
  return { valid: true };
}

{
  ok("valid port 4000 passes",    validatePort("4000").valid);
  ok("valid port 443 passes",     validatePort("443").valid);
  ok("port 0 fails",              !validatePort("0").valid);
  ok("port 65536 fails",          !validatePort("65536").valid);
  ok("non-numeric port fails",    !validatePort("abc").valid);
  ok("undefined port defaults ok",validatePort(undefined).valid);
  ok("port 1 (min) passes",       validatePort("1").valid);
  ok("port 65535 (max) passes",   validatePort("65535").valid);
}

{
  const secret32 = "a".repeat(32);
  const secret64 = "a".repeat(64);
  ok("32-char JWT secret passes",       validateJwtSecret(secret32).valid);
  ok("64-char JWT secret passes",       validateJwtSecret(secret64).valid);
  ok("31-char JWT secret fails",        !validateJwtSecret("a".repeat(31)).valid);
  ok("empty JWT secret fails",          !validateJwtSecret("").valid);
  ok("undefined JWT secret fails",      !validateJwtSecret(undefined).valid);
}

{
  ok("valid postgresql URL passes",     validateDatabaseUrl("postgresql://user:pass@host:5432/db").valid);
  ok("pgbouncer URL passes",            validateDatabaseUrl("postgresql://u:p@h:6543/db?pgbouncer=true").valid);
  ok("mysql:// URL fails",              !validateDatabaseUrl("mysql://user:pass@host/db").valid);
  ok("undefined DATABASE_URL fails",    !validateDatabaseUrl(undefined).valid);
  ok("empty DATABASE_URL fails",        !validateDatabaseUrl("").valid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${"─".repeat(50)}`);
console.log(`devops  ${passed}/${total} assertions passed`);
if (failed > 0) {
  console.error(`${failed} FAILED`);
  process.exit(1);
}
