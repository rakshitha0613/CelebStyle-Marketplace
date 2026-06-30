# CelebStyle — Celebrity Fashion Replica Marketplace

> **Project 10** · VortexIQ Developer Portfolio · April 2026  
> *"Wear What Your Icon Wears"*

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Install dependencies (root workspace — installs both apps)
```bash
npm install
```

### 2. Start the backend (Terminal 1)
```bash
cd apps/backend
npm run dev
# → http://localhost:4000
```

### 3. Start the frontend (Terminal 2)
```bash
cd apps/frontend
npm run dev
# → http://localhost:3000
```

That's it. No database setup required — the backend uses an in-memory store seeded from `apps/backend/src/data/celebs-seed.json`.

---

## All Working Pages

| URL | Description |
|-----|-------------|
| `/` | Home — featured celebrities + outfit grid |
| `/celebrities` | Browse 68 celebrities grouped by industry |
| `/celebrities/[id]` | Celebrity profile — bio, style tags, outfit archive grouped by occasion |
| `/search` | Full-text + filter search (occasion, category, celebrity, colour) |
| `/outfits/[id]` | Product page — size selector, add to cart, linked manufacturers |
| `/cart` | Cart with remove/clear, subtotal + shipping calculation |
| `/checkout` | Order form with demo Razorpay payment → creates real order |
| `/orders` | All orders list |
| `/orders/[id]` | Order detail — interactive status tracker, commission breakdown, manufacturer routing |
| `/storefronts` | Celebrity brand spaces + commission dashboard + storefront builder |
| `/storefronts/[id]` | Individual celebrity storefront with outfit grid |
| `/admin` | CMS — full CRUD for celebrities, outfits, and manufacturers |

---

## Backend API

**Base URL:** `http://localhost:4000`

### Celebrities
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/celebrities` | All celebrities. Query: `?industry=Bollywood&search=shah` |
| GET | `/api/celebrities/:id` | Single celebrity |
| POST | `/api/celebrities` | Create. Body: `{name, industry, bio, profileImage, bannerImage, styleTags}` |
| PUT | `/api/celebrities/:id` | Update |
| DELETE | `/api/celebrities/:id` | Delete |

### Outfits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/outfits` | All outfits. Query: `?celebrityId=&occasion=&category=&search=&year=` |
| GET | `/api/outfits/:id` | Single outfit (enriched with celebrityName) |
| POST | `/api/outfits` | Create. Body: `{celebrityId, movieName, occasion, category, colorPalette, price, imageUrl, description, manufacturerIds}` |
| PUT | `/api/outfits/:id` | Update |
| DELETE | `/api/outfits/:id` | Delete |

### Manufacturers
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manufacturers` | All manufacturers |
| GET | `/api/manufacturers/:id` | Single manufacturer |
| POST | `/api/manufacturers` | Create. Body: `{name, location, rating, contactEmail, verified, specialties}` |
| PUT | `/api/manufacturers/:id` | Update |
| DELETE | `/api/manufacturers/:id` | Delete |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | All orders |
| GET | `/api/orders/:id` | Single order with items, commission split, manufacturer routing |
| POST | `/api/orders` | Place order. Body: `{customerName, customerEmail, address, items[], paymentMethod}` |
| POST | `/api/orders/:id/pay` | Simulate Razorpay payment — sets paymentStatus=paid, status=production started |
| PATCH | `/api/orders/:id/status` | Advance status. Body: `{status: "placed"|"production started"|"shipped"|"delivered"}` |

### Storefronts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/storefronts` | All storefronts |
| GET | `/api/storefronts/:celebrityId` | Single storefront |
| GET | `/api/storefronts/metrics/commission` | Platform-wide commission totals |
| POST | `/api/storefronts` | Create or update storefront. Body: `{celebrityId, displayName, bannerImage, featuredOutfitIds, message, verified}` |

---

## Commission Model
On every order:
- **Platform fee:** 10% of subtotal
- **Celebrity commission:** 5% of subtotal
- **Manufacturer share:** remainder (85%)
- **Free shipping:** orders ≥ ₹25,000; otherwise ₹499

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js · Express 5 · TypeScript · tsx |
| Frontend | Next.js 15 · React 19 · Tailwind CSS |
| Data | In-memory store (seeded from JSON) |
| Payments | Razorpay Demo (simulated) |
| Images | Wikipedia / thum.io screenshots |

---

## Bugs Fixed (vs original zip)
1. **`add-to-cart-button`** — was missing `celebrityId` and `manufacturerIds`; checkout would lose these fields silently
2. **`cart/page.tsx`** — `CartItem` type was incomplete; shipping calc was wrong
3. **`cart-badge`** — `text-background` made text invisible on light navbar
4. **`storefronts.ts` (backend)** — store seeded at module-load before `outfitStore` ready; now lazily seeded on first request
5. **`search/page.tsx`** — was applying server filters then deriving filter options from the filtered subset; now always loads full catalogue client-side
6. **`orders/[id]`** — added interactive status advancement (calls `PATCH /api/orders/:id/status`)
7. **`lib/api.ts`** — added missing `updateOrderStatus()` function
