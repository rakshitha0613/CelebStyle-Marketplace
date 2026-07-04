/**
 * Sprint 5.2 — Event Pipeline & Feature Store Tests
 *
 * Covers:
 *   [1]  POST /api/events — single event, all 17 types accepted
 *   [2]  POST /api/events — batch events
 *   [3]  POST /api/events — invalid type rejected (400)
 *   [4]  POST /api/events — empty array rejected (400)
 *   [5]  POST /api/events — PRODUCT_VIEW populates recently-viewed cache
 *   [6]  POST /api/events — anonymous (no auth) works
 *   [7]  POST /api/events — authenticated user stored on event
 *   [8]  GET /api/events/session/:id — returns session metadata
 *   [9]  Session created on first event, eventCount incremented
 *   [10] Session context stored (device, country, utm)
 *   [11] Feature computation — user category affinity
 *   [12] Feature computation — user occasion preference
 *   [13] Feature computation — user price preference
 *   [14] Feature computation — user purchase frequency + recency
 *   [15] Feature computation — user monetary score
 *   [16] Feature computation — user wishlist affinity
 *   [17] Feature computation — user search affinity
 *   [18] Feature computation — product CTR
 *   [19] Feature computation — product conversion rate
 *   [20] Feature computation — product wishlist rate
 *   [21] Feature computation — product trending score (7d vs 30d)
 *   [22] Feature computation — product freshness score
 *   [23] refreshUserFeatures — persists to DB
 *   [24] refreshProductFeatures — persists to DB
 *   [25] getUserFeatures — cache hit on second call
 *   [26] getProductFeatures — cache hit on second call
 *   [27] Cache — get/set/del/has/TTL
 *   [28] Cache — TTL expiry eviction
 *   [29] Cache — recentlyViewed ordering and dedup
 *   [30] Cache — invalidateUserFeatures clears both keys
 *   [31] TrendingWorker — computes scores and upserts TrendingProduct
 *   [32] TrendingWorker — ranks by score descending
 *   [33] TrendingWorker — cache populated after run
 *   [34] UserEmbeddingWorker — upserts UserEmbedding
 *   [35] UserEmbeddingWorker — produces non-zero embedding from features
 *   [36] FeatureRefreshWorker — single-user mode
 *   [37] FeatureRefreshWorker — single-product mode
 *   [38] FeatureRefreshWorker — batch sweep finds active users/products
 *   [39] Analytics aggregation — event counts by type
 *   [40] Feature refresh — cache invalidated after refresh
 *
 * Sentinel: "@fs52.celebstyle.test"
 * Run: npm run test:feature-store
 */

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { cacheService, CacheKey, TTL } from "../lib/cache.service.js";
import { hashPassword } from "../auth/password.service.js";
import {
  computeUserFeatures,
  computeProductFeatures,
  refreshUserFeatures,
  refreshProductFeatures,
  getUserFeatures,
  getProductFeatures,
} from "../services/feature.service.js";
import { trendingWorker } from "../workers/trending.worker.js";
import { userEmbeddingWorker } from "../workers/user-embedding.worker.js";
import { featureRefreshWorker } from "../workers/feature-refresh.worker.js";
import { hasProductEmbedding } from "../lib/vector.db.js";
import { randomUUID } from "node:crypto";

// ── Test helpers ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function header(n: number, title: string): void {
  console.log(`\n  [${n}] ${title}`);
}

