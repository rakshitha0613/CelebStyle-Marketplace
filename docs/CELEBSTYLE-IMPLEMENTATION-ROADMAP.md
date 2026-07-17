# CelebStyle Implementation Roadmap

Derived from `docs/CELEBSTYLE-REQUIREMENTS-GAP-AUDIT.md`. Priorities (P0–P3) are **inferred**, not sourced from the official Feature List Document (not available to this session) — reconcile against that document before committing resourcing.

Ordering follows the requested sequence: P0 broken → P0 mocked/UI-only → P0 not implemented → P0 partial → P1 broken → P1 not implemented → remaining P1 → P2 → P3 → cross-platform integrations.

This is a planning document only — **nothing in this roadmap has been implemented.**

---

## 1. P0 broken features
None. No P0 feature is in the BROKEN state.

## 2. P0 mocked / UI-only features

| ID | Feature | Status | Why it's urgent |
|---|---|---|---|
| 11 | Razorpay Payment Integration | MOCKED | Checkout is the platform's core revenue path; it currently completes on a fake `setTimeout` simulation regardless of the `PAYMENT_PROVIDER` env setting. Real gateway code exists but is unreachable from the UI. |

**Recommended action:** rewire `apps/frontend/app/checkout` to call `/api/payments/create` + `/api/payments/verify` instead of `/api/payments/simulate`; obtain real Razorpay test keys to validate end-to-end before going live.

## 3. P0 not implemented features
None. No P0 feature is fully NOT_IMPLEMENTED.

## 4. P0 partial features

| ID | Feature | Missing Work |
|---|---|---|
| 10 | Shopping Cart & Checkout | Real backend (`Cart`/`CartItem`, `checkout.service.ts`) exists and is fully orphaned — frontend uses `localStorage` + a legacy order route instead. Lowest-effort, highest-value fix in this entire audit: point the existing UI at the existing backend. |
| 1 | Celebrity Profile Pages | Real DB columns (`birthYear`, `awards`, social links, IMDb) are captured in schema but never selected or rendered. |

**Recommended action order:** fix #10 first (pure rewiring, backend already complete) → then #1 (repository `select` + template changes).

## 5. P1 broken features

| ID | Feature | Failure |
|---|---|---|
| 19 | Celebrity Storefront Builder | Builder UI is reachable by a celebrity user but the backend route is admin-only — submitting the form returns a silent 403; the page's own auth guard doesn't catch this. |
| 33 | Try-On Share to Social | Share link's query param (`?outfit=<base64>`) doesn't match what `/try-on` actually reads (`?outfitId=<slug>`) — a "shared" link never preloads the outfit. |

**Recommended action:** #19 — add an ownership-based authorization branch (celebrity can edit their own storefront) or explicitly relabel as admin-only. #33 — fix the param name/format mismatch (smallest fix in the whole roadmap: one line in `wishlist-overlay.service.ts`).

## 6. P1 not implemented features

| ID | Feature |
|---|---|
| 28 | Garment-Specific Fitting Notes |
| 29 | Size Accuracy Feedback Loop |
| 35 | Elasticsearch-Powered Search |

**Recommended action:** #35 is the highest-effort item in the whole roadmap (requires standing up and indexing an ES cluster) — confirm with the source document whether "Elasticsearch-powered" is a hard requirement or whether the current DB/JS filtering is acceptable for current scale before committing to it. #28/#29 are additive schema + endpoint work, lower risk.

## 7. Remaining P1 (mocked / UI-only / partial, not yet listed above)

