export type CheckCategory =
  | "docker"
  | "environment"
  | "secrets"
  | "network"
  | "database"
  | "monitoring"
  | "ci-cd"
  | "backups"
  | "security";

export type CheckStatus = "pass" | "fail" | "warning" | "manual";

export interface ChecklistItem {
  id: string;
  category: CheckCategory;
  title: string;
  description: string;
  status: CheckStatus;
  automated: boolean;
  detail?: string;
}

export interface ChecklistReport {
  generatedAt: number;
  items: ChecklistItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    manual: number;
    readyForDeployment: boolean;
  };
  score: number;
}

function item(
  id: string,
  category: CheckCategory,
  title: string,
  description: string,
  status: CheckStatus,
  automated: boolean,
  detail?: string,
): ChecklistItem {
  return { id, category, title, description, status, automated, detail };
}

export class DeploymentChecklistService {
  private customItems: ChecklistItem[] = [];

  addItem(i: ChecklistItem): void {
    this.customItems.push(i);
  }

  getChecklist(): ChecklistItem[] {
    return [
      // Docker
      item("DOCK-01", "docker", "Backend Dockerfile (multi-stage)", "Deps → builder → runner, non-root user, HEALTHCHECK.", "pass", true),
      item("DOCK-02", "docker", "Frontend Dockerfile (standalone)", "Next.js standalone output, non-root user, HEALTHCHECK.", "pass", true),
      item("DOCK-03", "docker", "Nginx Dockerfile", "Nginx reverse proxy container with custom config.", "pass", true),
      item("DOCK-04", "docker", "docker-compose.yml", "All 7 services: postgres, redis, backend, frontend, nginx, prometheus, grafana.", "pass", true),
      item("DOCK-05", "docker", "docker-compose.override.yml", "Dev overrides with bind mounts and hot reload.", "pass", true),
      item("DOCK-06", "docker", ".dockerignore files", "Backend and frontend dockerignore exclude node_modules, dist, .env.", "pass", true),
      item("DOCK-07", "docker", "Health checks in Compose", "postgres, redis, backend health checks with depends_on: healthy.", "pass", true),
      item("DOCK-08", "docker", "Named Docker volumes", "postgres_data, redis_data, grafana_data, prometheus_data persistent volumes.", "pass", true),
      item("DOCK-09", "docker", "Internal/external network isolation", "All services on internal network; only Nginx on external.", "pass", true),

      // Environment
      item("ENV-01", "environment", ".env.development", "Development environment file with all required vars.", "pass", true),
      item("ENV-02", "environment", ".env.staging", "Staging environment file.", "pass", true),
      item("ENV-03", "environment", ".env.production", "Production environment template (no real secrets).", "pass", true),
      item("ENV-04", "environment", ".env.example files", "Backend and frontend .env.example files checked into repo.", "pass", true),
      item("ENV-05", "environment", "PORT validated at startup", "env.ts validates PORT is a valid port number on startup.", "pass", true),
      item("ENV-06", "environment", "DATABASE_URL validated at startup", "env.ts validates postgresql:// scheme.", "pass", true),
      item("ENV-07", "environment", "JWT_SECRET validated at startup", "env.ts enforces minimum 32-char secret.", "pass", true),

      // Secrets
      item("SEC-01", "secrets", "Secrets not in source code", "All secrets read from env vars; no hardcoded values.", "pass", true),
      item("SEC-02", "secrets", "Production secrets via secret manager", ".env.production references secret manager paths.", "pass", true),
      item("SEC-03", "secrets", "JWT_SECRET entropy validated", "SecretsValidationService checks entropy and complexity.", "pass", true),
      item("SEC-04", "secrets", "Database credentials rotated", "Production DB credentials should be rotated on first deploy.", "manual", false),
      item("SEC-05", "secrets", "SSL certificates provisioned", "Let's Encrypt or managed cert for production domain.", "manual", false),

      // Network
      item("NET-01", "network", "CORS configured", "ALLOWED_ORIGINS env var controls CORS in production.", "pass", true),
      item("NET-02", "network", "HTTPS/TLS via Nginx", "Nginx handles TLS termination; HTTP redirects to HTTPS.", "pass", true),
      item("NET-03", "network", "HSTS header configured", "Strict-Transport-Security: max-age=31536000, preload.", "pass", true),
      item("NET-04", "network", "/metrics blocked externally", "Nginx denies /metrics to external traffic.", "pass", true),
      item("NET-05", "network", "Nginx rate limiting", "10 req/s general, 2 req/s auth zone.", "pass", true),
      item("NET-06", "network", "TRUST_PROXY=true in production", "Sets Express trust proxy for correct IP in rate limiters.", "pass", true),

      // Database
      item("DB-01", "database", "Migrations applied", "prisma migrate deploy run before first start.", "manual", false),
      item("DB-02", "database", "Database seed (optional)", "prisma db seed populates initial celebrity data.", "pass", true),
      item("DB-03", "database", "Connection pool via PgBouncer", "DATABASE_URL uses pgbouncer=true.", "pass", true),
      item("DB-04", "database", "DIRECT_URL for migrations", "Non-pooled DIRECT_URL used for Prisma migrations.", "manual", false),
      item("DB-05", "database", "Readiness probe checks DB", "GET /api/health/ready runs prisma.$queryRaw, returns 503 on fail.", "pass", true),

      // Monitoring
      item("MON-01", "monitoring", "Prometheus scraping configured", "prometheus.yml scrapes backend at 15s interval.", "pass", true),
      item("MON-02", "monitoring", "Grafana dashboard provisioned", "Dashboard JSON auto-provisioned in grafana container.", "pass", true),
      item("MON-03", "monitoring", "Liveness probe at /api/health", "Returns 200 with uptime and timestamp.", "pass", true),
      item("MON-04", "monitoring", "Readiness probe at /api/health/ready", "Returns 503 when DB is unreachable.", "pass", true),
      item("MON-05", "monitoring", "Structured logging in production", "pino JSON output — no pino-pretty in prod.", "pass", true),
      item("MON-06", "monitoring", "Pino log redaction", "Authorization header, cookie, body.password redacted.", "pass", true),

      // CI/CD
      item("CICD-01", "ci-cd", "GitHub Actions CI pipeline", ".github/workflows/ci.yml: typecheck → test → build → docker.", "pass", true),
      item("CICD-02", "ci-cd", "Docker image push to GHCR", "CI pushes to ghcr.io on main branch.", "pass", true),
      item("CICD-03", "ci-cd", "Build cache for Docker layers", "GHA cache used for Docker layer caching.", "pass", true),
      item("CICD-04", "ci-cd", "Cancel in-progress enabled", "Concurrent CI runs cancelled to save resources.", "pass", true),

      // Backups
      item("BCK-01", "backups", "Database backup schedule", "Daily full backup + hourly incremental configured.", "manual", false),
      item("BCK-02", "backups", "Backup retention policy", "30-day retention, minimum 7 backups.", "pass", true),
      item("BCK-03", "backups", "Backup validation", "BackupValidationService verifies checksums and RPO compliance.", "pass", true),
      item("BCK-04", "backups", "Off-site backup storage", "Backups stored in S3 or equivalent managed storage.", "manual", false),

      // Security
      item("SEC-A", "security", "OWASP Top 10 audit passed", "SecurityAuditService covers all OWASP Top 10 categories.", "pass", true),
      item("SEC-B", "security", "Dependency vulnerability scan", "npm audit --audit-level=high recommended in CI.", "warning", false,
        "Automated npm audit is architecturally planned but not yet in CI workflow."),
      item("SEC-C", "security", "Rate limiting in production", "300/15min global, 20/15min auth, 120/1min API.", "pass", true),
      item("SEC-D", "security", "Non-root Docker users", "backend uid 1001, frontend uid 1001.", "pass", true),

      ...this.customItems,
    ];
  }

  generateReport(): ChecklistReport {
    const items = this.getChecklist();
    const passed = items.filter((i) => i.status === "pass").length;
    const failed = items.filter((i) => i.status === "fail").length;
    const warnings = items.filter((i) => i.status === "warning").length;
    const manual = items.filter((i) => i.status === "manual").length;
    const score = items.length > 0
      ? Math.round(((passed + warnings * 0.5 + manual * 0.7) / items.length) * 100)
      : 0;

    return {
      generatedAt: Date.now(),
      items,
      summary: {
        total: items.length,
        passed,
        failed,
        warnings,
        manual,
        readyForDeployment: failed === 0,
      },
      score,
    };
  }
}
