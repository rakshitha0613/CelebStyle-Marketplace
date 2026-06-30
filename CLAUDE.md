# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Install
```bash
npm install          # from repo root — installs both apps via workspaces
```

### Run (two terminals required)
```bash
# Terminal 1
cd apps/backend && npm run dev      # → http://localhost:4000 (tsx watch)

# Terminal 2
cd apps/frontend && npm run dev     # → http://localhost:3000 (Next.js)
```

Or from root:
```bash
npm run dev:backend
npm run dev:frontend
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

Prisma and `@prisma/client` are installed as dependencies but are not used anywhere in the running app — the schema is vestigial.

Static seed data comes from two places:
- `apps/backend/src/data/celebs-seed.json` — 68 celebrity records loaded at startup
- `apps/backend/src/data/catalogue.ts` — outfit records hard-coded as TypeScript, exported as `outfitRecords`

The storefronts store is **lazily seeded** on first request (not at module load) to avoid a timing issue where `outfitStore` would be empty during import.

All API responses follow `{ data: T }` envelope. Backend runs on port `4000`, CORS fully open.

### Frontend — dual data layer
The frontend has two data sources that must stay in sync:

| File | Used by | How |
|------|---------|-----|
| `apps/frontend/lib/api.ts` | All dynamic pages (celebrities, outfits, orders, storefronts, admin) | `fetch()` calls to `http://localhost:4000` — controlled by `NEXT_PUBLIC_API_BASE_URL` env var |
| `apps/frontend/lib/data.ts` | Home page (`app/page.tsx`) | Static export — imports `celebs-seed.json` directly from the backend source tree and re-declares a small subset of outfits inline |

`lib/data.ts` exists for SSR/static rendering of the home page without requiring the backend. The outfit IDs in `lib/data.ts` match IDs in `lib/api.ts` / `catalogue.ts` so links from the home page resolve correctly on the product page (which fetches from the API).

Cart state is stored client-side only (no backend cart endpoint).

### Frontend pages (`apps/frontend/app/`)
| Route | Notes |
|-------|-------|
| `/` | Static home — uses `lib/data.ts`, not the API |
| `/celebrities` | Fetches from API; industry filter via query param |
| `/celebrities/[id]` | Outfits grouped by occasion; links to storefronts |
| `/search` | Loads full catalogue client-side; all filters applied in-browser |
| `/outfits/[id]` | Product page — size selector, add-to-cart, manufacturer list |
| `/cart` | Client-side cart; shipping: free ≥ ₹25,000, else ₹499 |
| `/checkout` | POST to `/api/orders`, then POST to `/api/orders/:id/pay` (simulated Razorpay) |
| `/orders` + `/orders/[id]` | Order detail with interactive status advancement via `PATCH /api/orders/:id/status` |
| `/storefronts` + `/storefronts/[id]` | Celebrity brand pages + commission dashboard |
| `/admin` | Full CRUD for celebrities, outfits, manufacturers |

### Commission model
- Platform fee: 10% of subtotal
- Celebrity commission: 5% of subtotal
- Manufacturer share: 85% of subtotal
- Routing: first `manufacturerId` in an outfit's `manufacturerIds` array is assigned; others are ignored

### Image strategy
Missing celebrity profile/banner images (those containing `No_image_available.svg`) are replaced with a `thum.io` Wikipedia screenshot at runtime in both `catalogue.ts` and `lib/data.ts`.
