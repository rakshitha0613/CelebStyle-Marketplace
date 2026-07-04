export interface SprintEntry {
  sprint: string;
  title: string;
  completedAt: string;
  highlights: string[];
  filesAdded: number;
  servicesAdded: number;
  testsAdded: number;
  breaking: boolean;
}

export interface ReleaseNote {
  version: string;
  releaseDate: string;
  codename: string;
  summary: string;
  sprints: SprintEntry[];
  apiBreakingChanges: string[];
  databaseChanges: string[];
  knownIssues: string[];
  upgradeSteps: string[];
}

const SPRINTS: SprintEntry[] = [
  {
    sprint: "1.0",
    title: "Foundation & Core Data Layer",
    completedAt: "2026-06-30",
    highlights: [
      "Monorepo setup with npm workspaces (backend + frontend)",
      "Express 5 backend with TypeScript ESM",
      "Next.js 15 App Router frontend with React 19 + Tailwind CSS",
      "In-memory celebrity and outfit stores with seed data (101 celebrities)",
      "Core pages: home, celebrities, search, outfits, cart, checkout, orders, storefronts",
      "Commission model: 85% manufacturer / 10% platform / 5% celebrity",
    ],
    filesAdded: 45,
    servicesAdded: 0,
    testsAdded: 5,
    breaking: false,
  },
  {
    sprint: "2.0",
    title: "Database Migration & Repository Layer",
    completedAt: "2026-07-01",
    highlights: [
      "PostgreSQL via Prisma 6 with 88 database models",
      "PgBouncer connection pooling (transaction mode)",
      "Repository pattern for celebrities, manufacturers, products, orders, storefronts",
      "Environment validation at startup (PORT, DATABASE_URL, JWT_SECRET)",
    ],
    filesAdded: 20,
    servicesAdded: 5,
    testsAdded: 6,
    breaking: false,
  },
  {
    sprint: "3.0",
    title: "Authentication & Authorization",
    completedAt: "2026-07-02",
    highlights: [
      "JWT authentication with jose (HS256, 15m access / 7d refresh)",
      "Refresh token rotation with revokedAt guard",
      "Email verification flow with single-use tokens",
      "Password reset with secure tokens",
      "8-role RBAC: CUSTOMER, CELEBRITY, ADMIN, SUPER_ADMIN, MANUFACTURER_PARTNER, CELEBRITY_MANAGER, CONTENT_MODERATOR, ANALYST",
      "authenticate + authorize middleware guards",
      "optionalAuth for public+authenticated routes",
    ],
    filesAdded: 15,
    servicesAdded: 6,
    testsAdded: 6,
    breaking: false,
  },
  {
    sprint: "4.0",
    title: "Commerce Platform",
    completedAt: "2026-07-03",
    highlights: [
      "Cart management with localStorage + backend sync",
      "Address book with default address support",
      "Checkout flow with inventory reservation",
      "Simulated payment processing (Razorpay interface)",
      "Order lifecycle management (AWAITING_PAYMENT → DELIVERED)",
      "Returns, refunds, settlements, invoice generation",
      "Multi-warehouse inventory management",
      "Coupon and discount system",
    ],
    filesAdded: 28,
    servicesAdded: 12,
    testsAdded: 7,
    breaking: false,
  },
  {
    sprint: "5.0",
    title: "AI Recommendation Engine & MLOps",
    completedAt: "2026-07-03",
    highlights: [
      "Vector embeddings for products and users (pgvector)",
      "Collaborative filtering with co-purchase graph",
      "Content-based similarity recommendations",
      "Diversity injection and cold-start handling",
      "A/B experiment framework with traffic splitting",
      "Recommendation feedback loop (impression → click → purchase → conversion)",
      "MLOps: model registry, versioning, blue/green and canary deployment",
      "Feature drift detection (KL divergence, PSI)",
      "Prediction logging with ground truth capture",
    ],
    filesAdded: 22,
    servicesAdded: 14,
    testsAdded: 7,
    breaking: false,
  },
  {
    sprint: "6.0",
    title: "AR Platform & Virtual Try-On",
    completedAt: "2026-07-03",
    highlights: [
      "MediaPipe pose landmark detection (33 keypoints)",
      "WebGL garment overlay with texture mapping and transparency",
      "3D mesh deformation for body shape fitting",
      "Body measurement estimation (chest, shoulder, sleeve) from landmarks",
      "Size recommendation engine with standard + brand-specific charts",
      "Outfit composer with 5 slots (top, bottom, jacket, shoes, accessory)",
      "7-dimension outfit scoring (colorHarmony, styleCompat, season, trending, occasion, personal, celebrity similarity)",
      "Wishlist overlay with cart integration and shareable URL generation",
      "Privacy: camera frames local-only, no persistent recording, explicit snapshot only",
    ],
    filesAdded: 18,
    servicesAdded: 5,
    testsAdded: 5,
    breaking: false,
  },
  {
    sprint: "7.0",
    title: "Production Infrastructure, Monitoring & Security",
    completedAt: "2026-07-04",
    highlights: [
      "Docker multi-stage builds for backend and frontend",
      "Docker Compose with 7 services and internal/external network isolation",
      "Nginx reverse proxy with rate limiting, gzip, HSTS, CSP",
      "pino structured logging with field redaction",
      "Prometheus metrics (counters, histograms, gauges) + Grafana dashboards",
      "Correlation ID middleware for request tracing",
      "Helmet security headers (CSP, HSTS, X-Frame-Options)",
      "Global + auth + API rate limiting (express-rate-limit)",
      "GitHub Actions CI/CD: typecheck → test → build → GHCR",
      "MonitoringService: CPU/memory/disk/request/business metrics",
      "AlertingService: 11 rules with cooldown, acknowledge, history",
      "ScalingService: graceful shutdown, connection pooling, stateless validation",
      "TracingService: W3C Trace Context, span lifecycle, context injection/extraction",
      "SecurityAuditService: OWASP Top 10 coverage, 40+ checks, weighted scoring",
      "RateLimitService: per-route rules, IP allowlist/denylist, adaptive throttling",
      "BackupValidationService: RPO/RTO compliance, checksum validation",
      "RecoveryService: circuit breakers, retry policies, failover configuration",
      "ProductionReadinessService: weighted multi-dimension scoring",
      "DeploymentChecklistService: 48 automated + manual deployment items",
      "ReleaseAuditService: per-subsystem audit with 100+ checks",
    ],
    filesAdded: 35,
    servicesAdded: 12,
    testsAdded: 4,
    breaking: false,
  },
];

