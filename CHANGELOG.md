# Changelog

All notable changes to CelebStyle are documented in this file.

Format: [Semantic Versioning](https://semver.org) — `Added`, `Changed`, `Fixed`, `Removed`, `Security`

---

## [1.0.0] — 2026-07-04

**Production Release — CelebStyle v1.0.0**

This release marks the first production-ready version of the CelebStyle platform, completing a 7-sprint development cycle from MVP to full production hardening.

---

### Sprint 1 — Core Platform (MVP)

**Added**
- Celebrity catalogue: 101 seed records spanning Bollywood, Hollywood, Tollywood, Kollywood, Mollywood, OTT, Music, Sports, Fashion
- Outfit/product catalogue with celebrity associations, occasions, seasons, pricing
- Manufacturer registry with ratings, locations, specialties
- In-memory data store (seeded from JSON) for rapid development
- Home page with featured celebrities and outfit grid
- Celebrity browse page with industry filter (client-side)
- Celebrity detail page with outfit archive grouped by occasion and film/character
- Product detail page (Myntra-style gallery, size selector, manufacturer list)
- Search page with full-text + multi-filter (occasion, category, celebrity, colour)
- Admin CRUD interface for celebrities, outfits, manufacturers
- Storefronts: celebrity brand pages with commission dashboard
- Cart (localStorage): add/remove/clear, shipping ≥ ₹25,000 free
- Checkout: POST to orders, simulated Razorpay payment
- Orders: listing, detail, interactive status advancement
- Commission model: 10% platform / 5% celebrity / 85% manufacturer
- Environment validation at startup (`env.ts` throws on invalid PORT)
- Structured pino logging with request correlation IDs

**Fixed**
- `add-to-cart-button` missing `celebrityId` and `manufacturerIds` — checkout lost fields silently
- `cart/page.tsx` — `CartItem` type incomplete; shipping calculation incorrect
- `cart-badge` — `text-background` made badge text invisible on light navbar
- `storefronts.ts` — store seeded before `outfitStore` ready; lazy-seeded on first request
- `search/page.tsx` — applied server filters then derived options from filtered subset; now loads full catalogue client-side
- `orders/[id]` — added interactive status advancement UI
- `lib/api.ts` — added missing `updateOrderStatus()` function
- Year field type in outfits tab corrected

---

### Sprint 2 — Database Migration

**Added**
- Prisma 6 schema with 88 models across 10 domains
- PostgreSQL 15 + pgvector support
- PgBouncer connection pooling configuration (`?pgbouncer=true`)
- Full migration history in `apps/backend/prisma/migrations/`
- Seed script (`apps/backend/prisma/seed.ts`)
- Repository layer (`apps/backend/src/repositories/`) wrapping Prisma access
- Prisma client generation in build pipeline

**Changed**
- Data layer: in-memory stores replaced by Prisma repository calls
- `DATABASE_URL` and `DIRECT_URL` added to env validation

---

### Sprint 3 — Authentication & Authorisation

**Added**
- JWT authentication (`jose` library, HS256, 15-minute TTL)
- Refresh tokens (7-day TTL, `httpOnly` cookie, rotation on refresh)
- Email verification flow with single-use tokens
- Password reset flow with expiring tokens stored hashed
- `bcryptjs` password hashing (cost factor 12)
- 8 user roles: CUSTOMER, CELEBRITY, ADMIN, SUPER_ADMIN, MANUFACTURER_PARTNER, CELEBRITY_MANAGER, CONTENT_MODERATOR, ANALYST
- `authenticate` middleware (JWT verification + `req.user` population)
- `authorize(...roles)` middleware (role-allowlist check, 403 on failure)
- `optionalAuth` middleware (parses token if present, never throws)
- Auth routes: register, login, refresh, logout, verify-email, resend-verification, forgot-password, reset-password, me (GET/PATCH/DELETE)
- Soft-delete on account deletion (`deletedAt` column)

**Security**
- `jose` replaces `jsonwebtoken` (avoids algorithm confusion vulnerabilities)
- Refresh tokens invalidated on logout via `revokedAt`
- `isActive` check blocks suspended accounts

---

### Sprint 4 — Commerce

**Added**
- Cart backend API (JWT-protected): add, update, remove, clear
- Address management: create, update, delete, set default
- Checkout validation: stock check, address verify, coupon apply
- Coupon system with percentage and fixed-amount discounts
- Inventory management: warehouses, stock levels, reservations, movements
- Returns and refunds: request, approve/reject, issue refund
- Full order lifecycle: AWAITING_PAYMENT → PLACED → CONFIRMED → PRODUCTION_STARTED → QUALITY_CHECK → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
- Commission routing: first `manufacturerId` in outfit's array receives payment
- Manufacturer commission settlement tracking

---

### Sprint 5 — AI & Recommendations

**Added**
- Product and user embeddings stored in PostgreSQL with pgvector
- Collaborative filtering via co-purchase and co-view graphs
- Content-based similarity via cosine distance (`<=>` pgvector operator)
- Multi-signal ranking service (recency, popularity, price affinity, style)
- Diversity injection to prevent filter bubble
- A/B experiment framework with deterministic user–variant assignment
- Recommendation feedback loop: impression → click → wishlist → purchase
- ExplanationService: human-readable recommendation reasons
- MLOps: model registry, deployment modes (blue-green/canary/pinned), rollback
- Drift detection: KL divergence + PSI (Population Stability Index)
- MLOps alerts with resolve workflow
- ML admin API (`/api/ml/*`) — ADMIN/SUPER_ADMIN only
- Community features: posts, comments, likes, bookmarks, notifications, reviews, followers, loyalty accounts

---

### Sprint 6 — AR Platform

**Added**
- Browser-based virtual try-on: MediaPipe pose detection + WebGL garment overlay
- `BodyMeasurementService`: chest, shoulder, sleeve from pose landmarks
- `SizeRecommendationService`: XS–XXL chart with brand-specific adjustments
- `GarmentOverlayService`: WebGL affine transform + alpha blending, 5 simultaneous layers
- `OutfitComposerService`: 5-slot composition (top/bottom/jacket/shoes/accessory)
- `OutfitScoringService`: 7-dimension scoring (colorHarmony, styleCompat, season, trending, occasion, personal, celebrity)
- `WishlistOverlayService`: save outfit, add-all-to-cart, shareable URL
- `FitIndicator` component with accessibility (`role="status" aria-live="polite"`)
- AR test suite: 5 files, 425 assertions
- Privacy constraints enforced: all processing local, no frames transmitted, no persistent recording, snapshots require explicit gesture

---

### Sprint 7 — Production Hardening

**Added**

*7.1 — DevOps & Infrastructure*
- Multi-stage Dockerfiles for backend and frontend (non-root user)
- Docker Compose with 7 services: backend, frontend, nginx, postgres, redis, prometheus, grafana
- Nginx reverse proxy with rate limiting, HTTP→HTTPS redirect, security headers
- Prometheus metrics endpoint
- GitHub Actions CI pipeline (typecheck → test → build → docker push)
- pino-http structured request logging with redaction

*7.2 — Monitoring & Scaling*
- `MonitoringService`: CPU/memory/disk metrics, ring-buffer samples, business metrics
- `AlertingService`: 11 default rules, cooldown, acknowledge, resolve, history
- `ScalingService`: graceful shutdown, connection pool simulation, stateless backend validation
- `PerformanceMonitoringService`: slow query detection, request profiling, long-running request detection
- `CacheMonitoringService`: hit/miss/eviction tracking, latency percentiles, hot key stats
- `TracingService`: W3C Trace Context (traceparent), span lifecycle, correlation IDs
- Operations admin API (`/api/ops/*`) — ADMIN/SUPER_ADMIN only
- `test:ops` — 108 assertions

*7.3 — Security Hardening*
- `SecurityAuditService`: OWASP Top 10 audit, 10 categories, 40+ checks, weighted scoring
- `PerformanceOptimizationService`: 18 static recommendations across 8 areas, cache effectiveness evaluation
- `RateLimitService`: per-route rules, IP allowlist/denylist, adaptive throttling under CPU/memory pressure
- `SecretsValidationService`: Shannon entropy, JWT/DB validation, known-weak pattern detection
- `BackupValidationService`: SHA-256 checksum, RPO/RTO compliance
- `RecoveryService`: circuit breakers (closed/open/half-open), retry with exponential backoff + jitter, failover
- Security admin API (`/api/security/*`) — ADMIN/SUPER_ADMIN only
- `test:security` — 115 assertions

*7.4 — Release Audit & Launch*
- `ReleaseAuditService`: 18 subsystem audits, APPROVE/APPROVE_WITH_WARNINGS/BLOCK recommendation
- `DeploymentChecklistService`: 48+ checklist items across 9 categories
- `ProductionReadinessService`: 10 weighted dimensions, overall score, tech debt register (TD-01 to TD-10)
- `ReleaseNotesService`: structured sprint history, accumulated stats
- `DocumentationService`: 10 document entries, 75+ API endpoint catalogue
- `LaunchVerificationService`: 30 environment/security/infrastructure checks
- Release API (`/api/release/*`): public status/version, admin-only report
- `test:release` — 82 assertions
- 10 documentation files generated

**Documentation**
- `SYSTEM_ARCHITECTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `SECURITY_GUIDE.md`
- `AI_DOCUMENTATION.md`
- `AR_DOCUMENTATION.md`
- `API_DOCUMENTATION.md`
- `DATABASE_SCHEMA.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `README.md` (updated)

---

## Project Statistics (v1.0.0)

| Metric | Count |
|---|---|
| Sprints completed | 7 |
| Backend services | 53 |
| Route files | 25 |
| Database models | 88 |
| API endpoints | 120+ |
| Frontend pages | 14 |
| Docker services | 7 |
| Test assertions | 550+ |
| Lines of code | ~25,000 |
| Documentation files | 10 |

---

*CelebStyle — "Wear What Your Icon Wears"*
