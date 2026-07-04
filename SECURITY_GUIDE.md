# CelebStyle — Security Guide

> Version 1.0.0 · July 2026

---

## Security Architecture Overview

CelebStyle implements defence-in-depth across every layer: network, transport, application, authentication, authorisation, and data.

---

## OWASP Top 10 Coverage

| Risk | Implementation |
|---|---|
| A01 Broken Access Control | RBAC middleware on all admin routes; 401 vs 403 distinction |
| A02 Cryptographic Failures | bcryptjs (cost=12) for passwords; jose for JWT (HS256); HTTPS enforced via HSTS |
| A03 Injection | Prisma ORM parameterizes all queries; no raw SQL with user input |
| A04 Insecure Design | Short-lived JWT (15m); refresh token rotation; email verification gate |
| A05 Security Misconfiguration | Helmet sets CSP/HSTS/nosniff; Nginx disables server tokens; non-root Docker users |
| A06 Vulnerable Components | jose replaces jsonwebtoken (avoids CVE-2022-21449); automated npm audit planned |
| A07 Auth Failures | Rate limited auth: 20 req/15min (prod); account lockout via soft-delete + isActive |
| A08 Integrity Failures | Package-lock.json checked in; multi-stage Docker builds |
| A09 Logging Failures | pino structured logging on all requests; Prometheus metrics; correlation IDs |
| A10 SSRF | No user-controlled URLs fetched by backend; CDN images via controlled proxy |

---

## Authentication

### JWT Configuration

- **Library**: `jose` (IETF-compliant, not vulnerable to algorithm confusion)
- **Algorithm**: HS256
- **Access token TTL**: 15 minutes
- **Refresh token TTL**: 7 days
- **Refresh token storage**: httpOnly cookie
- **Rotation**: Every refresh revokes the old token (`revokedAt` column)

### Password Security

- **Hashing**: `bcryptjs` with cost factor 12
- **Reset flow**: Single-use tokens with expiry, stored hashed in DB
- **Minimum entropy**: Enforced at `SecretsValidationService` (length + complexity + Shannon entropy)

### Session Security

- No server-side session state — stateless JWT architecture
- Refresh tokens invalidated on logout via `revokedAt`
- Soft-deleted users cannot authenticate (`deletedAt` check)
- Inactive users blocked (`isActive: false` check)

---

## Authorisation

### Role Hierarchy

```
CUSTOMER < CELEBRITY < CELEBRITY_MANAGER < MANUFACTURER_PARTNER
       < CONTENT_MODERATOR < ANALYST < ADMIN < SUPER_ADMIN
```

### Middleware Pattern

```typescript
router.get("/admin-only", authenticate, authorize("ADMIN", "SUPER_ADMIN"), handler)
```

- `authenticate` — verifies JWT, populates `req.user`
- `authorize` — checks `req.user.role` against allowlist; returns 403 if not permitted
- `optionalAuth` — parses token if present, never throws 401

### Protected Endpoint Groups

| Endpoint prefix | Required role |
|---|---|
| `/api/ml/*` | ADMIN, SUPER_ADMIN |
| `/api/ops/*` | ADMIN, SUPER_ADMIN |
| `/api/security/*` | ADMIN, SUPER_ADMIN |
| `/api/release/report` | ADMIN, SUPER_ADMIN |
| `/api/admin/*` | ADMIN, SUPER_ADMIN |

---

## Transport Security

### HTTPS

- TLS termination at Nginx
- HTTP → HTTPS redirect via `return 301 https://...`
- TLS 1.2 and 1.3 only; weak ciphers disabled
- HSTS: `max-age=31536000; includeSubDomains; preload`

### Security Headers (Helmet)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'; frame-src 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (via CSP `frame-src 'none'`) |
| `Referrer-Policy` | `origin-when-cross-origin` |

---

## Rate Limiting

### Application Layer (express-rate-limit)

| Scope | Production limit | Window |
|---|---|---|
| Global | 300 requests | 15 minutes |
| Auth endpoints | 20 requests | 15 minutes |
| API endpoints | 120 requests | 1 minute |
| Checkout | 5 requests | 1 minute |

### Nginx Layer (additional protection)

| Zone | Rate |
|---|---|
| General API | 10 req/s burst |
| Auth endpoints | 2 req/s burst |

### Adaptive Throttling

`RateLimitService` supports adaptive throttling that reduces limits by a configurable multiplier (default 0.5×) when CPU or memory exceeds thresholds.

---

## Secrets Management

### Requirements

| Secret | Minimum | Recommended |
|---|---|---|
| `JWT_SECRET` | 32 chars | 48+ chars, cryptographically random |
| `DATABASE_URL` | Valid postgresql:// | Managed service with TLS |
| SSL certificate | Valid cert | Let's Encrypt or managed cert |

### Generating Secrets

```bash
# JWT secret
openssl rand -base64 48

# Database password
openssl rand -base64 32
```

### Validation

`SecretsValidationService` checks:
1. Length (≥32 chars)
2. Shannon entropy (≥3.5 bits/char)
3. Character complexity (≥3 of 4: lower, upper, digit, special)
4. Known-weak pattern detection (password, changeme, abc123, etc.)

---

## Data Protection

### Log Redaction

pino redacts the following fields from all log output:
- `req.headers.authorization`
- `req.headers.cookie`
- `body.password`
- `body.token`

### Database

- Prisma ORM — all queries parameterized
- Passwords never stored in plaintext
- Sensitive user data access controlled by RBAC

### AR Privacy

- Camera frames processed locally in Web Workers
- No video data transmitted to backend
- Frames discarded after each inference tick
- Snapshots require explicit user gesture (shutter button)
- Remote upload is always opt-in and explicit

---

## Network Isolation

Docker Compose uses separate internal and external networks:

```yaml
networks:
  internal:  # backend, frontend, postgres, redis, prometheus, grafana
  external:  # nginx only
```

- External traffic can only reach Nginx
- Prometheus metrics endpoint (`/metrics`) is blocked by Nginx from external access
- PostgreSQL and Redis are not exposed on host ports in production

---

## Security Monitoring

- `GET /api/security/audit` — run OWASP audit on demand (ADMIN only)
- `GET /api/ops/alerts` — view active security alerts (ADMIN only)
- `POST /api/security/scan` — comprehensive full-stack security scan (ADMIN only)
- All failed authentication attempts logged at WARN level with correlation ID

---

## Incident Response

1. **High error rate alert fires** — check `/api/ops/alerts`, acknowledge, investigate logs
2. **Suspected credential compromise** — rotate `JWT_SECRET`, all existing tokens are immediately invalidated
3. **Database breach** — rotate `DATABASE_URL` credentials, audit `AuditLog` table, notify affected users
4. **DDoS** — Nginx rate zones will shed load; scale horizontally; contact CDN provider