export class ReleaseNotesService {
  generateReleaseNote(version = "1.0.0"): ReleaseNote {
    return {
      version,
      releaseDate: "2026-07-04",
      codename: "Premiere",
      summary:
        "CelebStyle v1.0.0 'Premiere' is the first production release of the Celebrity Fashion Replica Marketplace. " +
        "This release includes a complete e-commerce platform, AI-powered recommendation engine, " +
        "augmented reality virtual try-on system, and enterprise-grade production infrastructure.",
      sprints: SPRINTS,
      apiBreakingChanges: [],
      databaseChanges: [
        "Initial schema: 88 Prisma models across all business domains",
        "PgBouncer connection pooling enabled via pgbouncer=true in DATABASE_URL",
        "Soft delete pattern on User model (deletedAt field)",
        "Vector embeddings via pgvector extension (ProductEmbedding, UserEmbedding)",
      ],
      knownIssues: [
        "Redis recommendation cache not yet wired to live ML pipeline (TD-01) — each request recomputes ML inference",
        "npm audit not in CI pipeline (TD-02) — dependency scanning is manual",
        "Brotli compression not configured in Nginx (TD-03)",
        "No E2E test suite (TD-08) — Playwright planned for v1.1",
      ],
      upgradeSteps: [
        "1. Pull latest Docker images from GHCR",
        "2. Run 'prisma migrate deploy' against production database",
        "3. Update .env.production with new environment variables",
        "4. Perform rolling restart of backend containers",
        "5. Verify /api/health/ready returns 200",
        "6. Verify Prometheus scraping is operational",
        "7. Run smoke tests against staging environment",
      ],
    };
  }

  getSprintHistory(): SprintEntry[] {
    return SPRINTS;
  }

  getTotalStats(): { filesAdded: number; servicesAdded: number; testsAdded: number; sprintsCompleted: number } {
    return SPRINTS.reduce(
      (acc, s) => ({
        filesAdded: acc.filesAdded + s.filesAdded,
        servicesAdded: acc.servicesAdded + s.servicesAdded,
        testsAdded: acc.testsAdded + s.testsAdded,
        sprintsCompleted: acc.sprintsCompleted + 1,
      }),
      { filesAdded: 0, servicesAdded: 0, testsAdded: 0, sprintsCompleted: 0 },
    );
  }
}
