# ── Stage 1: deps — install production + dev dependencies ─────────────────────
# Railway build context is apps/backend/ — the monorepo root (and its
# package-lock.json) is outside this context and cannot be referenced.
# We therefore use `npm install` rather than `npm ci`.
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN npm install

# ── Stage 2: builder — compile TypeScript ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the linux-musl target used by Alpine
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# Remove devDependencies before copying to the runtime image
RUN npm prune --omit=dev

# ── Stage 3: runner — production runtime ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 expressjs
USER expressjs

# Copy compiled output, pruned deps, Prisma schema, and manifest
COPY --from=builder --chown=expressjs:nodejs /app/dist         ./dist
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/prisma       ./prisma
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# Railway injects secrets as environment variables — do not use --env-file
CMD ["node", "dist/index.js"]
