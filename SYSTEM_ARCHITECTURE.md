# CelebStyle — System Architecture

> Version 1.0.0 "Premiere" · July 2026

---

## Overview

CelebStyle is a celebrity fashion replica marketplace built as a full-stack monorepo. The platform lets users browse celebrity-worn outfits, virtually try them on using AR, receive AI-powered recommendations, and purchase high-quality replicas manufactured and shipped directly from verified partners.

---

## Monorepo Layout

```
CelebStyle/
├── apps/
│   ├── backend/          Express 5 + TypeScript — REST API server
│   └── frontend/         Next.js 15 + React 19 — SSR/CSR web app
├── nginx/                Nginx reverse proxy configuration
├── docker-compose.yml    7-service production stack
├── .github/workflows/    GitHub Actions CI/CD
└── package.json          npm workspaces root
```

---

## Backend Architecture

**Runtime**: Node.js 20+, Express 5, TypeScript (ESM, NodeNext module resolution)

### Layer Stack (top → bottom)

```
HTTP Request
    ↓
Nginx (rate limit, TLS termination)
    ↓
Express Middleware Stack:
  • Helmet (security headers)
  • Compression (gzip level 6)
  • CORS (origin validator)
  • Body parsing (express.json)
  • Cookie parser
  • Correlation ID injection
  • pino-http structured logger
  • Prometheus metrics recorder
  • Global rate limiter
    ↓
Route Handler (src/routes/*.ts)
    ↓
Service Layer (src/services/*.ts)
    ↓
Repository Layer (src/repositories/*.ts)
    ↓
Prisma ORM
    ↓
PostgreSQL (Supabase) via PgBouncer
```

### Key Backend Files

| Path | Purpose |
|---|---|
| `src/app.ts` | Express app factory — middleware + route wiring |
| `src/index.ts` | Server startup — env validation, listen |
| `src/env.ts` | Startup env validation (throws on invalid config) |
| `src/lib/logger.ts` | pino structured logger with redaction |
| `src/lib/metrics.ts` | Prometheus registry + counters/histograms |
| `src/lib/correlation.ts` | Correlation ID middleware |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/auth/` | JWT auth, RBAC middleware, email verification |
| `src/services/` | 53 business + infrastructure services |
| `src/routes/` | 25 route files covering all API domains |
| `src/repositories/` | Data access layer over Prisma |
| `src/__tests__/` | 35 test suites |

---

## Frontend Architecture

**Framework**: Next.js 15 App Router, React 19, Tailwind CSS

### Rendering Strategy

| Page | Strategy | Notes |
|---|---|---|
| `/` | Server-side (SSR) | Fetches celebrities + outfits at render time |
| `/celebrities` | SSR + client filter | Industry filter applied client-side |
| `/celebrities/[id]` | SSR | Outfit sections split by type |
| `/search` | SSR + client filter | All filters client-side |
| `/outfits/[id]` | SSR | Product page with cart integration |
| `/cart` | Client-side | localStorage cart |
| `/checkout` | Client-side | POSTs to backend |
| `/orders` | SSR | Order list |
| `/admin` | Client-side | CRUD for celebrities, outfits, manufacturers |
| `/try-on` | Client-side | WebGL + MediaPipe, camera only |

### Data Layer

All API calls go through `apps/frontend/lib/api.ts`:
- Uses `fetch()` with `cache: "no-store"` on all calls
- Points to `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:4000`)
- Cart state stored in `localStorage` under key `"celebstyle-cart"`

---

## Infrastructure Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│           Nginx (port 80/443)   │  ← External network only
│  • TLS termination              │
│  • Rate limiting (10r/s, 2r/s)  │
│  • Gzip compression             │
│  • /metrics blocked externally  │
└──────┬───────────────┬──────────┘
       │               │
       ▼               ▼
┌──────────┐    ┌──────────────┐
│ Frontend │    │   Backend    │  ← Internal network only
│ Next.js  │    │ Express 5   │
│ :3000    │    │ :4000       │
└──────────┘    └──────┬───────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │PostgreSQL│ │  Redis   │ │Prometheus│
    │ :5432    │ │  :6379   │ │  :9090   │
    └──────────┘ └──────────┘ └──────────┘
                                    │
                              ┌─────▼────┐
                              │ Grafana  │
                              │  :3001   │
                              └──────────┘
```

### Docker Compose Services

| Service | Image | Purpose |
|---|---|---|
| `postgres` | postgres:16-alpine | Primary database |
| `redis` | redis:7-alpine | Cache + session store |
| `backend` | ghcr.io/celebstyle/backend | Express API |
| `frontend` | ghcr.io/celebstyle/frontend | Next.js SSR |
| `nginx` | nginx:1.25-alpine | Reverse proxy |
| `prometheus` | prom/prometheus:v2.52.0 | Metrics collection |
| `grafana` | grafana/grafana:10.4.0 | Metrics dashboards |

---

## AI/ML Architecture

```
User Request
    ↓
RecommendationService
    ├── CollaborativeFilteringService (co-purchase graph)
    ├── SimilarityService (ProductEmbedding vectors)
    ├── RankingService (multi-signal scoring)
    ├── DiversityService (inject variety)
    └── ExperimentService (A/B traffic split)
         ↓
    RecommendationFeedback (impression/click/purchase loop)
         ↓
MLOps Pipeline:
    ├── ModelRegistryService (versioning)
    ├── ModelDeploymentService (blue/green, canary)
    ├── DriftDetectionService (KL divergence, PSI)
    ├── PredictionLoggingService (ground truth capture)
    └── MLOpsAlertService (degradation alerts)
```

---

## AR Platform Architecture

```
Browser Camera (WebRTC)
    ↓
MediaPipe Pose (Web Worker — local inference)
    ↓ 33 pose landmarks
BodyMeasurementService
    ↓ chest/shoulder/sleeve in cm
SizeRecommendationService
    ↓ recommended size + confidence
WebGL Overlay (GarmentOverlayService)
    ↓ texture mapped to body landmarks
OutfitComposerService (5 slots)
    ↓
OutfitScoringService (7 dimensions)
    ↓
WishlistOverlayService → localStorage cart
```

**Privacy Guarantees**:
- Camera frames never leave the device
- All ML inference runs locally in Web Workers
- No persistent recording — frames discarded each tick
- Snapshots require explicit user action (tap shutter)
- Remote upload is always opt-in

---

## Security Architecture

```
Request → Nginx (rate limit, TLS)
         → Helmet (CSP, HSTS, nosniff, X-Frame-Options)
         → CORS (origin allowlist in production)
         → express-rate-limit (global/auth/API tiers)
         → authenticate (JWT verification via jose)
         → authorize (RBAC role check)
         → Handler
```

**Auth Flow**:
```
POST /auth/register → bcryptjs hash (cost=12) → User created
POST /auth/login    → verify hash → issue accessToken (15m) + refreshToken (7d, httpOnly)
POST /auth/refresh  → rotate refreshToken → new accessToken
```

---

## Observability Architecture

```
Request → correlationId (UUID) injected
        → pino-http logs request/response with correlationId
        → metricsMiddleware increments Prometheus counters/histograms
        → TracingService records W3C Trace Context spans
        → Prometheus scrapes /metrics every 15s
        → Grafana queries Prometheus for dashboards
        → AlertingService evaluates 11 default rules
```

---

## Commission Model

| Recipient | Share |
|---|---|
| Manufacturer | 85% of subtotal |
| Platform | 10% of subtotal |
| Celebrity | 5% of subtotal |

Routing: the first `manufacturerId` in an outfit's `manufacturerIds` array is assigned the full manufacturer share.