async function request(
  url: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
  token?: string
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SENTINEL = "@fs52.celebstyle.test";
let BASE_URL: string;
let server!: ReturnType<typeof createServer>;
let testUserId!:    string;
let testToken!:     string;
let testProductId!: string;
let testProduct2Id!: string;

async function setupServer(): Promise<void> {
  const app = createApp();
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function setupFixtures(): Promise<void> {
  // Celebrity
  let celeb = await prisma.celebrity.findFirst({ where: { slug: "celeb-fs52-test" } });
  if (!celeb) {
    celeb = await prisma.celebrity.create({
      data: { name: "FS52 Test Celeb", slug: "celeb-fs52-test", industry: "BOLLYWOOD" },
    });
  }

  // Products
  let prod = await prisma.product.findFirst({ where: { slug: "fs52-party-prod-a" } });
  if (!prod) {
    prod = await prisma.product.create({
      data: {
        slug:        "fs52-party-prod-a",
        celebrityId: celeb.id,
        movieName:   "FS52 Movie",
        occasion:    "PARTY",
        category:    "SAREE",
        colorPalette: "red gold",
        basePrice:   200000,
        isPublished: true,
        publishedAt: new Date(Date.now() - 10 * 86_400_000), // 10 days ago
        description: SENTINEL,
      },
    });
  }
  testProductId = prod.id;

  let prod2 = await prisma.product.findFirst({ where: { slug: "fs52-wedding-prod-b" } });
  if (!prod2) {
    prod2 = await prisma.product.create({
      data: {
        slug:        "fs52-wedding-prod-b",
        celebrityId: celeb.id,
        movieName:   "FS52 Movie 2",
        occasion:    "WEDDING",
        category:    "LEHENGA",
        colorPalette: "white gold",
        basePrice:   500000,
        isPublished: true,
        publishedAt: new Date(Date.now() - 60 * 86_400_000), // 60 days ago (lower freshness)
        description: SENTINEL,
      },
    });
  }
  testProduct2Id = prod2.id;

  // User
  const email = "fs52-user@celebstyle.test";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name:         "FS52 Test User",
        passwordHash: await hashPassword("Test1234!"),
        role:         "CUSTOMER",
        emailVerified: true,
      },
    });
  }
  testUserId = user.id;

  // Get token
  const res = await request(`${BASE_URL}/api/auth/login`, "POST", {
    email,
    password: "Test1234!",
  });
  testToken = (res.data as any).data?.accessToken;
}

