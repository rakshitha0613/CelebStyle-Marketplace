# PGlite → PostgreSQL Migration Plan

**Status: planning document only — no migration has been performed.**

## Context

The application's Prisma schema (`apps/backend/prisma/schema.prisma`) already targets `provider = "postgresql"` and has since it was written. What actually runs today is **PGlite** — an embedded, single-process, WASM build of real Postgres — wired in via a fully custom adapter in `apps/backend/src/lib/prisma.ts`. Critically, `DATABASE_URL`/`DIRECT_URL` are read and validated at startup (`env.ts`) but **never actually used to connect to anything**: `prisma.ts` unconditionally creates a local PGlite instance regardless of their value. The `.env` file's `DATABASE_URL` is still the literal placeholder text from `.env.example` (`postgresql://<user>:<password>@<host>...`), which passes the naive `startsWith("postgresql://")` check but was never a real connection string.

Because PGlite *is* Postgres under the hood, the schema, queries, and Prisma Client usage throughout the app are already Postgres-shaped — this is a **swap the connection, not rewrite the app** migration, not a cross-engine port.

---

## 1. Schema Compatibility

**Good news: the schema is already fully Postgres-compatible.** No model, field type, enum, or relation needs to change. `Decimal`, `Json`, `DateTime`, `String[]`, enums, composite keys — all standard Postgres, already proven to work since PGlite is genuinely Postgres.

**One real compatibility gap, and it's the opposite of what you'd expect:** two fields use `Unsupported("vector(1536)")` (`ProductEmbedding.embedding`, `UserEmbedding.embedding`), which requires the `pgvector` extension. PGlite's bootstrap code explicitly can't reliably apply this (see Finding A below) — a real Postgres instance (self-hosted with `pgvector` installed, or a managed provider like Supabase that supports it natively via `create extension vector;`) can. **Migrating is a net gain here**, not a compatibility risk — it unlocks embedding-based "Similar Products" recommendations that are currently silently disabled (already patched to degrade gracefully rather than error, per the recent fix in `recommendation.service.ts`).

### Finding A — Root cause of 6 "missing" tables (fix this before or during migration)

Audited every table in `schema.prisma` against what actually exists in the current PGlite database. Six models have no table at all: `ProductEmbedding`, `UserEmbedding`, `CoPurchasedPair`, `CoviewedPair`, `TrendingProduct`, `RecommendationImpression`. Traced to the exact cause:

- All six are defined in a single migration file, `prisma/migrations/20260703060000_sprint_5_1_vectors/migration.sql`.
- `prisma.ts`'s custom migration runner (used only for PGlite bootstrap) detects this file needs vector support (`vector(1536)`/`hnsw` present) and applies a **line-by-line stripping heuristic** meant to remove just the vector-specific statements while keeping the rest.
- That heuristic's block-boundary detection isn't precise enough to distinguish "lines belonging to the vector-column tables" from "unrelated `CREATE TABLE` statements later in the same file" — it ends up dropping **all six** table definitions, not just the two that actually contain a `vector(1536)` column.
- This is a PGlite-workaround bug, not a Prisma or schema problem. **Real Postgres via `prisma migrate deploy` runs migration files unmodified — this bug categorically cannot occur there.**

A second migration (`20260703143418_add_recommendation_feedback`) contains `DROP INDEX` statements for indexes on those same six tables — meaning it silently no-ops or partially fails today too (dropping an index that was never created). This should self-resolve once the tables exist correctly.

**Recommended action:** run `prisma migrate deploy` against a real (even temporary/local Docker) Postgres instance *before* cutting the app over, specifically to confirm the full migration history applies cleanly end-to-end with no manual stripping. This should be done as a dry run independent of the production cutover.

---

## 2. Required Prisma Changes

**No `schema.prisma` changes needed.** The required changes are entirely in `apps/backend/src/lib/prisma.ts` (currently ~230 lines, almost all of which is the custom PGlite↔Prisma driver-adapter shim: `PGliteClient`, `PGlitePool`, timestamp/JSON coercion, and the manual migration runner).

