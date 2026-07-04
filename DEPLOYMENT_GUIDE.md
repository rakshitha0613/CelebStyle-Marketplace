# CelebStyle — Deployment Guide

> Version 1.0.0 · July 2026

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- Node.js 20+ and npm 9+ (for local development)
- A PostgreSQL 15+ database (managed Supabase recommended)
- A Redis 7+ instance
- A domain name with DNS control (for production HTTPS)

---

## Local Development

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure backend environment
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your values

# 3. Configure frontend environment
cp apps/frontend/.env.example apps/frontend/.env.local
# Edit apps/frontend/.env.local with your values

# 4. Run database migrations
cd apps/backend && npx prisma migrate dev

# 5. Seed initial data (optional)
npx prisma db seed

# 6. Start backend (Terminal 1)
npm run dev:backend       # → http://localhost:4000

# 7. Start frontend (Terminal 2)
npm run dev:frontend      # → http://localhost:3000
```

---

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Server port (default: 4000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string with `?pgbouncer=true` |
| `DIRECT_URL` | Yes | Direct PostgreSQL URL (no pooler) — used by Prisma migrations |
| `JWT_SECRET` | Yes | ≥48 character random secret for JWT signing |
| `NODE_ENV` | Yes | `development` / `staging` / `production` |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` (default: `debug` dev, `info` prod) |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins (all allowed in dev) |
| `TRUST_PROXY` | No | Set to `true` when behind Nginx/load balancer |
| `REPLICA_COUNT` | No | Number of backend replicas (for scaling readiness checks) |

### Frontend (`apps/frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | No | Backend API URL (default: `http://localhost:4000`) |

---

## Docker Production Deployment

### 1. Build and push images (CI does this automatically)

```bash
docker build -f apps/backend/Dockerfile -t ghcr.io/your-org/celebstyle-backend:latest apps/backend
docker build -f apps/frontend/Dockerfile -t ghcr.io/your-org/celebstyle-frontend:latest apps/frontend
docker push ghcr.io/your-org/celebstyle-backend:latest
docker push ghcr.io/your-org/celebstyle-frontend:latest
```

### 2. Configure production environment

```bash
cp .env.production .env.production.local
# Fill in all secrets — never commit .env.production.local
```

### 3. Run database migrations (before first start)

```bash
docker run --env-file .env.production.local \
  ghcr.io/your-org/celebstyle-backend:latest \
  npx prisma migrate deploy
```

### 4. Start all services

```bash
docker compose --env-file .env.production.local up -d
```

### 5. Verify health

```bash
# Liveness
curl http://localhost/api/health

# Readiness (DB check)
curl http://localhost/api/health/ready

# Version
curl http://localhost/api/release/version
```

---

## SSL/TLS Configuration

For production HTTPS, configure Nginx to use your TLS certificate:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/private/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ...
}
```

Mount the certificates into the Nginx container via `docker-compose.override.yml`.

---

## CI/CD Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push:

```
typecheck → test-backend → build → docker-build-push (GHCR)
```

**Required GitHub secrets**:
- `GHCR_TOKEN` — personal access token with `write:packages` scope

---

## Health Checks

| Endpoint | Purpose | Expected |
|---|---|---|
| `GET /api/health` | Liveness | 200 with `{status, uptime, timestamp}` |
| `GET /api/health/ready` | Readiness (DB check) | 200 OK / 503 if DB unreachable |
| `GET /api/health/startup` | Startup probe | 200 OK after warmup |

---

## Scaling

The backend is stateless — scale horizontally by increasing `REPLICA_COUNT`:

```yaml
# docker-compose.yml
backend:
  deploy:
    replicas: 3
```

Nginx handles load balancing across replicas. PgBouncer manages the connection pool to prevent DB connection exhaustion.

---

## Backup Strategy

| Backup Type | Frequency | Retention |
|---|---|---|
| Full database | Daily | 30 days |
| Incremental | Hourly | 30 days |
| WAL archiving | Continuous | 7 days |

Configure automated backups via your managed PostgreSQL provider (Supabase handles this automatically on paid plans).

---

## Monitoring

Access the monitoring stack after deployment:

- **Grafana**: `http://localhost:3001` (default: admin/admin)
- **Prometheus**: `http://localhost:9090`
- **Ops API** (admin only): `GET /api/ops/metrics`, `GET /api/ops/alerts`

---

## Rollback Procedure

```bash
# 1. Pull previous image version
docker pull ghcr.io/your-org/celebstyle-backend:v0.9.0

# 2. Update docker-compose.yml to pin to previous version
# 3. Redeploy
docker compose up -d --no-deps backend

# 4. If DB migration needs rollback:
npx prisma migrate resolve --rolled-back <migration-name>
```
