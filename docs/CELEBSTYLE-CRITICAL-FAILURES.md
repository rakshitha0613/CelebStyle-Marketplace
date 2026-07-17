# CelebStyle Critical Failures Report

Derived from live functional verification (`docs/CELEBSTYLE-FUNCTIONAL-VERIFICATION.md`). Includes only BROKEN, UI_ONLY, MOCKED, NOT_IMPLEMENTED, and BLOCKED_EXTERNAL features (19 of 53 total). Priorities are inferred (no source PDF available — see the gap-audit doc's note). Ordered P0 → P1 → P2 → P3.

---

## P0

### #11 — Razorpay Payment Integration (MOCKED)
**Current behaviour:** Checkout completes via a client-side `setTimeout`-simulated "payment," then `POST /api/payments/simulate`, which auto-marks the order paid with zero gateway involvement. Live-fired this session: order flipped `pending→paid`, `status→"production started"` with no real money movement or gateway call.
**Expected behaviour:** Real Razorpay order creation, checkout widget, signature verification, and webhook confirmation.
**Root cause:** `apps/frontend/app/checkout/page.tsx` calls `simulatePayment()`, never `createOrder`+Razorpay's checkout SDK; `RAZORPAY_KEY_ID`/`SECRET` are unset regardless.
**Files involved:** `apps/frontend/app/checkout/page.tsx`, `apps/backend/src/routes/payments.ts` (`/simulate` vs `/create`+`/verify`), `apps/backend/src/payments/providers/razorpay.provider.ts` (real, unused code), `apps/backend/.env`.
**External blocker:** Real Razorpay test/live API keys.
**Recommended fix:** Rewire checkout UI to `/api/payments/create`+`/verify`; obtain and configure real keys.
**Estimated complexity:** MEDIUM (frontend rewire is small; end-to-end verification with a real gateway requires credentials + careful testing).

---

## P1

### #8 — Outfit Similarity Engine (BROKEN)
**Current behaviour:** `GET /api/recommendations/product/<real-outfit-slug>` → live-confirmed `404 {"error":"Product not found or not published"}` for every outfit, every time.
**Expected behaviour:** "Similar Looks" section renders real recommendations on every outfit detail page.
**Root cause:** `getProductRecommendations()` does `prisma.product.findUnique({where:{id: productId}})`, requiring a Prisma cuid; the frontend outfit page passes the URL slug (`outfits/[id]/page.tsx:18`, `getProductRecs(id,6)`), which is never a cuid.
**Files involved:** `apps/backend/src/services/recommendation.service.ts:637-646`, `apps/frontend/app/outfits/[id]/page.tsx:18`.
**External blocker:** none.
**Recommended fix:** Resolve slug→cuid first (mirror `productRepository.findBySlug`) before the `findUnique` call.
**Estimated complexity:** LOW (one-line lookup fix, plus a regression test).

### #19 — Celebrity Storefront Builder (BROKEN)
**Current behaviour:** Builder UI is reachable and appears functional to any logged-in user; live-tested with a customer-role token → `403 Forbidden` on submit.
**Expected behaviour:** A celebrity can edit their own storefront; the UI should not present an editing flow the backend will always reject for that role.
**Root cause:** `POST /api/storefronts` is `authorize("ADMIN","SUPER_ADMIN")`-only; no ownership check exists for a `CELEBRITY`-role user editing their own record.
**Files involved:** `apps/backend/src/routes/storefronts.ts:181`, `apps/frontend/app/storefronts/[celebrityId]/edit/page.tsx`.
**External blocker:** none.
**Recommended fix:** Add an ownership-based authorization branch, or clearly relabel the page as admin-only.
**Estimated complexity:** MEDIUM (authorization logic + linking a `CELEBRITY` user to their `Celebrity` record).

### #22 — Celebrity Payout System (MOCKED)
**Current behaviour:** Live-confirmed: `GET /storefronts/:id/payouts` fabricates every historical month as `"PAID"` with `gross:0, commission:0`; only the current, in-progress month reflects (test) real data.
**Expected behaviour:** A real payout ledger reflecting actual `Settlement` records.
**Root cause:** The payouts endpoint recomputes a projection from `Order`/`OrderCommission` on the fly and hardcodes `status` by array position instead of reading the real `Settlement` model (which exists and works — see gap-audit #22's admin-only `settlement.service.ts`).
**Files involved:** `apps/backend/src/routes/storefronts.ts:114-179`, `apps/backend/src/services/settlement.service.ts` (real, unused here), `apps/backend/prisma/schema.prisma` (`Settlement` model).
**External blocker:** none; also no bank/UPI detail fields exist anywhere in schema for a real payout to be sent.
**Recommended fix:** Rewire this endpoint to query real `Settlement` rows; add payout-method fields.
**Estimated complexity:** MEDIUM.

### #23 — Storefront Analytics (MOCKED)
**Current behaviour:** Live-confirmed: `GET /storefronts/:id/analytics` returns every field as `0` or empty across all 6 months.
**Expected behaviour:** Real traffic/conversion numbers from tracked page views.
**Root cause:** `StorefrontPageView` model and aggregation queries are real, but nothing in the live app actually calls the `/track` endpoint — the table is never populated.
**Files involved:** `apps/backend/src/routes/storefronts.ts:47-103`, storefront public pages (call-site not found/verified).
**External blocker:** none.
**Recommended fix:** Add a `/track` call from the actual storefront page component on mount.
**Estimated complexity:** LOW.

### #25 — Photo-Based Size Estimation (MOCKED)
**Current behaviour:** Labeled "AI"; is a deterministic formula (`REFERENCE_SHOULDER_CM=43`, fixed ratio constants) applied to MediaPipe pose landmarks. No model, no inference call.
**Expected behaviour:** Either an honestly-labeled heuristic, or a real trained sizing model.
**Root cause:** By design — no ML model was ever integrated for this feature.
**Files involved:** `apps/frontend/lib/ar/body-measurement.service.ts`, `size-recommendation.service.ts`.
**External blocker:** none for relabeling; a real model would need training data + a serving path (possibly BLOCKED_EXTERNAL on an ML vendor).
**Recommended fix:** Relabel honestly at minimum; scope a real model as a separate initiative if required.
**Estimated complexity:** LOW (relabel) / HIGH (real ML model).

### #28 — Garment-Specific Fitting Notes (NOT_IMPLEMENTED)
**Current behaviour:** No fit-notes field exists anywhere in the `Product` model or API response (confirmed via live full-payload inspection).
**Expected behaviour:** Per-garment "runs small/large" guidance.
**Root cause:** Never built.
**Files involved:** `apps/backend/prisma/schema.prisma` (`Product` model), would need a new admin UI.
**External blocker:** none.
**Recommended fix:** Add a `fitNotes` field + admin authoring UI + display on product page.
**Estimated complexity:** LOW–MEDIUM.

### #29 — Size Accuracy Feedback Loop (NOT_IMPLEMENTED)
**Current behaviour:** Live-confirmed: no endpoint accepts "too small/perfect/too large"; the general feedback endpoint's enum has no size-related value (`IMPRESSION/CLICK/DISMISS/WISHLIST/ADD_TO_CART/PURCHASE/HIDE/SKIP/CONVERSION` only).
**Expected behaviour:** Users can rate size accuracy; the system (even manually) uses it to improve recommendations.
**Root cause:** Never built; `AITryOnHistory.feedbackRating` column exists but is dead (never read/written anywhere).
**Files involved:** `apps/backend/src/routes/feedback.ts`, `apps/backend/prisma/schema.prisma` (`AITryOnHistory.feedbackRating`).
**External blocker:** none.
**Recommended fix:** Add a size-feedback endpoint/enum values; wire into `SizeRecommendationService` as a signal.
**Estimated complexity:** MEDIUM.

### #32 — Multi-Outfit Comparison (NOT_IMPLEMENTED)
**Current behaviour:** The only "Compare" control toggles original photo vs. the *current single* overlay — not two different outfits.
**Expected behaviour:** Compare 2+ generated try-on results side by side.
**Root cause:** Never built.
**Files involved:** `apps/frontend/components/ar/ImageUploadCanvas.tsx`.
**External blocker:** none.
**Recommended fix:** Add a real multi-result comparison view (would also need #34 fixed first to have results to compare).
**Estimated complexity:** MEDIUM.

### #33 — Try-On Share to Social (BROKEN)
**Current behaviour:** Live-reproduced: the generated share link (`/try-on?outfit=<base64>`) loads (200) but does not preload the shared outfit — the page reads a differently-named/shaped param (`outfitId`, plain slug). No Web Share API, no real social integration; clipboard copy only.
**Expected behaviour:** A working shareable link, ideally with real WhatsApp/Instagram/community share actions.
**Root cause:** Param name/format mismatch between `generateShareableUrl()` and the page's `searchParams` contract.
**Files involved:** `apps/frontend/lib/ar/wishlist-overlay.service.ts:120-124`, `apps/frontend/app/try-on/page.tsx`.
**External blocker:** none.
**Recommended fix:** Fix the param mismatch (smallest fix in this entire report); add `navigator.share` for real social sharing.
**Estimated complexity:** LOW (link fix) / MEDIUM (real Web Share integration).

### #34 — Try-On History (MOCKED)
**Current behaviour:** Wardrobe page's "Try-On History" tab reads/writes `localStorage` exclusively; live-confirmed `AITryOnHistory`/`ARSession` never touched across a full test session (create post, like, comment, size profile save, etc.).
**Expected behaviour:** Server-persisted, cross-device try-on history.
**Root cause:** Never wired to the backend despite the model existing.
**Files involved:** `apps/frontend/app/wardrobe/page.tsx`, `apps/backend/prisma/schema.prisma` (`AITryOnHistory`).
**External blocker:** none.
**Recommended fix:** Create an `AITryOnHistory` row on successful AI generation; add a list endpoint; wire the wardrobe tab to it.
**Estimated complexity:** MEDIUM.

### #35 — Elasticsearch-Powered Search (NOT_IMPLEMENTED)
**Current behaviour:** Live-confirmed: `?search=deepka` (typo) returns 0 results; search is an in-memory JS substring scan (~100ms) over the full outfit list, not an ES query.
**Expected behaviour:** Fast, typo-tolerant, relevance-ranked search per the stated tech requirement.
**Root cause:** Elasticsearch was never integrated — no client, no index, no dependency anywhere in the repo.
**Files involved:** `apps/backend/src/routes/outfits.ts:40-53`.
**External blocker:** requires standing up and maintaining an ES cluster/index — significant new infrastructure.
**Recommended fix:** Confirm with the source document whether ES is a hard requirement at current catalogue scale (~100 outfits) before committing; if yes, build a real ES-backed search service.
**Estimated complexity:** HIGH.

---

## P2

### #37 — Demographic Filters (NOT_IMPLEMENTED)
**Current behaviour:** `?gender=male` silently ignored; returns the full unfiltered set (live-confirmed, identical count to no filter).
**Expected behaviour:** Filter by gender/age/region/body type.
**Root cause:** No such field exists on `Product`/`Celebrity`; only `UserProfile.gender` exists (a user attribute, not a product-targeting one).
**Files involved:** `apps/backend/src/routes/outfits.ts`, `apps/backend/prisma/schema.prisma`.
**External blocker:** none.
**Recommended fix:** Add product-level demographic targeting field(s) + filter param.
**Estimated complexity:** MEDIUM.

### #40 — Calendar-Driven Fashion Suggestions (MOCKED)
**Current behaviour:** `app/ai-stylist/page.tsx` uses a hardcoded `SEASONS` array and a manual dropdown; zero `new Date()` calls anywhere in the file.
**Expected behaviour:** Suggestions driven by the actual current date/upcoming festival.
**Root cause:** Never built as calendar-driven; only manually-selected season lookup tables exist.
**Files involved:** `apps/frontend/app/ai-stylist/page.tsx` (lines 13, 189, 250-255).
**External blocker:** none (would benefit from a festival-calendar data source, not strictly external).
**Recommended fix:** Default the season selector from `new Date()`; optionally add a real festival calendar.
**Estimated complexity:** LOW (date-default) / MEDIUM (real festival calendar).

### #41 — Trending Now Section (BROKEN)
**Current behaviour:** Live-confirmed: `GET /api/recommendations/trending` → `500 {"message":"Unexpected server error"}`, reproduced twice.
**Expected behaviour:** Real 7/30-day view/purchase-weighted trending list.
**Root cause:** The underlying computation pipeline (`trending.worker.ts`) and read path (`getTrendingRecommendations`) are real, but the live read crashes — root cause not fully isolated in this audit (worth a dedicated debugging pass); likely candidates: unpopulated/malformed `TrendingProduct` rows or a query error.
**Files involved:** `apps/backend/src/services/recommendation.service.ts` (`getTrendingRecommendations`), `apps/backend/src/workers/trending.worker.ts`, `apps/backend/src/routes/recommendations.ts:46-53`.
**External blocker:** none.
**Recommended fix:** Debug the live 500 (add error logging around this path first); then add a scheduler to keep `TrendingProduct` populated.
**Estimated complexity:** MEDIUM.

### #42 — Price Range & Budget Filter (NOT_IMPLEMENTED)
**Current behaviour:** Live-confirmed: `?minPrice=500&maxPrice=2000` returns the full, unfiltered 100-item set, all outside the requested range.
**Expected behaviour:** Server-side price-range filtering.
**Root cause:** `outfits.ts` never reads `minPrice`/`maxPrice` from the query.
**Files involved:** `apps/backend/src/routes/outfits.ts`.
**External blocker:** none.
**Recommended fix:** Add the two params to the route's filter logic.
**Estimated complexity:** LOW.

### #47 — Fan Rating System (BROKEN)
**Current behaviour:** Live-confirmed: `POST /community/fan-ratings/:celebrityId` → `500 {"message":"Unexpected server error"}`, reproduced against two different celebrity ids. Read side (`GET`) works fine, always returning empty.
**Expected behaviour:** Users can rate celebrities/looks; ratings persist and aggregate.
**Root cause:** Likely FK/upsert mismatch — probable cause is the route receiving a legacy celebrity slug where the Prisma `celebrityRating.upsert` expects the internal cuid (same class of bug as #8).
**Files involved:** `apps/backend/src/routes/community.ts` (fan-ratings handler).
**External blocker:** none.
**Recommended fix:** Fix the id resolution in the upsert call; add an integration test.
**Estimated complexity:** LOW–MEDIUM.

### #52 — Personalised Recommendations (BROKEN)
**Current behaviour:** Live-confirmed: `GET /api/recommendations/home` (the documented personalized endpoint) → `500`; `/trending` → `500` (same as #41); `/new-arrivals` → 200 but empty.
**Expected behaviour:** Real, live, multi-signal personalized recommendations on the home/relevant pages.
**Root cause:** Not isolated in this audit; likely shares a root cause with #41 (both route through parts of `recommendation.service.ts` that crash live despite looking complete in source).
**Files involved:** `apps/backend/src/services/recommendation.service.ts`, `apps/backend/src/routes/recommendations.ts`.
**External blocker:** none (though the default embedding provider is a deterministic hash without `OPENAI_API_KEY` — unrelated to this crash).
**Recommended fix:** Debug the live 500 (same investigation as #41, likely overlapping fix).
**Estimated complexity:** MEDIUM.

---

## P3

### #46 — Community Contests (BROKEN)
**Current behaviour:** Live-confirmed: `GET /community/posts/contest` → `404`. Frontend has a fully-built-looking Contest tab and "Enter contest" checkbox that call/set data pointing at nothing.
**Expected behaviour:** Real contest submission/voting/winner mechanism.
**Root cause:** Entire backend was never built; only UI scaffolding exists.
**Files involved:** `apps/frontend/app/community/page.tsx` (Contest tab, `contestEntry` checkbox), `apps/backend/src/routes/community.ts` (no contest route/model at all).
**External blocker:** none.
**Recommended fix:** Build the full server-side mechanism, or remove the dead UI so it stops silently failing for users.
**Estimated complexity:** HIGH (full feature) / LOW (remove dead UI as an interim fix).

---

## Cross-cutting finding: two features actively lie to the user about success

Not separately numbered above (they're sub-behaviors of #44 and #48), but worth flagging together because they represent a distinct, more concerning failure pattern than "feature missing": **the frontend catches the failed API call and still shows the user a success state.**

- **Like/Comment & Share (#44):** `handleShare` calls the (404-ing) `/share` endpoint, then falls through to a client-side clipboard/`navigator.share` action regardless of the API result — the user never learns the share count wasn't recorded server-side.
- **Moderation & Reporting (#48):** `handleReport` wraps the (404-ing) `/report` call in a try/catch that treats any failure as "already reported" and shows "Reported" to the user — a report the backend never received.

**Recommended fix:** Once the underlying routes are implemented (or in the interim), these try/catch blocks should surface the real failure instead of masking it as success.