1. **Add a real Postgres code path.** Using `@prisma/adapter-pg` (already a dependency) with a genuine `pg.Pool` pointed at `DATABASE_URL`, or simply `new PrismaClient()` with no adapter override (letting Prisma's default engine read `DATABASE_URL` directly) — either works; the adapter-pg path is more consistent with how the PGlite path is already structured.
2. **Branch on environment, not on code changes elsewhere.** Every other file in the app does `import { prisma } from "../lib/prisma.js"` and only uses the standard Prisma Client interface — none of them need to know or care which engine is behind it. The branch belongs entirely inside `prisma.ts`:
   ```
   if (real Postgres configured) → new PrismaClient({ adapter: new PrismaPg(realPgPool) })
   else                          → existing PGlite adapter (unchanged, kept for local/demo use)
   ```
   Suggested trigger: an explicit `DB_ENGINE=postgres|pglite` env var (safer and more intentional than trying to sniff a "real" `DATABASE_URL` from a placeholder one — the current placeholder already technically starts with `postgresql://` and would pass a naive check).
3. **Retire the custom migration runner for the Postgres path.** It's a PGlite-only bootstrap workaround; real Postgres uses the standard Prisma CLI (`prisma migrate deploy` in CI/deploy, `prisma migrate dev` locally) instead. Gate the existing runner so it only executes when the PGlite branch is active.
4. **No changes to any route, service, or repository file.** They all consume `prisma` as an opaque `PrismaClient` instance already — this was effectively already engine-agnostic by construction, which is what makes this migration low-risk from an application-functionality standpoint.

---

## 3. Environment Variable Updates

| Variable | Current state | Required for Postgres |
|---|---|---|
| `DATABASE_URL` | Placeholder text, never actually used | Real pooled connection string (e.g. Supabase pooler, port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Placeholder text | Real direct (non-pooled) connection string, required for `prisma migrate` to bypass pgBouncer's DDL restriction in transaction mode |
| `DB_ENGINE` *(new)* | Doesn't exist | `postgres` to select the new code path (see §2); omit/`pglite` to keep current behavior |
| `JWT_SECRET`, `PAYMENT_PROVIDER`, etc. | Already correctly used | Unchanged — not part of this migration |

`.env.production` and `.env.staging` (repo root) already document the correct real-Postgres shape from a prior production-readiness pass — they were written correctly, just never actually consumed by the code. This migration is what finally makes them meaningful.

---

## 4. Migration Steps (runbook — not executed)

1. **Provision Postgres.** Managed instance recommended (Supabase, RDS, etc.) for backups/HA; self-hosted Postgres 15+ acceptable if `pgvector` can be installed.
2. **Dry-run the migration history** against a throwaway Postgres instance: `prisma migrate deploy` with real `DATABASE_URL`/`DIRECT_URL` pointed at it. Confirm all 16 migrations apply cleanly, including `sprint_5_1_vectors` in full (all 6 tables + the vector columns) — this validates Finding A's fix without touching production data.
3. **Enable `pgvector`** on the target instance (`create extension if not exists vector;`) before running migrations, since the vector migration expects it.
4. **Implement the `prisma.ts` branch** described in §2, defaulting to the existing PGlite path unless `DB_ENGINE=postgres` is set — keeps local dev/demo usage completely unaffected.
5. **Set real environment variables** in the target deploy environment only (`DATABASE_URL`, `DIRECT_URL`, `DB_ENGINE=postgres`).
6. **Run `prisma migrate deploy`** against the real target database as an explicit deploy step (not on app boot).
7. **Run the seeder** (see §5) against the new database.
8. **Smoke-test** against the new backend instance before routing any real traffic to it (health check, a handful of the API routes already used throughout prior QA passes in this project).
9. **Cut over** — point the running app at the new `DATABASE_URL` (env var swap + restart, no code deploy needed beyond the §2 change already being live).
10. **Keep the old PGlite path available** (don't delete the adapter code) so local development and any future demo/offline mode keep working unchanged.

---

## 5. Seed Process

**Good news: the seeder is already fully engine-agnostic.** `runSeed()` (`apps/backend/src/lib/seeder.ts`) and its sub-functions (`seedManufacturers`, `seedCelebrities`, `seedProducts`, `seedStorefronts`, `seedCollections`, `seedAdminUser`) use only standard Prisma Client calls (`upsert`, `createMany`, etc.) — no PGlite-specific code anywhere in it. It will run unchanged against real Postgres.

The two supplementary content scripts (`prisma/seed-demo.cjs`, `prisma/seed-content.cjs`) are also plain `new PrismaClient()` + standard queries — already written for a real Postgres connection (in fact, run standalone via `node prisma/seed-demo.cjs` today, they'd connect via the *default* Prisma engine reading `DATABASE_URL` directly, bypassing the PGlite adapter entirely — worth being aware of if they're ever invoked directly rather than through the app).

**One behavior change recommended, not required by compatibility:** `runSeed()` currently runs unconditionally on every backend boot (harmless with PGlite as a single dev instance, since everything is idempotent upserts). Against a shared production Postgres with potentially multiple app instances, running the full seed pass on every restart is unnecessary overhead and a very small race-condition surface if two instances boot simultaneously. Recommend gating it behind an explicit one-time `npm run seed` step (Prisma's `seed` config already exists in `package.json`) for the production/Postgres path, while leaving it automatic for the PGlite/dev path as-is. This is an operational change, not an application-functionality change.

---

## 6. Deployment Considerations

- **Horizontal scaling becomes possible.** This is likely the single biggest practical motivator: PGlite is embedded and single-process — you cannot run more than one backend replica today; each would have its own isolated, diverging database. Real Postgres lets multiple app instances share one database, enabling actual load-balanced/zero-downtime deploys.
- **Ephemeral filesystems are a silent data-loss risk today.** PGlite persists to `.pglite-data` on local disk. Most container/serverless platforms (Vercel, many PaaS defaults) have ephemeral storage — every redeploy or restart would silently wipe the database if deployed there as-is. This migration removes that risk entirely.
- **Connection pooling.** Use a pooler (Supabase's built-in pgBouncer, or a standalone one) for the app's runtime `DATABASE_URL`; use the direct connection only for `DIRECT_URL` (migrations). This is already documented correctly in `.env.example`.
- **Backups.** Managed Postgres gets automated backups/PITR; PGlite has none today.
- **CI/test suite.** 23 of the 38 backend test files import the shared `prisma.ts` singleton, meaning they currently run against PGlite too. Decide whether CI runs against a real ephemeral Postgres (e.g., a service container) or continues using the PGlite path for speed/isolation — both are viable given the `DB_ENGINE` branch from §2.
- **pgvector availability.** Confirm the chosen host supports it before relying on the embedding-based recommendation features.
- **Secrets handling.** `DATABASE_URL`/`DIRECT_URL` must come from a secret manager/CI secret, not committed — `.env.production`'s existing `<inject-from-secret-manager>` placeholders already reflect this correctly.

---

## 7. Potential Risks

| Risk | Notes |
|---|---|
| Finding A resurfacing in a different form | Mitigated by the dry-run step (§4.2) — validates the full migration history applies correctly on real Postgres before any cutover. |
| Downtime/data loss during cutover | Recommend a maintenance window or blue/green cutover; this plan doesn't include a live-data export step because there's currently no production data to preserve (dev/PGlite data is disposable test data, per this session's own experience). |
| pgBouncer + Prisma transaction-mode DDL incompatibility | Already anticipated in existing `.env.example` comments (`DIRECT_URL` exists specifically for this) — just needs to actually be used. |
| Cost | Managed Postgres has real ongoing cost vs. free embedded PGlite; size the instance/tier appropriately. |
| PGlite reliability as a fallback | Worth flagging: during this session, the local PGlite instance crashed with an unrecoverable WASM-level error after a concurrent-access incident, and pre-existing crash-backup folders in the repo (dated before this session) show this has happened before, independent of that incident. This is an argument for treating PGlite as strictly a local/dev convenience, not something to lean on even informally in any shared or long-running environment. |
| Regression risk to application code | Low — confirmed every consumer of `prisma` throughout the codebase uses only the standard Prisma Client interface; the migration is isolated to `lib/prisma.ts` and environment configuration. |

---

## Non-Goals / Explicitly Out of Scope Here

- No code was changed to produce this plan.
- No new Postgres instance was provisioned.
- No data was exported or migrated.
- No application functionality changes — this plan is scoped purely to swapping the storage engine underneath an already-Postgres-shaped schema and an already-engine-agnostic application layer.
