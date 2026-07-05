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

---

## Cloud Deployment (Vercel + Railway/Render)

An alternative to Docker for teams that prefer managed PaaS:

### Frontend — Vercel

1. Import the repo into Vercel and set **Root Directory** to `apps/frontend`.
2. Vercel auto-detects Next.js. No `vercel.json` override needed for basic deploys.
3. Set the following environment variable in the Vercel dashboard:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://your-backend.railway.app` |

4. Vercel handles SSL, CDN, and deployments on every push to `main`.

### Backend — Railway

1. Create a new Railway project and connect the GitHub repo.
2. Set **Root Directory** to `apps/backend` and **Start Command** to `node dist/index.js`.
3. Add the following environment variables in the Railway service settings:

   | Variable | Required | Notes |
   |---|---|---|
   | `PORT` | Auto-set | Railway injects this |
   | `DATABASE_URL` | Yes | Supabase pooled URL (port 6543) |
   | `DIRECT_URL` | Yes | Supabase direct URL (port 5432) |
   | `JWT_SECRET` | Yes | ≥48 char hex secret |
   | `NODE_ENV` | Yes | `production` |
   | `ALLOWED_ORIGINS` | Yes | Your Vercel frontend URL |
   | `TRUST_PROXY` | Yes | `true` (Railway uses a proxy) |
   | `PAYMENT_PROVIDER` | No | `simulated` (default) or `razorpay` |
   | `RAZORPAY_KEY_ID` | Cond. | Required if `PAYMENT_PROVIDER=razorpay` |
   | `RAZORPAY_KEY_SECRET` | Cond. | Required if `PAYMENT_PROVIDER=razorpay` |
   | `RAZORPAY_WEBHOOK_SECRET` | Cond. | Required if `PAYMENT_PROVIDER=razorpay` |

4. Run migrations before first start:
   ```bash
   railway run npx prisma migrate deploy
   ```

### Database — Supabase

1. Create a project at supabase.com and note the pooled (port 6543) and direct (port 5432) URLs.
2. Set `DATABASE_URL` (pooled + `?pgbouncer=true`) and `DIRECT_URL` (direct, no param) in your backend service.
3. Enable connection pooling in the Supabase dashboard (transaction mode for PgBouncer).
4. Run `npx prisma migrate deploy` once to create all 88 schema tables.
5. Supabase handles automated backups on paid plans.
