# CelebStyle — Celebrity Fashion Replica Marketplace

> **Version 1.0.0** · Production Release · July 2026  
> *"Wear What Your Icon Wears"*

CelebStyle is a full-stack e-commerce platform where fans can discover, try on (AR), and purchase replica outfits worn by their favourite celebrities. Built over 7 sprints as Project 10 of the VortexIQ Developer Portfolio.

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Install

```bash
npm install   # installs both apps via npm workspaces
```

### Run (two terminals)

```bash
# Terminal 1 — backend
npm run dev:backend      # → http://localhost:4000

# Terminal 2 — frontend
npm run dev:frontend     # → http://localhost:3000
```

No database setup required for development — the backend uses in-memory stores seeded from `apps/backend/src/data/celebs-seed.json`.

---

## Pages

| URL | Description |
|---|---|
| `/` | Home — featured celebrities and outfit grid |
| `/celebrities` | Browse 101 celebrities grouped by industry |
| `/celebrities/[id]` | Celebrity profile — bio, style tags, outfit archive by occasion |
| `/search` | Full-text + multi-filter search (occasion, category, celebrity, colour) |
| `/outfits/[id]` | Product page — gallery, size selector, add to cart, manufacturers |
| `/cart` | Cart with remove/clear, subtotal + shipping (free ≥ ₹25,000) |
| `/checkout` | Order form with simulated Razorpay payment |
| `/orders` | All orders list |
| `/orders/[id]` | Order detail — status tracker, commission breakdown, manufacturer routing |
| `/storefronts` | Celebrity brand pages with commission dashboard |
| `/storefronts/[id]` | Individual storefront with outfit grid |
| `/admin` | CMS — full CRUD for celebrities, outfits, and manufacturers |

---

## API

Base URL: `http://localhost:4000`

| Domain | Base path | Auth |
|---|---|---|
| Authentication | `/api/auth/*` | varies |
| Celebrities | `/api/celebrities` | public (read), ADMIN (write) |
| Outfits | `/api/outfits` | public (read), ADMIN (write) |
| Manufacturers | `/api/manufacturers` | public (read), ADMIN (write) |
| Cart | `/api/cart` | JWT |
| Addresses | `/api/addresses` | JWT |
| Orders | `/api/orders` | JWT |
| Checkout | `/api/checkout` | JWT |
| Returns | `/api/returns` | JWT |
| Inventory | `/api/inventory` | ADMIN |
| Storefronts | `/api/storefronts` | public (read) |
| Recommendations | `/api/recommendations` | JWT |
| ML / MLOps | `/api/ml/*` | ADMIN, SUPER_ADMIN |
| Operations | `/api/ops/*` | ADMIN, SUPER_ADMIN |
| Security | `/api/security/*` | ADMIN, SUPER_ADMIN |
| Release | `/api/release/status`, `/version` | public |
| Release report | `/api/release/report` | ADMIN, SUPER_ADMIN |
| Health | `/api/health` | public |

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint reference.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 · Express 5 · TypeScript · tsx |
| Frontend | Next.js 15 · React 19 · Tailwind CSS |
| Database | PostgreSQL 15 + pgvector (Prisma 6) |
| Auth | jose (JWT HS256) · bcryptjs · httpOnly cookies |
| AR | MediaPipe Pose · WebGL · Web Workers |
| AI | pgvector similarity · collaborative filtering · MLOps |
| Logging | pino · pino-http (structured, redacted) |
| Infra | Docker Compose · Nginx · Prometheus · Grafana |
| CI/CD | GitHub Actions |

---

## Commission Model

On every order:
- **Platform fee:** 10% of subtotal
- **Celebrity commission:** 5% of subtotal
- **Manufacturer share:** 85% of subtotal
- **Routing:** first `manufacturerId` in the outfit's array receives payment
- **Free shipping:** orders ≥ ₹25,000; otherwise ₹499

---

## Architecture

```
apps/
  backend/   Express 5 + TypeScript
    src/
      auth/          JWT middleware + helpers
      lib/           Email, Redis, shared utilities
      payments/      Razorpay integration
      repositories/  Prisma data access layer
      routes/        25 Express route files
      services/      53 business logic services
      __tests__/     Test suites (550+ assertions)
  frontend/  Next.js 15 App Router
    app/             14 pages
    components/      AR, cart, checkout, celebrity UI
    lib/             api.ts, cart hooks
```

See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) for the full architecture diagram.

---

## Security

- JWT (HS256, 15 min TTL) + rotating refresh tokens (httpOnly cookie)
- bcryptjs password hashing (cost 12)
- 8-role RBAC system with `authenticate` + `authorize` middleware
- Helmet security headers (CSP, HSTS, nosniff)
- Rate limiting: global 300/15min, auth 20/15min, adaptive throttling
- OWASP Top 10 audited via `SecurityAuditService`
- AR: all camera processing local-only (Web Workers), no data transmitted

See [SECURITY_GUIDE.md](SECURITY_GUIDE.md) for full security documentation.

---

## Production Deployment

```bash
docker compose --env-file .env.production up -d
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions including SSL, CI/CD, and rollback.

---

## Documentation

| Document | Description |
|---|---|
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Architecture overview, service map, infrastructure diagram |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Local dev, Docker, SSL, CI/CD, backup, rollback |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | OWASP audit, auth flow, RBAC, rate limiting, incident response |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Full API endpoint reference with examples |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | 88 Prisma models, enums, indexes, migration guide |
| [AI_DOCUMENTATION.md](AI_DOCUMENTATION.md) | Recommendation pipeline, MLOps, A/B testing, feature store |
| [AR_DOCUMENTATION.md](AR_DOCUMENTATION.md) | Virtual try-on, privacy architecture, service reference |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, conventions, PR checklist |
| [CHANGELOG.md](CHANGELOG.md) | Full version history across all 7 sprints |

---

## Build & Type-check

```bash
npm run build           # both workspaces
npm run typecheck       # both workspaces

# Backend only
npm run build:backend
cd apps/backend && npm run typecheck

# Frontend only
npm run build:frontend
cd apps/frontend && npm run typecheck
```

---

## Tests

```bash
cd apps/backend

npm run test:devops    # 145 assertions — Docker, Nginx, logging, CI/CD
npm run test:ops       # 108 assertions — monitoring, alerting, tracing
npm run test:security  # 115 assertions — OWASP audit, rate limiting, secrets
npm run test:release   # 82  assertions — release audit, checklist, launch verification
```

---

## Project Statistics

| Metric | Value |
|---|---|
| Sprints | 7 |
| Backend services | 53 |
| Route files | 25 |
| Database models | 88 |
| API endpoints | 120+ |
| Frontend pages | 14 |
| Docker services | 7 |
| Test assertions | 550+ |
| Lines of code | ~25,000 |
| Documentation files | 10 |
| Production readiness score | 92/100 |

---

*CelebStyle — "Wear What Your Icon Wears"*
