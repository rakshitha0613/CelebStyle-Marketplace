# CelebStyle Feature Status Summary

Companion to `docs/CELEBSTYLE-COMPLETE-FUNCTIONAL-AUDIT.md`. Dummy/seeded/simulated data is accepted per the project's dev-stage rule — `[DEMO]` is a **good** outcome here, not a penalty.

## HOME
- [PASS] Nav bar (10 items, load + refresh)
- [PASS] Hero CTAs
- [DEMO] Featured celebrity/outfit cards
- [PASS] Try-On pill on cards
- [UI] Color/category tag pills — no-op on Home (prop not wired)
- [PASS] Collection preview cards
- [DEMO] Customer reviews section
- [PASS] Blog preview cards
- [PASS] Occasion suggestion cards

## CELEBRITIES
- [PASS] Listing (101/101)
- [PASS] Industry filters
- [PASS] First 10 celebrity profiles (bio, tags, scoped outfits, images)
- [FAIL] "Similar" recommendations on outfit pages — 404, id/slug bug
- [PARTIAL] Fashion Timeline — no chronological grouping UI

## COLLECTIONS
- [DEMO] Listing + detail + real filtered outfit membership
- [PARTIAL] Power Dressing cover image missing (graceful placeholder)

## SEARCH
- [DEMO] Text search + 9 filters, full client-side flow works correctly
- *(separately reported, not scored here: Elasticsearch is NOT_IMPLEMENTED — plain substring match, no typo tolerance)*

## TRENDING
- [FAIL] Trending Outfits carousel — live 500, `TrendingProduct` table missing from the database (migration bug)
- [DEMO] Colours/Categories/Occasions/Celebrities/Aspirational sections — real, computed independently, unaffected by the above

## TRY-ON
- [DEMO] Live Camera mode
- [PASS] Upload Photo + EXIF orientation handling
- [PARTIAL] Garment selection — 0/10 pilot outfits have a real garment image (correctly shows "not ready", no fake fallback)
- [EXTERNAL] AI Generate (IDM-VTON) — real request built, blocked by local network/TLS, not billing
- [PASS] Download
- [PARTIAL] Compare — single-outfit only, no multi-outfit comparison

## AI STYLIST
- [DEMO] All inputs (occasion/season/budget/body-type) genuinely react to change
- [PASS] Recommendation card → outfit/Try-On navigation

## WARDROBE
- [PASS] Wishlist tab — full add/remove/persist cycle
- [DEMO] Recently Viewed / Try-On History — localStorage, survives refresh, not cross-device
- [MISSING] Manual "add custom item" form

## COMMUNITY / REVIEWS — SERVER STABILITY
- [FAIL] **Any request with an expired/invalid Bearer token to `/api/community/*` or `/api/reviews/*` crashes the entire backend process** — missing `await` on `verifyAccessToken()` in both routes' `optionalUserId()` helper causes an unhandled promise rejection that terminates Node. Confirmed live (this crashed the audit's own backend instance) and confirmed in source (`community.ts:78`, `reviews.ts:77`). This is the single most severe finding in this audit — an unauthenticated, trivially-reproducible full-outage bug, not a feature-scoped issue.

## COMMUNITY
- [DEMO] Post feed (seeded)
- [DEMO] Create post (URL-based; no device upload)
- [PASS] Like / Comment (persist correctly)
- [FAIL] Share — 404, UI fakes success anyway
- [FAIL] Report — 404, UI fakes success anyway
- [PARTIAL] Shop the Look — works for seeded posts, broken for newly-created posts (id/slug bug)
- [FAIL] Contests — entire backend missing, dead UI
- [FAIL] Fan Rating — write crashes with live 500

## BLOG
- [DEMO] Listing + detail (real DB content)
- [PASS] Article detail page render (transient 500 during the resource incident, confirmed fixed post-recovery)
- [PASS] Share (real Web Share API + clipboard fallback)
- [DEMO] Create/Edit/Publish/Delete — real, role+ownership gated (code-verified)

## AUTHENTICATION
- [PASS] Email/password registration + validation
- [MISSING] Celebrity/Agency/Manufacturer registration path
- [PASS] Login (valid/invalid/no-token/garbage-token all correct)
- [MISSING] OAuth (Google/Facebook) — no route exists

## PROFILE
- [PASS] Edit + persist

## PRODUCTS
- [PASS] First 10 outfit detail pages (hero/price/description/manufacturer)
- [PASS] Try-On / Add to Cart / Wishlist buttons

## CART
- [DEMO] Add/remove/recalculate (client-side, logic verified correct; no quantity stepper)