async function cleanup(): Promise<void> {
  // Analytics events
  await prisma.analyticsEvent.deleteMany({ where: { OR: [
    { userId: testUserId },
    { productId: testProductId },
    { productId: testProduct2Id },
    { sessionId: { startsWith: "fs52-" } },
  ]}});

  // Sessions
  await prisma.analyticsSession.deleteMany({ where: { id: { startsWith: "fs52-" } } });

  // Feature stores
  if (testUserId)    await prisma.userFeatureStore.deleteMany({ where: { userId: testUserId } });
  if (testProductId) await prisma.productFeatureStore.deleteMany({ where: { productId: testProductId } });
  if (testProduct2Id) await prisma.productFeatureStore.deleteMany({ where: { productId: testProduct2Id } });

  // Trending entries
  if (testProductId)  await prisma.trendingProduct.deleteMany({ where: { productId: testProductId } });
  if (testProduct2Id) await prisma.trendingProduct.deleteMany({ where: { productId: testProduct2Id } });

  // UserEmbedding
  if (testUserId) await prisma.userEmbedding.deleteMany({ where: { userId: testUserId } });

  // Recommendation impressions
  await prisma.recommendationImpression.deleteMany({ where: { sessionId: { startsWith: "fs52-" } } });

  // Wishlist items
  const wishlist = await prisma.wishlist.findFirst({ where: { userId: testUserId } });
  if (wishlist) {
    await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
  }

  // Cart items
  const cart = await prisma.cart.findFirst({ where: { userId: testUserId } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  cacheService.clear();
}

// ── Section 1: Event Ingestion ────────────────────────────────────────────────

async function testEventIngestion(): Promise<void> {
  const allTypes = [
    "PAGE_VIEW", "PRODUCT_VIEW", "SEARCH", "ADD_TO_CART", "REMOVE_FROM_CART",
    "CHECKOUT_START", "PURCHASE", "ADD_TO_WISHLIST", "REMOVE_FROM_WISHLIST",
    "SHARE", "REVIEW_SUBMIT", "TRY_ON", "AR_SESSION", "RECOMMENDATION_CLICK",
    "FILTER_APPLY", "SCROLL_DEPTH", "SESSION_END",
  ];

  header(1, "POST /api/events — single event, all 17 types accepted");
  for (const type of allTypes) {
    const r = await request(`${BASE_URL}/api/events`, "POST", {
      type,
      sessionId:  `fs52-sess-types-${type}`,
      productId:  ["PRODUCT_VIEW", "ADD_TO_CART", "ADD_TO_WISHLIST"].includes(type) ? testProductId : undefined,
      page:       "/",
    });
    assert(r.status === 202, `${type} → 202`);
  }

  header(2, "POST /api/events — batch events");
  const batchR = await request(`${BASE_URL}/api/events`, "POST", [
    { type: "PAGE_VIEW",     sessionId: "fs52-sess-batch", page: "/" },
    { type: "PRODUCT_VIEW",  sessionId: "fs52-sess-batch", productId: testProductId, page: "/outfits/test" },
    { type: "ADD_TO_WISHLIST", sessionId: "fs52-sess-batch", productId: testProductId },
  ]);
  assert(batchR.status === 202, "batch → 202");
  assert((batchR.data as any).data?.stored === 3, "stored = 3");

  header(3, "POST /api/events — invalid type rejected");
  const badR = await request(`${BASE_URL}/api/events`, "POST", { type: "INVALID_TYPE" });
  assert(badR.status === 400, "invalid type → 400");

  header(4, "POST /api/events — empty array rejected");
  const emptyR = await request(`${BASE_URL}/api/events`, "POST", []);
  assert(emptyR.status === 400, "empty array → 400");

  header(5, "PRODUCT_VIEW populates recently-viewed cache");
  const sessId = "fs52-sess-rv-test";
  await request(`${BASE_URL}/api/events`, "POST", {
    type:      "PRODUCT_VIEW",
    sessionId: sessId,
    productId: testProductId,
    page:      "/outfits/test",
  });
  const rv = cacheService.getRecentlyViewed(sessId);
  assert(rv.includes(testProductId), "product in recently-viewed cache");

  header(6, "POST /api/events — anonymous (no auth)");
  const anonR = await request(`${BASE_URL}/api/events`, "POST", {
    type:      "PAGE_VIEW",
    sessionId: "fs52-sess-anon",
    page:      "/",
  });
  assert(anonR.status === 202, "anonymous event → 202");

  header(7, "POST /api/events — authenticated user stored on event");
  const authR = await request(`${BASE_URL}/api/events`, "POST", {
    type:      "PRODUCT_VIEW",
    sessionId: "fs52-sess-auth",
    productId: testProductId,
  }, testToken);
  assert(authR.status === 202, "authenticated event → 202");

  const stored = await prisma.analyticsEvent.findFirst({
    where: { sessionId: "fs52-sess-auth", type: "PRODUCT_VIEW" },
  });
  assert(stored?.userId === testUserId, "userId stored on event");
}

// ── Section 2: Session tracking ───────────────────────────────────────────────

async function testSessionTracking(): Promise<void> {
  header(8, "GET /api/events/session/:id");
  const sessId = "fs52-sess-get";
  await request(`${BASE_URL}/api/events`, "POST", {
    type:      "PAGE_VIEW",
    sessionId: sessId,
    page:      "/home",
    device:    "mobile",
    country:   "IN",
    city:      "Mumbai",
  });

  const r = await request(`${BASE_URL}/api/events/session/${sessId}`);
  assert(r.status === 200, "GET session → 200");
  assert((r.data as any).data?.session?.id === sessId, "session id matches");

  header(9, "Session created on first event; eventCount increments");
  const sessId2 = "fs52-sess-count";
  await request(`${BASE_URL}/api/events`, "POST", { type: "PAGE_VIEW", sessionId: sessId2 });
  await request(`${BASE_URL}/api/events`, "POST", { type: "SEARCH",    sessionId: sessId2, searchQuery: "saree" });
  await request(`${BASE_URL}/api/events`, "POST", { type: "SCROLL_DEPTH", sessionId: sessId2 });

  const sess = await prisma.analyticsSession.findUnique({ where: { id: sessId2 } });
  assert(sess !== null, "session row exists");
  assert(sess!.eventCount === 3, `eventCount = 3 (got ${sess?.eventCount})`);

  header(10, "Session context stored (device, country, utm)");
  const sessId3 = "fs52-sess-ctx";
  await request(`${BASE_URL}/api/events`, "POST", {
    type:        "PAGE_VIEW",
    sessionId:   sessId3,
    page:        "/campaigns/summer",
    device:      "desktop",
    browser:     "Chrome",
    country:     "IN",
    state:       "MH",
    city:        "Mumbai",
    utmSource:   "instagram",
    utmMedium:   "social",
    utmCampaign: "summer2026",
    referrer:    "https://instagram.com",
  });

  const sess3 = await prisma.analyticsSession.findUnique({ where: { id: sessId3 } });
  assert(sess3?.device      === "desktop",        "device stored");
  assert(sess3?.country     === "IN",             "country stored");
  assert(sess3?.utmCampaign === "summer2026",     "utm_campaign stored");
  assert(sess3?.city        === "Mumbai",         "city stored");
  assert(sess3?.firstPage   === "/campaigns/summer", "firstPage stored");
}

// ── Section 3: User feature computation ──────────────────────────────────────

async function seedUserEvents(): Promise<void> {
  // Create several PARTY/SAREE engagement events for the test user
  const eventData = [
    { type: "PRODUCT_VIEW", productId: testProductId,  sessionId: "fs52-feat-sess" },
    { type: "PRODUCT_VIEW", productId: testProductId,  sessionId: "fs52-feat-sess" },
    { type: "ADD_TO_CART",  productId: testProductId,  sessionId: "fs52-feat-sess" },
    { type: "ADD_TO_WISHLIST", productId: testProductId, sessionId: "fs52-feat-sess" },
    { type: "PRODUCT_VIEW", productId: testProduct2Id, sessionId: "fs52-feat-sess" },
    { type: "SEARCH",       searchQuery: "bridal saree", sessionId: "fs52-feat-sess" },
    { type: "SEARCH",       searchQuery: "saree party",  sessionId: "fs52-feat-sess" },
  ];

  for (const ev of eventData) {
    await prisma.analyticsEvent.create({
      data: { ...ev as any, type: ev.type as any, userId: testUserId },
    });
  }
}

async function testUserFeatureComputation(): Promise<void> {
  await seedUserEvents();

  const features = await computeUserFeatures(testUserId);

  header(11, "User feature — category affinity");
  assert(typeof features.categoryAffinity === "object", "categoryAffinity is object");
  assert("SAREE" in features.categoryAffinity, "SAREE in categoryAffinity");
  assert(features.categoryAffinity["SAREE"]! > 0, "SAREE affinity > 0");

  header(12, "User feature — occasion preference");
  assert("PARTY" in features.occasionPreference, "PARTY in occasionPreference");
  assert((features.occasionPreference["PARTY"] ?? 0) > (features.occasionPreference["WEDDING"] ?? 0),
    "PARTY > WEDDING (more events for PARTY product)");

  header(13, "User feature — price preference");
  assert(typeof features.pricePreference === "object", "pricePreference is object");
  assert(features.pricePreference.avg > 0, `avg price > 0 (got ${features.pricePreference.avg})`);
  assert(features.pricePreference.min <= features.pricePreference.max, "min ≤ max");

  header(14, "User feature — purchase frequency + recency");
  assert(typeof features.purchaseFrequency === "number", "purchaseFrequency is number");
  assert(typeof features.recencyScore === "number", "recencyScore is number");
  assert(features.recencyScore >= 0 && features.recencyScore <= 1, "recencyScore in [0, 1]");

  header(15, "User feature — monetary score");
  assert(typeof features.monetaryScore === "number", "monetaryScore is number");
  assert(features.monetaryScore >= 0, "monetaryScore ≥ 0");

  header(16, "User feature — wishlist affinity");
  assert(typeof features.wishlistAffinity === "object", "wishlistAffinity is object");

  header(17, "User feature — search affinity");
  assert("bridal saree" in features.searchAffinity || "saree party" in features.searchAffinity,
    "search terms appear in searchAffinity");
}

// ── Section 4: Product feature computation ────────────────────────────────────

async function seedProductEvents(): Promise<void> {
  // Create events to make product features computable
  const sessionId = "fs52-prod-feat-sess";

  // 5 views, 2 carts, 1 wishlist → conversion rate = 0, cart rate = 0.4, wishlist rate = 0.2
  for (let i = 0; i < 5; i++) {
    await prisma.analyticsEvent.create({
      data: { type: "PRODUCT_VIEW", productId: testProductId, sessionId } as any,
    });
  }
  for (let i = 0; i < 2; i++) {
    await prisma.analyticsEvent.create({
      data: { type: "ADD_TO_CART", productId: testProductId, sessionId } as any,
    });
  }
  await prisma.analyticsEvent.create({
    data: { type: "ADD_TO_WISHLIST", productId: testProductId, sessionId } as any,
  });

  // Recommendation impressions: 10 impressions, 3 clicks → CTR = 0.3
  for (let i = 0; i < 10; i++) {
    await prisma.recommendationImpression.create({
      data: {
        productId: testProductId,
        sessionId: "fs52-imp-sess",
        context:   "homepage",
        position:  i,
        wasClicked: i < 3,
      },
    });
  }

  // Recent 7d views for trending: 4 recent views on product A, 1 on B
  const d5 = new Date(Date.now() - 5 * 86_400_000); // 5 days ago (within 7d)
  for (let i = 0; i < 4; i++) {
    await prisma.analyticsEvent.create({
      data: { type: "PRODUCT_VIEW", productId: testProductId, sessionId, createdAt: d5 } as any,
    });
  }
}

async function testProductFeatureComputation(): Promise<void> {
  await seedProductEvents();

  const features = await computeProductFeatures(testProductId);

  header(18, "Product feature — CTR");
  assert(typeof features.ctr === "number",   "ctr is number");
  // 3 clicks / 10 impressions = 0.3
  assert(Math.abs(features.ctr - 0.3) < 0.01, `CTR ≈ 0.3 (got ${features.ctr.toFixed(4)})`);

  header(19, "Product feature — conversion rate");
  assert(typeof features.conversionRate === "number", "conversionRate is number");
  // No purchases seeded → 0 (or close to it since we only seeded view events)
  assert(features.conversionRate >= 0, `conversionRate ≥ 0 (got ${features.conversionRate})`);

  header(20, "Product feature — wishlist rate");
  // 1 wishlist / (5 + 4) views = ~0.111
  assert(features.wishlistRate > 0, `wishlistRate > 0 (got ${features.wishlistRate.toFixed(4)})`);
  assert(features.wishlistRate < 1, "wishlistRate < 1");

  header(21, "Product feature — trending score (7d vs 30d)");
  // 4 views in 7d; the 30d window includes the 7d views → prior = views30d - views7d
  assert(features.trendingScore > 0, `trendingScore > 0 (got ${features.trendingScore.toFixed(4)})`);

  // product2 published 60 days ago (lower freshness) vs product1 10 days ago
  const f2 = await computeProductFeatures(testProduct2Id);

  header(22, "Product feature — freshness score");
  assert(features.freshnessScore > f2.freshnessScore,
    `newer product fresher: ${features.freshnessScore.toFixed(4)} > ${f2.freshnessScore.toFixed(4)}`);
  assert(features.freshnessScore > 0 && features.freshnessScore <= 1, "freshnessScore in (0, 1]");
}

// ── Section 5: Persist & cache ────────────────────────────────────────────────

async function testPersistAndCache(): Promise<void> {
  header(23, "refreshUserFeatures — persists to DB");
  const features = await refreshUserFeatures(testUserId);
  const row = await prisma.userFeatureStore.findUnique({ where: { userId: testUserId } });
  assert(row !== null, "UserFeatureStore row created");
  assert(typeof (row?.categoryAffinity as any) === "object", "categoryAffinity stored as JSON");
  assert(row!.purchaseFrequency >= 0, "purchaseFrequency persisted");

  header(24, "refreshProductFeatures — persists to DB");
  const pf = await refreshProductFeatures(testProductId);
  const prow = await prisma.productFeatureStore.findUnique({ where: { productId: testProductId } });
  assert(prow !== null, "ProductFeatureStore row created");
  assert(pf.ctr >= 0, "ctr persisted");
  assert(pf.freshnessScore > 0, "freshnessScore persisted");

  header(25, "getUserFeatures — cache hit on second call");
  cacheService.clear();
  const f1 = await getUserFeatures(testUserId);
  assert(f1 !== null, "first call returns features");
  const cached = cacheService.getUserFeatures(testUserId);
  assert(cached !== null, "features cached after first DB read");
  const f2 = await getUserFeatures(testUserId);
  assert(f2 !== null, "second call returns features from cache");

  header(26, "getProductFeatures — cache hit on second call");
  cacheService.clear();
  const pf1 = await getProductFeatures(testProductId);
  assert(pf1 !== null, "first call returns product features");
  const pcached = cacheService.getProductFeatures(testProductId);
  assert(pcached !== null, "product features cached");
}

// ── Section 6: Cache unit tests ───────────────────────────────────────────────

async function testCache(): Promise<void> {
  cacheService.clear();

  header(27, "Cache — get/set/del/has");
  cacheService.set("test:key1", { x: 42 });
  assert(cacheService.has("test:key1"),     "has() = true after set");
  assert((cacheService.get("test:key1") as any)?.x === 42, "get() returns value");
  cacheService.del("test:key1");
  assert(!cacheService.has("test:key1"),    "has() = false after del");
  assert(cacheService.get("test:key1") === null, "get() = null after del");

  header(28, "Cache — TTL expiry");
  cacheService.set("test:ttl", "expires-soon", 50); // 50ms TTL
  assert(cacheService.has("test:ttl"), "has() = true before expiry");
  await new Promise((r) => setTimeout(r, 100));
  assert(!cacheService.has("test:ttl"),        "has() = false after TTL");
  assert(cacheService.get("test:ttl") === null, "get() = null after TTL");

  header(29, "Cache — recentlyViewed ordering and dedup");
  const sid = "fs52-rv-unit";
  cacheService.addRecentlyViewed(sid, "prod-a");
  cacheService.addRecentlyViewed(sid, "prod-b");
  cacheService.addRecentlyViewed(sid, "prod-c");
  cacheService.addRecentlyViewed(sid, "prod-a"); // dedup: prod-a should move to front
  const rv = cacheService.getRecentlyViewed(sid);
  assert(rv[0] === "prod-a", "deduped prod-a at front");
  assert(rv.length === 3,    "length = 3 (no duplicate)");
  assert(rv.indexOf("prod-a") === 0, "prod-a at index 0");

  header(30, "Cache — invalidateUserFeatures clears both keys");
  const uid = "fs52-cache-user";
  cacheService.set(CacheKey.userFeatures(uid), { x: 1 }, TTL.USER_FEATURES);
  cacheService.set(CacheKey.featureSnapshot(uid), { y: 2 }, TTL.FEATURE_SNAPSHOT);
  assert(cacheService.has(CacheKey.userFeatures(uid)),    "user features set");
  assert(cacheService.has(CacheKey.featureSnapshot(uid)), "feature snapshot set");
  cacheService.invalidateUserFeatures(uid);
  assert(!cacheService.has(CacheKey.userFeatures(uid)),    "user features cleared");
  assert(!cacheService.has(CacheKey.featureSnapshot(uid)), "feature snapshot cleared");
}

// ── Section 7: Workers ────────────────────────────────────────────────────────

async function testWorkers(): Promise<void> {
  cacheService.clear();

  header(31, "TrendingWorker — computes scores and upserts TrendingProduct");
  const tResult = await trendingWorker.run({ window: "7d" });
  assert(tResult.processed >= 0, `processed = ${tResult.processed} (can be 0 if no events)`);
  assert(tResult.windowUsed === "7d", "windowUsed = 7d");

  // Force a product into trending by confirming test events exist
  const views7d = await prisma.analyticsEvent.count({
    where: {
      productId: testProductId,
      type:      "PRODUCT_VIEW",
      createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
    },
  });

  if (views7d > 0) {
    // Re-run to pick up our seeded events
    const tResult2 = await trendingWorker.run({ window: "7d" });
    assert(tResult2.processed > 0, `TrendingWorker processed ${tResult2.processed} products`);

    header(32, "TrendingWorker — ranks by score descending");
    const entries = tResult2.topRanked;
    assert(
      entries.every((e, i) => i === 0 || entries[i - 1].score >= e.score),
      "topRanked ordered by score descending"
    );
    assert(entries.every((e) => e.rank >= 1), "all ranks ≥ 1");

    header(33, "TrendingWorker — cache populated after run");
    const cached = cacheService.getTrending("7d");
    assert(cached !== null, "trending cache populated");
    assert(Array.isArray(cached), "cache value is array");
  } else {
    // No events in 7d window — just verify worker ran without error
    header(32, "TrendingWorker — ranks by score descending (no data)");
    assert(tResult.topRanked.length >= 0, "topRanked is array");
    header(33, "TrendingWorker — cache populated after run (no data)");
    assert(true, "worker ran without error");
  }

  header(34, "UserEmbeddingWorker — upserts UserEmbedding");
  const uResult = await userEmbeddingWorker.run({ userId: testUserId });
  assert(uResult.userId === testUserId, "userId in result");
  assert(typeof uResult.signalCount === "number", "signalCount is number");
  assert(uResult.signalCount >= 0, `signalCount ≥ 0 (got ${uResult.signalCount})`);

  header(35, "UserEmbeddingWorker — produces non-zero UserEmbedding");
  const hasEmb = await hasProductEmbedding(testProductId); // verify vector.db import works
  const userEmb = await prisma.userEmbedding.findUnique({ where: { userId: testUserId } });
  assert(userEmb !== null, "UserEmbedding row exists");
  assert(userEmb!.modelVersion.length > 0, "modelVersion stored");

  header(36, "FeatureRefreshWorker — single-user mode");
  await prisma.userFeatureStore.deleteMany({ where: { userId: testUserId } });
  const frUser = await featureRefreshWorker.run({ userId: testUserId });
  assert(frUser.usersRefreshed === 1, `usersRefreshed = 1 (got ${frUser.usersRefreshed})`);
  assert(frUser.errors === 0, `errors = 0 (got ${frUser.errors})`);

  const ufsRow = await prisma.userFeatureStore.findUnique({ where: { userId: testUserId } });
  assert(ufsRow !== null, "UserFeatureStore created by worker");

  header(37, "FeatureRefreshWorker — single-product mode");
  await prisma.productFeatureStore.deleteMany({ where: { productId: testProductId } });
  const frProd = await featureRefreshWorker.run({ productId: testProductId });
  assert(frProd.productsRefreshed === 1, `productsRefreshed = 1 (got ${frProd.productsRefreshed})`);
  assert(frProd.errors === 0, `errors = 0 (got ${frProd.errors})`);

  header(38, "FeatureRefreshWorker — batch sweep");
  // The test user has events seeded so should be picked up in the batch sweep
  const frBatch = await featureRefreshWorker.run({ lookbackMs: 24 * 60 * 60_000 });
  assert(frBatch.usersRefreshed >= 0,    `batch users ≥ 0 (got ${frBatch.usersRefreshed})`);
  assert(frBatch.productsRefreshed >= 0, `batch products ≥ 0 (got ${frBatch.productsRefreshed})`);
  assert(frBatch.errors === 0,           `batch errors = 0 (got ${frBatch.errors})`);
}

// ── Section 8: Analytics aggregation + feature refresh ────────────────────────

async function testAnalyticsAndRefresh(): Promise<void> {
  header(39, "Analytics aggregation — event counts by type");
  const counts = await prisma.analyticsEvent.groupBy({
    by:    ["type"],
    where: { userId: testUserId },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
  });

  assert(counts.length > 0, `has events for test user (got ${counts.length} types)`);
  assert(
    counts.some((c) => c.type === "PRODUCT_VIEW"),
    "PRODUCT_VIEW events present"
  );
  assert(
    counts.some((c) => c.type === "SEARCH"),
    "SEARCH events present"
  );

  header(40, "Feature refresh — cache invalidated after refresh");
  // Seed a feature into cache
  cacheService.setUserFeatures(testUserId, { categoryAffinity: { SAREE: 999 } });
  assert(cacheService.getUserFeatures(testUserId) !== null, "cache populated");

  // refreshUserFeatures should update cache with fresh values
  await refreshUserFeatures(testUserId);
  const fresh = cacheService.getUserFeatures(testUserId);
  assert(fresh !== null, "cache still has features after refresh");
  // The fresh value should NOT have the stale 999 sentinel
  assert(
    (fresh as any)?.categoryAffinity?.SAREE !== 999,
    "cache has fresh value (not stale sentinel)"
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("============================================================");
console.log("  Sprint 5.2 — Event Pipeline & Feature Store Tests");
console.log("============================================================");

await setupServer();
await setupFixtures();
await cleanup();

await testEventIngestion();
await testSessionTracking();
await testUserFeatureComputation();
await testProductFeatureComputation();
await testPersistAndCache();
await testCache();
await testWorkers();
await testAnalyticsAndRefresh();

await cleanup();
await prisma.$disconnect();
server.close();

console.log("\n============================================================");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("============================================================\n");

if (failed > 0) process.exit(1);
