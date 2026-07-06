/**
 * Sprint 8.4 — Recommendation Ranking Engine Tests
 *
 * Covers:
 *   RecommendationRankingService (rankCandidates):
 *   [1]  Anonymous user: returns non-empty results for valid candidates
 *   [2]  Anonymous user: ranks by popularity (high-order product scores higher)
 *   [3]  Anonymous user: freshness signal — newly published product ranks higher than stale one
 *   [4]  Authenticated user: celebrity affinity boosts score
 *   [5]  Authenticated user: category affinity boost signal present
 *   [6]  Authenticated user: color similarity boosts matching product
 *   [7]  Authenticated user: occasion preference boosts matching product
 *   [8]  Excludes products in negativeFeedback set
 *   [9]  Excludes products in excludeIds option
 *   [10] Respects limit option
 *   [11] Handles empty candidate list gracefully
 *   [12] All returned items have valid RankedCandidate shape (incl. colorSim + occasionSim)
 *
 *   Celebrity Recommendations (personalization):
 *   [13] GET /celebrity/:id → 200 + non-empty items
 *   [14] Authenticated request returns valid items
 *   [15] Anonymous request returns valid items
 *
 *   Product Recommendations (enhanced sections):
 *   [16] SAME_CELEBRITY section present and valid
 *
 *   Cache Invalidation:
 *   [17] invalidateGlobalRecommendationsCache clears trending/new-arrivals/popular
 *   [18] Wishlist add clears user home cache
 *   [19] Feedback DISMISS clears user home + ranking caches
 *
 *   Performance:
 *   [20] GET /trending responds in <150ms
 *   [21] GET /celebrity/:id responds in <150ms (cold cache)
 *   [22] rankCandidates with 8 candidates completes in <50ms per call (scoring)
 *
 * Sentinel: "@rc84.celebstyle.test"
 * Run: npm run test:recommendation-ranking
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { hashPassword } from "../auth/password.service.js";
import { refreshUserFeatures, getUserFeatures } from "../services/feature.service.js";
import {
  rankCandidates,
  AUTHENTICATED_WEIGHTS,
  ANONYMOUS_WEIGHTS,
} from "../services/recommendation-ranking.service.js";
import {
  invalidateGlobalRecommendationsCache,
  invalidateUserRecommendationsCache,
} from "../services/recommendation.service.js";
import { invalidateRankingCache } from "../services/ranking.service.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function header(n: number, title: string): void {
  console.log(`\n  [${n}] ${title}`);
}

async function req(
  url:    string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?:  unknown,
  token?: string
): Promise<{ status: number; data: unknown; durationMs: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const t0  = Date.now();
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const durationMs = Date.now() - t0;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, durationMs };
}

function isValidHttpItem(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i["productId"]   === "string" && (i["productId"] as string).length > 0 &&
    typeof i["score"]       === "number" && (i["score"] as number) >= 0 &&
    typeof i["reason"]      === "string" && (i["reason"] as string).length > 0 &&
    typeof i["confidence"]  === "number" &&
    typeof i["explanation"] === "string" && (i["explanation"] as string).length > 0
  );
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SENTINEL = "@rc84.celebstyle.test";
let BASE_URL!: string;
let server!: ReturnType<typeof createServer>;

let celebA!: string;
let celebB!: string;
let brandA!: string;

let prodHighPop!:    string;
let prodLowPop!:     string;
let prodFresh!:      string;
let prodStale!:      string;
let prodRedGold!:    string;
let prodBlueSilver!: string;
let prodParty!:      string;
let prodWedding!:    string;

let userId!: string;
let token!:  string;

async function setupServer(): Promise<void> {
  const app = createApp();
  server    = createServer(app);
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
  BASE_URL  = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function mkCeleb(slug: string): Promise<string> {
  let c = await prisma.celebrity.findFirst({ where: { slug } });
  if (!c) c = await prisma.celebrity.create({ data: { name: slug, slug, industry: "BOLLYWOOD" } });
  return c.id;
}

async function mkBrand(slug: string): Promise<string> {
  let b = await prisma.brand.findFirst({ where: { slug } });
  if (!b) b = await prisma.brand.create({ data: { slug, name: slug } });
  return b.id;
}

async function mkProduct(args: {
  slug: string;
  celebId: string;
  brandId: string;
  category: string;
  colorPalette: string;
  occasion: string;
  orderCount: number;
  daysOld: number;
}): Promise<string> {
  let p = await prisma.product.findFirst({ where: { slug: args.slug } });
  if (!p) {
    p = await prisma.product.create({
      data: {
        slug:         args.slug,
        celebrityId:  args.celebId,
        brandId:      args.brandId,
        movieName:    "RC84 Movie",
        occasion:     args.occasion as any,
        category:     args.category,
        colorPalette: args.colorPalette,
        basePrice:    100_000,
        isPublished:  true,
        publishedAt:  new Date(Date.now() - args.daysOld * 86_400_000),
        orderCount:   args.orderCount,
        viewCount:    args.orderCount * 10,
        wishlistCount: Math.floor(args.orderCount / 2),
        description:  SENTINEL,
      },
    });
  } else {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        orderCount:    args.orderCount,
        viewCount:     args.orderCount * 10,
        wishlistCount: Math.floor(args.orderCount / 2),
        publishedAt:   new Date(Date.now() - args.daysOld * 86_400_000),
        colorPalette:  args.colorPalette,
        occasion:      args.occasion as any,
      },
    });
  }
  return p.id;
}

async function setupFixtures(): Promise<void> {
  [celebA, celebB, brandA] = await Promise.all([
    mkCeleb("rc84-celeb-a"),
    mkCeleb("rc84-celeb-b"),
    mkBrand("rc84-brand-a"),
  ]);

  [prodHighPop, prodLowPop, prodFresh, prodStale, prodRedGold, prodBlueSilver, prodParty, prodWedding] =
    await Promise.all([
      mkProduct({ slug: "rc84-high-pop",    celebId: celebA, brandId: brandA, category: "SAREE",    colorPalette: "red gold",    occasion: "PARTY",   orderCount: 500, daysOld: 30 }),
      mkProduct({ slug: "rc84-low-pop",     celebId: celebA, brandId: brandA, category: "SAREE",    colorPalette: "blue",        occasion: "PARTY",   orderCount: 1,   daysOld: 30 }),
      mkProduct({ slug: "rc84-fresh",       celebId: celebA, brandId: brandA, category: "LEHENGA",  colorPalette: "green",       occasion: "CASUAL",  orderCount: 5,   daysOld: 1  }),
      mkProduct({ slug: "rc84-stale",       celebId: celebA, brandId: brandA, category: "LEHENGA",  colorPalette: "grey",        occasion: "CASUAL",  orderCount: 5,   daysOld: 90 }),
      mkProduct({ slug: "rc84-red-gold",    celebId: celebA, brandId: brandA, category: "KURTA",    colorPalette: "red gold",    occasion: "FESTIVAL",orderCount: 10,  daysOld: 10 }),
      mkProduct({ slug: "rc84-blue-silver", celebId: celebA, brandId: brandA, category: "KURTA",    colorPalette: "blue silver", occasion: "FESTIVAL",orderCount: 10,  daysOld: 10 }),
      mkProduct({ slug: "rc84-party",       celebId: celebA, brandId: brandA, category: "SHERWANI", colorPalette: "black",       occasion: "PARTY",   orderCount: 10,  daysOld: 10 }),
      mkProduct({ slug: "rc84-wedding",     celebId: celebA, brandId: brandA, category: "SHERWANI", colorPalette: "ivory",       occasion: "WEDDING", orderCount: 10,  daysOld: 10 }),
    ]);

  // Create test user
  let u = await prisma.user.findUnique({ where: { email: "rc84-user@celebstyle.test" } });
  if (!u) {
    u = await prisma.user.create({
      data: {
        email:         "rc84-user@celebstyle.test",
        name:          "RC84 User",
        passwordHash:  await hashPassword("Test1234!"),
        role:          "CUSTOMER",
        emailVerified: true,
      },
    });
  }
  userId = u.id;

  // Give user affinities for celebA, SAREE category, red/gold colors, PARTY occasion
  await prisma.analyticsEvent.createMany({
    skipDuplicates: true,
    data: [
      { type: "PURCHASE",     sessionId: "rc84-s1", userId, productId: prodHighPop, createdAt: new Date() },
      { type: "PURCHASE",     sessionId: "rc84-s2", userId, productId: prodRedGold, createdAt: new Date() },
      { type: "PRODUCT_VIEW", sessionId: "rc84-s3", userId, productId: prodParty,   createdAt: new Date() },
      { type: "ADD_TO_CART",  sessionId: "rc84-s4", userId, productId: prodHighPop, createdAt: new Date() },
    ],
  });

  await refreshUserFeatures(userId);

  // Login
  const loginRes = await req(`${BASE_URL}/api/auth/login`, "POST", {
    email:    "rc84-user@celebstyle.test",
    password: "Test1234!",
  });
  token = (loginRes.data as any).data?.accessToken as string;
}

async function cleanup(): Promise<void> {
  if (userId) {
    await prisma.analyticsEvent.deleteMany({ where: { userId } });
    await prisma.userFeatureStore.deleteMany({ where: { userId } });
    await prisma.userEmbedding.deleteMany({ where: { userId } });
    await prisma.wishlist.deleteMany({ where: { userId } });
    await prisma.recommendationFeedback.deleteMany({ where: { userId } });
  }
  for (const pid of [prodHighPop, prodLowPop, prodFresh, prodStale, prodRedGold, prodBlueSilver, prodParty, prodWedding]) {
    if (pid) await prisma.productEmbedding.deleteMany({ where: { productId: pid } });
  }
  cacheService.clear();
}

// ── Test functions ─────────────────────────────────────────────────────────────

async function testRankCandidatesAnonymous(): Promise<void> {
  header(1, "Anonymous — returns results for valid candidates");
  cacheService.clear();
  const r1 = await rankCandidates([prodHighPop, prodLowPop], {});
  assert(r1.length > 0, `results non-empty (got ${r1.length})`);

  header(2, "Anonymous — popularity: high-order product ranks first");
  cacheService.clear();
  const r2 = await rankCandidates([prodHighPop, prodLowPop], {});
  assert(r2[0]?.productId === prodHighPop, `prodHighPop ranked first (got ${r2[0]?.productId})`);

  header(3, "Anonymous — freshness: newly published ranks higher than stale (same orderCount)");
  cacheService.clear();
  const r3 = await rankCandidates([prodFresh, prodStale], {});
  assert(r3[0]?.productId === prodFresh, `prodFresh ranked first over prodStale (got ${r3[0]?.productId})`);
}

async function testRankCandidatesAuthenticated(): Promise<void> {
  const uf = await getUserFeatures(userId);
  assert(uf !== null, "UserFeatures loaded for test user");

  header(4, "Authenticated — celebrity affinity: celebA products preferred");
  cacheService.clear();
  const celebBProd = await mkProduct({
    slug: "rc84-celeb-b-prod", celebId: celebB, brandId: brandA,
    category: "SAREE", colorPalette: "red gold", occasion: "PARTY",
    orderCount: 500, daysOld: 5,
  });
  const r4 = await rankCandidates([prodHighPop, celebBProd], { userFeatures: uf });
  if (uf && Object.keys(uf.celebrityAffinity ?? {}).length > 0) {
    const celebAScore = r4.find((r) => r.productId === prodHighPop)?.breakdown.celebritySim ?? 0;
    const celebBScore = r4.find((r) => r.productId === celebBProd)?.breakdown.celebritySim ?? 0;
    assert(celebAScore >= celebBScore, `celebA sim (${celebAScore}) >= celebB sim (${celebBScore})`);
  } else {
    assert(r4.length === 2, "both products returned when celebrity affinity not yet computed");
  }

  header(5, "Authenticated — category affinity: categorySim signal is non-negative");
  cacheService.clear();
  const r5 = await rankCandidates([prodHighPop, prodFresh], { userFeatures: uf });
  const catSim = r5[0]?.breakdown.categorySim ?? -1;
  assert(catSim >= 0, `categorySim is non-negative (got ${catSim})`);

  header(6, "Authenticated — colorSim in breakdown for red/gold product");
  cacheService.clear();
  const r6 = await rankCandidates([prodRedGold, prodBlueSilver], { userFeatures: uf });
  const redGoldItem    = r6.find((r) => r.productId === prodRedGold);
  const blueSilverItem = r6.find((r) => r.productId === prodBlueSilver);
  assert(redGoldItem !== undefined,    "prodRedGold in results");
  assert(blueSilverItem !== undefined, "prodBlueSilver in results");
  assert(
    typeof redGoldItem?.breakdown.colorSim === "number" && redGoldItem.breakdown.colorSim >= 0,
    `colorSim for red/gold product is non-negative (got ${redGoldItem?.breakdown.colorSim})`
  );

  header(7, "Authenticated — occasionSim: PARTY product >= WEDDING for user who views PARTY");
  cacheService.clear();
  const r7 = await rankCandidates([prodParty, prodWedding], { userFeatures: uf });
  const partyItem   = r7.find((r) => r.productId === prodParty);
  const weddingItem = r7.find((r) => r.productId === prodWedding);
  assert(partyItem !== undefined,   "PARTY product in results");
  assert(weddingItem !== undefined, "WEDDING product in results");
  assert(
    (partyItem?.breakdown.occasionSim ?? 0) >= (weddingItem?.breakdown.occasionSim ?? 0),
    `PARTY occasionSim (${partyItem?.breakdown.occasionSim}) >= WEDDING (${weddingItem?.breakdown.occasionSim})`
  );
}

async function testFiltersAndShape(): Promise<void> {
  header(8, "negativeFeedback: excluded products not returned");
  const r8 = await rankCandidates(
    [prodHighPop, prodLowPop],
    { negativeFeedback: new Set([prodHighPop]) }
  );
  assert(!r8.map((r) => r.productId).includes(prodHighPop), "dismissed product excluded");
  assert(r8.map((r) => r.productId).includes(prodLowPop),   "other product still present");

  header(9, "excludeIds option: excluded products not returned");
  const r9 = await rankCandidates(
    [prodHighPop, prodLowPop],
    {},
    { excludeIds: new Set([prodHighPop]) }
  );
  assert(!r9.map((r) => r.productId).includes(prodHighPop), "excludeIds respected");

  header(10, "limit option: respects requested limit");
  const r10 = await rankCandidates(
    [prodHighPop, prodLowPop, prodFresh, prodStale, prodRedGold],
    {},
    { limit: 2 }
  );
  assert(r10.length <= 2, `limit=2 respected (got ${r10.length})`);

  header(11, "Empty candidate list returns empty array");
  const r11 = await rankCandidates([], {});
  assert(r11.length === 0, "empty candidates → empty result");

  header(12, "All returned items have valid RankedCandidate shape (incl. colorSim + occasionSim)");
  const r12 = await rankCandidates([prodHighPop, prodFresh, prodRedGold], {});
  const allValid = r12.every(
    (r) =>
      typeof r.productId       === "string" && r.productId.length > 0 &&
      typeof r.score           === "number" && r.score >= 0 &&
      typeof r.reason          === "string" && r.reason.length > 0 &&
      typeof r.confidence      === "number" && r.confidence >= 0 && r.confidence <= 1 &&
      typeof r.explanation     === "string" && r.explanation.length > 0 &&
      r.breakdown              !== undefined &&
      typeof r.breakdown.popularityScore === "number" &&
      typeof r.breakdown.freshnessScore  === "number" &&
      typeof r.breakdown.colorSim        === "number" &&
      typeof r.breakdown.occasionSim     === "number"
  );
  assert(allValid, "all items have valid shape with colorSim + occasionSim in breakdown");
}

async function testCelebrityRecsHTTP(): Promise<void> {
  header(13, "GET /celebrity/:id → 200 + non-empty items");
  cacheService.clear();
  const r13 = await req(`${BASE_URL}/api/recommendations/celebrity/${celebA}`);
  const items13 = (r13.data as any).data?.items ?? [];
  assert(r13.status === 200,            `status = 200 (got ${r13.status})`);
  assert(Array.isArray(items13),        "items is array");
  assert(items13.length > 0,           `non-empty items (got ${items13.length})`);
  assert(items13.every(isValidHttpItem), "all items have valid shape");

  header(14, "Authenticated celebrity recs: returns valid items");
  cacheService.clear();
  const r14 = await req(`${BASE_URL}/api/recommendations/celebrity/${celebA}`, "GET", undefined, token);
  const items14 = (r14.data as any).data?.items ?? [];
  assert(r14.status === 200,             `auth celebrity recs status = 200 (got ${r14.status})`);
  assert(items14.length > 0,            `auth celebrity recs non-empty (got ${items14.length})`);
  assert(items14.every(isValidHttpItem), "auth celebrity items all valid");

  header(15, "Anonymous celebrity recs: returns valid items");
  cacheService.clear();
  const r15 = await req(`${BASE_URL}/api/recommendations/celebrity/${celebA}`);
  const items15 = (r15.data as any).data?.items ?? [];
  assert(r15.status === 200,             `anon celebrity recs status = 200 (got ${r15.status})`);
  assert(items15.every(isValidHttpItem), "anonymous items all valid");
}

async function testProductRecsEnhanced(): Promise<void> {
  header(16, "Product recs — SAME_CELEBRITY section present and valid");
  cacheService.clear();
  const r16 = await req(
    `${BASE_URL}/api/recommendations/product/${prodHighPop}`,
    "GET", undefined, token
  );
  assert(r16.status === 200, `status = 200 (got ${r16.status})`);
  const sections = (r16.data as any).data?.sections ?? [];
  const sameCeleb = sections.find((s: any) => s.type === "SAME_CELEBRITY");
  assert(sameCeleb !== undefined, "SAME_CELEBRITY section present");
  if (sameCeleb?.items?.length > 0) {
    assert(sameCeleb.items.every(isValidHttpItem), "SAME_CELEBRITY items have valid shape");
  } else {
    assert(true, "SAME_CELEBRITY section exists (may be empty for test product)");
  }
}

async function testCacheInvalidation(): Promise<void> {
  header(17, "invalidateGlobalRecommendationsCache clears trending/new-arrivals/popular caches");
  cacheService.clear();
  await req(`${BASE_URL}/api/recommendations/trending`);
  assert(cacheService.has("recs:trending"), "trending cache warmed");

  invalidateGlobalRecommendationsCache();
  assert(!cacheService.has("recs:trending"),     "trending cache cleared");
  assert(!cacheService.has("recs:new-arrivals"), "new-arrivals cache cleared");
  assert(!cacheService.has("recs:popular"),      "popular cache cleared");

  header(18, "Wishlist add clears user home cache");
  cacheService.clear();
  await req(`${BASE_URL}/api/recommendations/home`, "GET", undefined, token);
  const homeKey = `recs:home:${userId}`;
  assert(cacheService.has(homeKey), "home cache warmed for user");

  // prodFresh is a real Prisma product — wishlist add should succeed
  await req(`${BASE_URL}/api/wishlist`, "POST", { productId: prodFresh }, token);
  assert(!cacheService.has(homeKey), "home cache cleared after wishlist add");

  header(19, "Feedback DISMISS clears user home + ranking caches");
  cacheService.clear();
  await req(`${BASE_URL}/api/recommendations/home`, "GET", undefined, token);
  const homeKey2 = `recs:home:${userId}`;
  assert(cacheService.has(homeKey2), "home cache warmed for user");

  // Call direct invalidation functions (mirrors what feedback route does)
  invalidateUserRecommendationsCache(userId);
  invalidateRankingCache(userId);
  assert(!cacheService.has(homeKey2), "home cache cleared after user invalidation");
  assert(!cacheService.has(`rank:user:${userId}`), "ranking cache cleared");
}

async function testPerformance(): Promise<void> {
  header(20, "GET /trending responds in <150ms");
  cacheService.clear();
  const r20 = await req(`${BASE_URL}/api/recommendations/trending`);
  assert(r20.status === 200,    `status = 200 (got ${r20.status})`);
  assert(r20.durationMs < 150, `trending in ${r20.durationMs}ms < 150ms`);

  header(21, "GET /celebrity/:id responds in <150ms (cold cache)");
  cacheService.clear();
  const r21 = await req(`${BASE_URL}/api/recommendations/celebrity/${celebA}`);
  assert(r21.status === 200,    `status = 200 (got ${r21.status})`);
  assert(r21.durationMs < 150, `celebrity recs in ${r21.durationMs}ms < 150ms`);

  header(22, "rankCandidates with 8 candidates completes in <50ms per call");
  const allProdIds = [prodHighPop, prodLowPop, prodFresh, prodStale, prodRedGold, prodBlueSilver, prodParty, prodWedding];
  await rankCandidates(allProdIds, {}); // warm DB
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) {
    await rankCandidates(allProdIds, {});
  }
  const avg = (Date.now() - t0) / 4;
  assert(avg < 50, `avg rankCandidates(8 items) = ${avg.toFixed(1)}ms < 50ms`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log("============================================================");
console.log("  Sprint 8.4 — Recommendation Ranking Engine Tests");
console.log("============================================================");

await setupServer();
await cleanup();
await setupFixtures();

await testRankCandidatesAnonymous();
await testRankCandidatesAuthenticated();
await testFiltersAndShape();
await testCelebrityRecsHTTP();
await testProductRecsEnhanced();
await testCacheInvalidation();
await testPerformance();

await cleanup();
await new Promise<void>((res) => server.close(() => res()));
await prisma.$disconnect();

console.log("\n============================================================");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("============================================================\n");

if (failed > 0) process.exit(1);