## CHECKOUT
- [DEMO] Address → Order → Simulated Payment → Confirmation (full chain live-fired successfully)
- [FAIL] Coupon lookup — 100x rupee/paise unit-mismatch bug, silently under-discounts and bypasses minimum-order rules

## ORDERS
- [PASS] List, detail, RBAC-gated status transitions (placed→production started→shipped→delivered)

## COMMISSION
- [PASS] 10/5/85 split, verified live with real order, no floating-point drift

## SIZE ESTIMATOR
- [PASS] Manual measurement save/reload (valid input)
- [MISSING] cm/inches unit toggle
- [PARTIAL] Invalid-input handling — silently accepts ≤0, crashes 500 on non-numeric
- [DEMO] Photo-based estimation display — **DEMO ESTIMATION LOGIC (deterministic geometry), explicitly NOT a trained AI model**
- [PARTIAL] Photo-based estimation → Save — no save action exists in this flow at all

## CELEBRITY STOREFRONT
- [DEMO] Customer-facing display (banner/bio/featured outfits)
- [FAIL] Celebrity self-service edit — 403 for the celebrity it's meant for
- [DEMO] Analytics — now genuinely computed (improved since an earlier audit pass)
- [PARTIAL] Payouts — real financial totals, fabricated PAID/PENDING status

## ADMIN
- [PASS] Celebrity CRUD (full cycle, RBAC-gated)
- [PASS] Outfit CRUD + manufacturer linking
- [PARTIAL] Community moderation — real queue, but "reports" always empty (matches Report being unimplemented)

## MANUFACTURER
- [DEMO] Listing + profile data
- [DEMO] Order routing assignment
- [DEMO] Manufacturer-portal dashboard (code-verified real logic; no manufacturer-role test account existed to fully drive live)

## IMAGES
See the detailed first-10 tables in prior audit sessions this project (`docs/CELEBSTYLE-FUNCTIONAL-VERIFICATION.md` §3–4, `scripts/tryon-pilot-report.json`) — carried forward as still accurate:
- [PASS] First 10 celebrity portrait/banner images — all real, all load
- [PARTIAL] First 10 outfit hero images — 9/10 real; `look-akshay-kumar-kesari` missing `hero.webp`
- [FAIL] First 10 Try-On garment images — 0/10 real; all resolve to a 404, this session's fix now shows an honest "not ready" state instead of a fake placeholder

---

## FINAL RESULT

**Total features identified:** 70
**Total features tested:** 70 (all classified; several with explicit live-vs-code-verified distinctions noted in the full table)

| Status | Count |
|---|---|
| FULLY_WORKING | 26 |
| WORKING_WITH_DUMMY_DATA | 20 |
| PARTIALLY_WORKING | 9 |
| UI_ONLY | 1 |
| BROKEN | 9 |
| NOT_IMPLEMENTED | 4 |
| EXTERNAL_SERVICE_BLOCKED | 1 |
| DEVICE_TEST_REQUIRED | 0 |
| **Total** | **70** |

**Scoring** (FULLY_WORKING=1.0, WORKING_WITH_DUMMY_DATA=0.8, PARTIALLY_WORKING=0.5, UI_ONLY=0.2, BROKEN=0, NOT_IMPLEMENTED=0; EXTERNAL_SERVICE_BLOCKED and DEVICE_TEST_REQUIRED excluded from both numerator and denominator):

`(26×1.0 + 20×0.8 + 9×0.5 + 1×0.2) / (70 − 1 − 0) = 46.7 / 69`

## **FUNCTIONALLY USABLE: 67.7%**

## IS CELEBSTYLE CURRENTLY FUNCTIONALLY WORKING?

# PARTIALLY — FUNCTIONAL BUT INCOMPLETE

The entire core golden path — browse celebrities/outfits/collections → search/filter → add to cart → checkout → simulated payment → order created and status-tracked → commission correctly calculated — works end-to-end right now, using the project's explicitly-accepted seeded/simulated data. That's the majority of what a demo/acceptance reviewer would click through. But real, live-reproduced defects exist beyond "just dummy data," and one of them is materially more severe than a numeric score can convey: **any request with an expired token to the Community or Reviews API crashes the entire backend for every user**, discovered live when it crashed this very audit. That single bug is arguably disqualifying for any real deployment regardless of the 67.7% score, and should be treated as more urgent than the score suggests. Beyond that: a coupon math bug that actively shortchanges discounts, a database migration that silently dropped the Trending/Recommendations table, three Community actions (Share/Report/Contests) that are dead on the backend while the frontend lies about success, a Fan Rating write that crashes, and a Celebrity Storefront self-edit that 403s the very role it's for. None of these (apart from the crash bug) block the primary shopping journey, which is why the overall verdict isn't "major functional failures exist" — but they're real bugs, not acceptable dummy-data gaps.

