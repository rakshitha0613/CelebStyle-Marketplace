# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Install
```bash
npm install          # from repo root — installs both apps via workspaces
```

### Run (two terminals required)
```bash
# Terminal 1 — backend
npm run dev:backend      # → http://localhost:4000 (tsx watch)

# Terminal 2 — frontend
npm run dev:frontend     # → http://localhost:3000 (Next.js)
```

### Build for production
```bash
npm run build            # both workspaces
npm run build:backend    # backend only (outputs to apps/backend/dist/)
npm run build:frontend   # frontend only (outputs to apps/frontend/.next/)
```

### Start production build
```bash
npm run start:backend    # node dist/index.js
npm run start:frontend   # next start
```

### Type-check
```bash
npm run typecheck                           # both workspaces
cd apps/frontend && npm run typecheck       # frontend only
cd apps/backend  && npm run typecheck       # backend only
```

There is no test suite and no linter configured.

---

## Architecture

### Monorepo layout
```
apps/
  backend/   Express 5 + TypeScript (tsx watch in dev)
  frontend/  Next.js 15 App Router + React 19 + Tailwind CSS
```

### Backend — in-memory store, no real database
Each route file (`apps/backend/src/routes/*.ts`) owns its own in-memory array (`celebrityStore`, `outfitStore`, `manufacturerStore`, `orderStore`, `storefrontStore`). **All data is lost on server restart.**

Prisma and `@prisma/client` are installed as dependencies but are not used anywhere in the running app — reserved for the database migration sprint.

Static seed data comes from two places:
- `apps/backend/src/data/celebs-seed.json` — 101 celebrity records loaded at startup
- `apps/backend/src/data/catalogue.ts` — outfit records hard-coded as TypeScript, exported as `outfitRecords`

The storefronts store is **lazily seeded** on first request (not at module load) to avoid a timing issue where `outfitStore` would be empty during import.

All API responses follow `{ data: T }` envelope. Backend runs on port `4000`, CORS fully open.

### Backend startup
`apps/backend/src/env.ts` centralizes environment variable reading and validates `PORT` at startup (throws if the value is not a valid port number). Future env vars (`JWT_SECRET`, `DATABASE_URL`) will be added and validated here as their sprints begin.

### Frontend — single data layer
All pages fetch from the backend API via `apps/frontend/lib/api.ts`. This includes the home page (`app/page.tsx`), which calls `getCelebrities()` and `getOutfits()` at server render time.

`lib/api.ts` uses `fetch()` with `cache: "no-store"` on all calls, pointing to `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:4000`).

Cart state is stored client-side only in `localStorage` under the key `"celebstyle-cart"`. No backend cart endpoint exists.

### Frontend pages (`apps/frontend/app/`)
| Route | Notes |
|-------|-------|
| `/` | Home — fetches celebrities and outfits from API at render time |
| `/celebrities` | Fetches from API; industry filter rendered client-side |
| `/celebrities/[id]` | Outfits split into film/character and event sections; links to storefronts |
| `/search` | Loads full catalogue from API; all filters applied client-side |
| `/outfits/[id]` | Product page — Myntra-style gallery, size selector, add-to-cart, manufacturer list |
| `/cart` | Client-side cart; shipping: free ≥ ₹25,000, else ₹499 |
| `/checkout` | POST to `/api/orders`, then POST to `/api/orders/:id/pay` (simulated Razorpay) |
| `/orders` + `/orders/[id]` | Order detail with interactive status advancement via `PATCH /api/orders/:id/status` |
| `/storefronts` + `/storefronts/[id]` | Celebrity brand pages + commission dashboard |
| `/storefront` + `/storefront/[celebrityId]` | Redirect shims — both redirect to `/storefronts` counterparts |
| `/admin` | Full CRUD for celebrities, outfits, manufacturers |

### Commission model
- Platform fee: 10% of subtotal
- Celebrity commission: 5% of subtotal
- Manufacturer share: 85% of subtotal
- Routing: first `manufacturerId` in an outfit's `manufacturerIds` array is assigned; others are ignored

### Image strategy
Missing celebrity profile/banner images (those containing `No_image_available.svg`) are replaced with a `thum.io` Wikipedia screenshot at runtime in `catalogue.ts`.

### Environment configuration
Each workspace has its own `.env.example`:
- `apps/backend/.env.example` — `PORT` (validated at startup), `DATABASE_URL` (Sprint 2), `JWT_SECRET` (auth sprint)
- `apps/frontend/.env.example` — `NEXT_PUBLIC_API_BASE_URL` only

The frontend reads only `NEXT_PUBLIC_API_BASE_URL` (set in `apps/frontend/.env.local`). Variables like `DATABASE_URL` and `JWT_SECRET` are backend-only and must not be placed in the frontend env.