| ID | Feature | Status | Missing Work |
|---|---|---|---|
| 25 | Photo-Based Size Estimation | MOCKED | Rename/relabel accurately, or replace the fixed-ratio formula with a trained model |
| 34 | Try-On History | MOCKED | Wire wardrobe "Try-On History" tab to `AITryOnHistory` instead of `localStorage` |
| 18 | Celebrity/Agent Registration | PARTIAL | Add self-service celebrity/agent signup (currently admin-promotion only) |
| 21 | Endorsed Outfit Curation | PARTIAL | Same auth fix as #19; confirm "endorsed" vs "featured" semantics |
| 22 | Celebrity Payout System | PARTIAL | Rewire celebrity-facing payout view to real `Settlement` records instead of a fabricated projection; add payout-method fields |
| 27 | Size Profile Storage | PARTIAL | Add missing columns (`topSize`/`bottomSize`/`dressSize`/`shoeSize`/`fitPreference`) to `SizeProfile` + include them in the upsert |
| 30 | AR Outfit Overlay Mobile | PARTIAL | Mobile-web works; native app requires a from-scratch Flutter/ARKit/ARCore project if truly required |
| 31 | Static Photo Try-On Web | PARTIAL | Generate real garment images catalogue-wide (blocking issue); confirm Replicate connectivity/billing once network access is available |
| 51 | Wishlist & Saved Looks | PARTIAL | Core is real; adjacent Wardrobe tabs need the same fix as #34 |
| 53 | Notifications | PARTIAL | Call `createNotification()` from order/return/refund event handlers; wire the two dead return/refund email functions |
| 8 | Outfit Similarity Engine | IMPLEMENTED* | *Fully functional; only caveat is the deterministic-hash embedding fallback without `OPENAI_API_KEY` — no action required unless learned embeddings are mandated |
| 52 | Personalised Recommendations | IMPLEMENTED* | Same caveat as #8 |

## 8. P2

| ID | Feature | Status | Note |
|---|---|---|---|
| 2 | Outfit Tagging System | PARTIAL | `Tag`/`ProductTag` schema unused — wire or remove |
| 4 | Producer/Tailor Network Linkage | IMPLEMENTED | as manufacturer/tailor only — confirm intended meaning |
| 7 | Celebrity Fashion Timeline | PARTIAL | needs a real chronological UI |
| 37 | Demographic Filters | NOT_IMPLEMENTED | needs new schema field + UI |
| 40 | Calendar-Driven Fashion Suggestions | MOCKED | hardcoded season dropdown, not calendar-driven |
| 41 | Trending Now Section | PARTIAL | real pipeline, needs a scheduler/cron |
| 42 | Price Range & Budget Filter | PARTIAL | needs server-side filtering |
| 43 | Customer Look Upload | PARTIAL | needs a real file-upload control wired to existing Cloudinary-capable endpoint |
| 44 | Like Comment & Share | PARTIAL | `/share` route + counter missing entirely |
| 47 | Fan Rating System | PARTIAL | rates celebrities, not posts — confirm intended target |
| 48 | Moderation & Reporting | PARTIAL | `/report` route + `Report` model missing entirely |
| 32 | Multi-Outfit Comparison | NOT_IMPLEMENTED | net-new UI |

## 9. P3

| ID | Feature | Status | Note |
|---|---|---|---|
| 46 | Community Contests | BROKEN | entire backend missing; frontend actively calls a dead route today — either build it or remove the dead UI to stop the silent failure |

## 10. Cross-platform integrations

| Item | Status |
|---|---|
| Elasticsearch | NOT_PRESENT — see P1 item #35 above |
| Flutter mobile app | NOT_PRESENT — no native mobile project exists |
| ARKit / ARCore | NOT_PRESENT — AR is entirely web-based (MediaPipe + WebGL) |
| Cloudinary | Code complete, BLOCKED_EXTERNAL pending real account credentials |
| Razorpay | Code complete, BLOCKED_EXTERNAL pending real account credentials (also see P0 item #11 — currently bypassed regardless) |
| AWS | NOT_PRESENT — deployment target is Docker/GHCR + Vercel |
| EduCIBIL / SkillsDrome / StoreReady / FlavoursOfIndia / UnityKart | NOT_PRESENT — no evidence these are part of this codebase or its ecosystem at all; confirm with source document whether these belong to a different product |

---

## Suggested first task

Given the ordering above, the single highest-leverage next task is **#10 — Shopping Cart & Checkout**: the real, tested, DB-backed backend already exists in full (`Cart`/`CartItem`/`checkout.service.ts`/`POST /api/checkout/confirm`); the only work is rewiring `apps/frontend/app/cart` and `app/checkout` to call it instead of `localStorage` + the legacy order route. It is P0, requires no new backend code, and directly unblocks a correct read of #11 (Razorpay) and #12 (Commission Engine) in production use.