---

## Top 10 working features
1. Celebrity listing + first-10 profiles (101/101, all real)
2. Admin Celebrity & Outfit CRUD (full cycle, RBAC-correct)
3. Auth register/login (correct accept/reject in every case tested)
4. Order lifecycle + RBAC-gated status transitions
5. Commission calculation (exact, no float drift)
6. Wishlist add/remove/persist
7. Checkout → order → simulated payment → confirmation chain
8. Outfit detail pages (hero/price/description/manufacturer, all 10 tested)
9. Blog listing/detail/share
10. Home page navigation and CTAs (9/10 elements correctly wired; 1 dead tag-pill)

## Top 10 features working with dummy data (acceptable, per project stage)
1. Search (full client-side filter flow, real seeded catalogue)
2. Collections (real Prisma-backed, real filtered membership)
3. AI Stylist (deterministic, genuinely input-reactive)
4. Cart (client-side, logic verified correct)
5. Community post feed + creation
6. Manufacturer listing + order routing
7. Storefront customer-facing display + analytics
8. Live Camera Try-On mode
9. Photo-based size estimation display (explicitly demo logic, not AI)
10. Blog CRUD (code-verified, role-gated)

## Top 10 broken features
1. **Backend crashes entirely on any expired/invalid token to `/api/community/*` or `/api/reviews/*`** — unhandled promise rejection, took down this audit's own server, most severe finding overall
2. Coupon lookup — 100x rupee/paise bug, live-verified
3. Trending Outfits — live 500, missing `TrendingProduct` table (migration bug)
4. Outfit Similarity ("Similar Looks") — 404 on every outfit, id/slug mismatch
5. Community Share — 404, masked as fake success
6. Community Report — 404, masked as fake success
7. Community Contests — entire backend missing, dead UI
8. Community Fan Rating — write crashes with 500
9. Celebrity Storefront self-edit — 403 for the celebrity role it's built for
10. Community "Shop the Look" on new posts — id/slug bug (same class as #4)

## Top UI-only features
1. Home page color/category tag pills — `onClick` is a complete no-op

## Top external service blockers
1. Virtual Try-On AI Generate (Replicate/IDM-VTON) — real request built correctly, blocked by this machine's local TLS interception (not billing/credit — unverifiable either way since the request never leaves the machine)
2. *(configuration-only, not a live test failure)* Razorpay — real gateway code exists, no API keys configured, and the live checkout intentionally uses the accepted simulated-payment path instead
3. *(configuration-only)* Cloudinary — real SDK integrated, no `CLOUDINARY_URL` configured

## First 10 celebrity results
Shah Rukh Khan, Deepika Padukone, Priyanka Chopra, Ranveer Singh, Hrithik Roshan, Alia Bhatt, Katrina Kaif, Akshay Kumar, Salman Khan, Allu Arjun — **all 10: FULLY_WORKING** (profile load, image load, bio, tags, correctly-scoped outfit archive, no broken assets).

## First 10 outfit results
look-shah-rukh-khan-red-carpet, look-shah-rukh-khan-jawan, look-ranveer-singh-gully-boy, look-hrithik-roshan-war, look-akshay-kumar-kesari, look-salman-khan-bajrangi, look-ranbir-kapoor-animal, look-vicky-kaushal-uri, look-amitabh-bachchan-pink, look-deepika-padukone-wedding — **all 10: FULLY_WORKING** for the product page itself (hero image, price, description, manufacturer, Try-On/Cart/Wishlist buttons); **1 of 10** (`look-akshay-kumar-kesari`) is missing its `hero.webp` (falls back gracefully, not a crash).

## First 10 Try-On results
Same 10 outfits — **all 10: PARTIALLY_WORKING**. Garment image is 404 for all 10 (correctly shown as "not ready," not a fake placeholder, per this session's fix); AI Generate is EXTERNAL_SERVICE_BLOCKED for all 10 (network layer, not billing).

---

## Recommended next task (not started — awaiting your approval)

Fix the **backend crash-on-expired-token bug** first (`apps/backend/src/routes/community.ts:78` and `apps/backend/src/routes/reviews.ts:77` — add the missing `await` to `verifyAccessToken(...)` inside `optionalUserId()`). This overrides the coupon bug as the top priority: it's a full-outage bug, not a feature-scoped one — it crashed this very audit's server, requires no special privileges to trigger (any client, any expired 15-minute-old token, on two public route groups), and is a two-line fix in two files. Every other finding in this report only matters if the server stays up; this one determines whether it does. The coupon rupee/paise bug (`apps/backend/src/services/coupon.service.ts`) is the recommended second task.
