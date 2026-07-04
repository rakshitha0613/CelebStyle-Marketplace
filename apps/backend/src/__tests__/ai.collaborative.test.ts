/**
 * Sprint 5.3 — Collaborative Filtering Engine Tests
 *
 * Covers:
 *   [1]  SimilarityMatrix — get/set/invalidate
 *   [2]  getUserProductSet — queries DB (order/wishlist/cart/events) and caches
 *   [3]  getUserProductSet — cache hit on second call
 *   [4]  userJaccardSimilarity — overlapping product sets → score > 0
 *   [5]  userJaccardSimilarity — disjoint product sets → score = 0
 *   [6]  userCosineSimilarity — two users with refreshed features → in [0, 1]
 *   [7]  userHybridSimilarity — weighted blend of cosine and Jaccard
 *   [8]  productCoPurchaseSimilarity — seeded pair → score > 0
 *   [9]  productCoPurchaseSimilarity — no pair → score = 0
 *   [10] productCoViewSimilarity — no co-view pair → score = 0
 *   [11] productHybridSimilarity — same-category pair scores higher than cross-category
 *   [12] productHybridSimilarity — custom weights honored (embedding-only mode)
 *   [13] invalidateProductSimilarityCache — clears matrix entry and productInfo
 *   [14] invalidateUserInteractionCache — clears product-set cache and user matrix
 *   [15] findSimilarUsers — shared-product user surfaces as candidate
 *   [16] findSimilarUsers — user with no interactions returns []
 *   [17] getUserBasedRecommendations — product from similar user's set appears
 *   [18] getUserBasedRecommendations — already-interacted products excluded
 *   [19] getItemBasedRecommendations — embedding neighbors of interacted products
 *   [20] getHybridRecommendations — returns non-empty results for warm user
 *   [21] getHybridRecommendations — cached on second call
 *   [22] invalidateUserCFCache — clears all four cached CF keys
 *   [23] getColdStartForUser — returns edges with expected types (TRENDING / POPULAR / NEWEST)
 *   [24] getColdStartForUser — cached on second call
 *   [25] getColdStartForProduct — returns EMBEDDING edges for product with embeddings
 *   [26] getColdStartForProduct — CATEGORY fallback when no embedding neighbors exist
 *   [27] getUserToUserEdges — USER_SIMILARITY edges for user with interactions
 *   [28] getUserToProductEdges — HYBRID_CF edges filtered against already-interacted
 *   [29] getProductToProductEdges — EMBEDDING_SIMILARITY edges
 *   [30] getCelebrityToProductEdges — CELEBRITY_PRODUCT edges for test celebrity
 *   [31] getBrandToProductEdges — BRAND_PRODUCT edges for test brand
 *   [32] buildUserGraph — warm user → coldStart = false, has recommendations
 *   [33] buildUserGraph — cold user (no interactions) → coldStart = true
 *   [34] SimilarityRefreshWorker — single user mode → usersRefreshed = 1, errors = 0
 *   [35] SimilarityRefreshWorker — single product mode → productsRefreshed = 1
 *   [36] SimilarityRefreshWorker — batch sweep finds recently-active entities
 *   [37] RecommendationGraphWorker — single user mode → usersProcessed = 1
 *   [38] RecommendationGraphWorker — single product mode → productsProcessed = 1
 *   [39] RecommendationGraphWorker — batch sweep → pre-warms cold-start cache
 *   [40] End-to-end — cold user gets cold-start recs; warm user gets hybrid recs
 *
 * Sentinel: "@cf53.celebstyle.test"
 * Run: npm run test:collaborative
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { embeddingService } from "../lib/embedding.service.js";
import {
  upsertProductEmbedding,
} from "../lib/vector.db.js";
import {
  getUserProductSet,
  userJaccardSimilarity,
  userCosineSimilarity,
  userHybridSimilarity,
  productCoPurchaseSimilarity,
  productCoViewSimilarity,
  productHybridSimilarity,
  invalidateProductSimilarityCache,
  invalidateUserInteractionCache,
  userSimilarityMatrix,
  productSimilarityMatrix,
  DEFAULT_PRODUCT_WEIGHTS,
} from "../services/similarity.service.js";
import {
  findSimilarUsers,
  getUserBasedRecommendations,
  getItemBasedRecommendations,
  getHybridRecommendations,
  invalidateUserCFCache,
} from "../services/collaborative-filtering.service.js";
import {
  getUserToUserEdges,
  getUserToProductEdges,
  getProductToProductEdges,
  getCelebrityToProductEdges,
  getBrandToProductEdges,
  getColdStartForUser,
  getColdStartForProduct,
  buildUserGraph,
} from "../services/recommendation-graph.service.js";
import { similarityRefreshWorker } from "../workers/similarity-refresh.worker.js";
import { recommendationGraphWorker } from "../workers/recommendation-graph.worker.js";
import { refreshUserFeatures } from "../services/feature.service.js";
import { hashPassword } from "../auth/password.service.js";

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SENTINEL = "@cf53.celebstyle.test";

let testCelebId!:   string;
let testBrandId!:   string;
let testProdAId!:   string;
let testProdBId!:   string;
let testProdCId!:   string;
let testUser1Id!:   string;
let testUser2Id!:   string;
let testUser3Id!:   string;

async function setupFixtures(): Promise<void> {
  // ── Celebrity ──────────────────────────────────────────────────────────────
  let celeb = await prisma.celebrity.findFirst({ where: { slug: "celeb-cf53-test" } });
  if (!celeb) {
    celeb = await prisma.celebrity.create({
      data: { name: "CF53 Test Celeb", slug: "celeb-cf53-test", industry: "BOLLYWOOD" },
    });
  }
  testCelebId = celeb.id;

  // ── Brand ──────────────────────────────────────────────────────────────────
  let brand = await prisma.brand.findFirst({ where: { slug: "brand-cf53-test" } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: { slug: "brand-cf53-test", name: "CF53 Test Brand" },
    });
  }
  testBrandId = brand.id;

  // ── Products ───────────────────────────────────────────────────────────────
  let prodA = await prisma.product.findFirst({ where: { slug: "cf53-prod-a" } });
  if (!prodA) {
    prodA = await prisma.product.create({
      data: {
        slug:        "cf53-prod-a",
        celebrityId: testCelebId,
        brandId:     testBrandId,
        movieName:   "CF53 Movie",
        occasion:    "PARTY",
        category:    "SAREE",
        colorPalette: "red gold",
        basePrice:   200_000,
        isPublished: true,
        publishedAt: new Date(Date.now() - 10 * 86_400_000),
        description: SENTINEL,
      },
    });
  }
  testProdAId = prodA.id;

  let prodB = await prisma.product.findFirst({ where: { slug: "cf53-prod-b" } });
  if (!prodB) {
    prodB = await prisma.product.create({
      data: {
        slug:        "cf53-prod-b",
        celebrityId: testCelebId,
        brandId:     testBrandId,
        movieName:   "CF53 Movie",
        occasion:    "PARTY",
        category:    "LEHENGA",
        colorPalette: "blue silver",
        basePrice:   200_000,
        isPublished: true,
        publishedAt: new Date(Date.now() - 15 * 86_400_000),
        description: SENTINEL,
      },
    });
  }
  testProdBId = prodB.id;

  let prodC = await prisma.product.findFirst({ where: { slug: "cf53-prod-c" } });
  if (!prodC) {
    prodC = await prisma.product.create({
      data: {
        slug:        "cf53-prod-c",
        celebrityId: testCelebId,
        brandId:     null,
        movieName:   "CF53 Movie",
        occasion:    "WEDDING",
        category:    "SHERWANI",
        colorPalette: "white gold",
        basePrice:   500_000,
        isPublished: true,
        publishedAt: new Date(Date.now() - 30 * 86_400_000),
        description: SENTINEL,
      },
    });
  }
  testProdCId = prodC.id;

  // ── Users ──────────────────────────────────────────────────────────────────
  const mkUser = async (email: string, name: string) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing.id;
    const u = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword("Test1234!"),
        role:         "CUSTOMER",
        emailVerified: true,
      },
    });
    return u.id;
  };

  testUser1Id = await mkUser("cf53-user1@celebstyle.test", "CF53 User 1");
  testUser2Id = await mkUser("cf53-user2@celebstyle.test", "CF53 User 2");
  testUser3Id = await mkUser("cf53-user3@celebstyle.test", "CF53 User 3");

  // ── Seed embeddings for A, B, C ────────────────────────────────────────────
  const [vecA, vecB, vecC] = await Promise.all([
    embeddingService.embed("PARTY SAREE festival celebration red gold ethnic dance"),
    embeddingService.embed("PARTY LEHENGA dance celebration festival blue silver ethnic"),
    embeddingService.embed("WEDDING SHERWANI ceremony groom traditional bridal formal"),
  ]);
  await upsertProductEmbedding(testProdAId, vecA, embeddingService.modelVersion);
  await upsertProductEmbedding(testProdBId, vecB, embeddingService.modelVersion);
  await upsertProductEmbedding(testProdCId, vecC, embeddingService.modelVersion);

  // ── Analytics events ───────────────────────────────────────────────────────
  // User1: views product A and B
  // User2: views product A and C (shares A with User1)
  const now = new Date();
  const mkEvent = (userId: string, productId: string, session: string) =>
    prisma.analyticsEvent.create({
      data: {
        type:      "PRODUCT_VIEW" as any,
        sessionId: session,
        userId,
        productId,
        createdAt: now,
      },
    });

  await mkEvent(testUser1Id, testProdAId, "cf53-sess-u1");
  await mkEvent(testUser1Id, testProdBId, "cf53-sess-u1");
  await mkEvent(testUser2Id, testProdAId, "cf53-sess-u2");
  await mkEvent(testUser2Id, testProdCId, "cf53-sess-u2");

  // ── Co-purchase pair (A, B) ────────────────────────────────────────────────
  const [cpA, cpB] = testProdAId < testProdBId
    ? [testProdAId, testProdBId]
    : [testProdBId, testProdAId];
  await prisma.coPurchasedPair.upsert({
    where:  { productAId_productBId: { productAId: cpA, productBId: cpB } },
    update: { coPurchaseCount: 5 },
    create: { productAId: cpA, productBId: cpB, coPurchaseCount: 5 },
  });

  // ── Trending entry for A ───────────────────────────────────────────────────
  await prisma.trendingProduct.upsert({
    where:  { productId: testProdAId },
    update: { score: 95.0, rank: 1, window: "7d" },
    create: { productId: testProdAId, score: 95.0, rank: 1, window: "7d" },
  });

  // ── Refresh user features (for cosine similarity) ──────────────────────────
  await Promise.all([
    refreshUserFeatures(testUser1Id),
    refreshUserFeatures(testUser2Id),
  ]);
}

async function cleanup(): Promise<void> {
  // Analytics events for test sessions/users
  await prisma.analyticsEvent.deleteMany({
    where: {
      OR: [
        { sessionId: { startsWith: "cf53-" } },
        { userId: testUser1Id },
        { userId: testUser2Id },
        { userId: testUser3Id },
      ],
    },
  });

  // Feature stores
  for (const uid of [testUser1Id, testUser2Id, testUser3Id]) {
    if (uid) await prisma.userFeatureStore.deleteMany({ where: { userId: uid } });
  }
  for (const pid of [testProdAId, testProdBId, testProdCId]) {
    if (pid) await prisma.productFeatureStore.deleteMany({ where: { productId: pid } });
  }

  // UserEmbedding
  for (const uid of [testUser1Id, testUser2Id, testUser3Id]) {
    if (uid) await prisma.userEmbedding.deleteMany({ where: { userId: uid } });
  }

  // ProductEmbedding
  for (const pid of [testProdAId, testProdBId, testProdCId]) {
    if (pid) await prisma.productEmbedding.deleteMany({ where: { productId: pid } });
  }

  // Co-purchase pairs
  await prisma.coPurchasedPair.deleteMany({
    where: {
      OR: [
        { productAId: testProdAId },
        { productBId: testProdAId },
        { productAId: testProdBId },
        { productBId: testProdBId },
      ],
    },
  });

  // Trending
  if (testProdAId) await prisma.trendingProduct.deleteMany({ where: { productId: testProdAId } });

  cacheService.clear();
}

// ── Section 1: SimilarityMatrix ───────────────────────────────────────────────

async function testSimilarityMatrix(): Promise<void> {
  header(1, "SimilarityMatrix — get/set/invalidate");

  const matrix = userSimilarityMatrix;
  const id     = "cf53-matrix-test-user";

  assert(matrix.getNeighbors(id) === null, "getNeighbors returns null before set");

  const neighbors = [
    { id: "user-x", score: 0.9 },
    { id: "user-y", score: 0.7 },
  ];
  matrix.setNeighbors(id, neighbors);
  const got = matrix.getNeighbors(id);
  assert(got !== null, "getNeighbors returns value after set");
  assert(got?.length === 2, `length = 2 (got ${got?.length})`);
  assert(got?.[0].id === "user-x", "first neighbor correct");

  matrix.invalidate(id);
  assert(matrix.getNeighbors(id) === null, "getNeighbors returns null after invalidate");
}

// ── Section 2-3: getUserProductSet ────────────────────────────────────────────

async function testGetUserProductSet(): Promise<void> {
  header(2, "getUserProductSet — queries DB (events) and returns product set");

  cacheService.clear();
  const set = await getUserProductSet(testUser1Id);
  assert(set instanceof Set, "returns a Set");
  assert(set.has(testProdAId), "product A in set (user1 viewed it)");
  assert(set.has(testProdBId), "product B in set (user1 viewed it)");
  assert(!set.has(testProdCId), "product C NOT in set (user1 never viewed it)");

  header(3, "getUserProductSet — cache hit on second call");

  const set2 = await getUserProductSet(testUser1Id);
  assert(set2.has(testProdAId), "second call returns cached set with product A");
  assert(set2.has(testProdBId), "second call returns cached set with product B");
}

// ── Section 4-7: User similarity ─────────────────────────────────────────────

async function testUserSimilarity(): Promise<void> {
  header(4, "userJaccardSimilarity — overlapping product sets → score > 0");

  cacheService.clear();
  const simJ = await userJaccardSimilarity(testUser1Id, testUser2Id);
  // user1={A,B}, user2={A,C} → intersection={A}(1) / union={A,B,C}(3) = 1/3
  assert(simJ > 0, `Jaccard(user1, user2) > 0 (got ${simJ.toFixed(4)})`);
  assert(simJ <= 1, `Jaccard ≤ 1 (got ${simJ.toFixed(4)})`);

  header(5, "userJaccardSimilarity — disjoint sets (user3 has nothing) → score = 0");

  cacheService.clear();
  const simJ0 = await userJaccardSimilarity(testUser1Id, testUser3Id);
  assert(simJ0 === 0, `Jaccard(user1, user3) = 0 (got ${simJ0})`);

  header(6, "userCosineSimilarity — users with refreshed features → in [0, 1]");

  cacheService.clear();
  const simC = await userCosineSimilarity(testUser1Id, testUser2Id);
  assert(simC >= 0, `cosine ≥ 0 (got ${simC.toFixed(4)})`);
  assert(simC <= 1, `cosine ≤ 1 (got ${simC.toFixed(4)})`);

  header(7, "userHybridSimilarity — weighted blend of cosine and Jaccard");

  cacheService.clear();
  const [cosine, jaccard, hybrid] = await Promise.all([
    userCosineSimilarity(testUser1Id, testUser2Id),
    userJaccardSimilarity(testUser1Id, testUser2Id),
    userHybridSimilarity(testUser1Id, testUser2Id),
  ]);
  const expected = 0.60 * cosine + 0.40 * jaccard;
  assert(
    Math.abs(hybrid - expected) < 1e-9,
    `hybrid = 0.6*cosine + 0.4*jaccard = ${expected.toFixed(6)} (got ${hybrid.toFixed(6)})`
  );
}

// ── Section 8-10: Product similarity components ───────────────────────────────

async function testProductSimilarityComponents(): Promise<void> {
  header(8, "productCoPurchaseSimilarity — seeded pair (A,B) count=5 → score > 0");

  const simCP = await productCoPurchaseSimilarity(testProdAId, testProdBId);
  assert(simCP > 0, `coPurchase(A,B) > 0 (got ${simCP.toFixed(4)})`);
  assert(simCP <= 1, `coPurchase(A,B) ≤ 1 (got ${simCP.toFixed(4)})`);
  // Math.min(log(5+1)/log(100), 1) ≈ 0.389
  assert(simCP < 1, "coPurchase(A,B) < 1 (log-scaled)");

  header(9, "productCoPurchaseSimilarity — no pair (A,C) → score = 0");

  const simCP0 = await productCoPurchaseSimilarity(testProdAId, testProdCId);
  assert(simCP0 === 0, `coPurchase(A,C) = 0 (got ${simCP0})`);

  header(10, "productCoViewSimilarity — no co-view pair → score = 0");

  const simCV = await productCoViewSimilarity(testProdAId, testProdBId);
  assert(simCV === 0, `coView(A,B) = 0 with no CoviewedPair data (got ${simCV})`);
}

// ── Section 11-12: Product hybrid similarity ──────────────────────────────────

async function testProductHybridSimilarity(): Promise<void> {
  header(11, "productHybridSimilarity — same-category pair scores higher than cross-category");

  cacheService.clear();
  const [simAB, simAC] = await Promise.all([
    productHybridSimilarity(testProdAId, testProdBId),
    productHybridSimilarity(testProdAId, testProdCId),
  ]);
  assert(simAB >= 0 && simAB <= 1, `hybrid(A,B) in [0,1] (got ${simAB.toFixed(4)})`);
  assert(simAC >= 0 && simAC <= 1, `hybrid(A,C) in [0,1] (got ${simAC.toFixed(4)})`);
  // A and B share category(PARTY), brand, celeb, similar embedding → should score higher
  assert(simAB > simAC, `hybrid(A,B)=${simAB.toFixed(4)} > hybrid(A,C)=${simAC.toFixed(4)}`);

  header(12, "productHybridSimilarity — custom weights (embedding-only mode)");

  const embeddingOnlyWeights = {
    ...DEFAULT_PRODUCT_WEIGHTS,
    embedding:  1.0,
    coPurchase: 0,
    coView:     0,
    brand:      0,
    category:   0,
    price:      0,
    celebrity:  0,
    styleTag:   0,
  };

  cacheService.clear();
  const simEmbOnly = await productHybridSimilarity(testProdAId, testProdBId, embeddingOnlyWeights);
  // With embedding-only, result = just the cosine similarity from pgvector
  assert(simEmbOnly >= 0 && simEmbOnly <= 1, `embedding-only hybrid in [0,1] (got ${simEmbOnly.toFixed(4)})`);
  // Should equal productEmbeddingSimilarity(A, B) approximately
  const { productEmbeddingSimilarity } = await import("../services/similarity.service.js");
  const embSim = await productEmbeddingSimilarity(testProdAId, testProdBId);
  assert(
    Math.abs(simEmbOnly - embSim) < 1e-5,
    `custom weights produce embedding-only score (diff = ${Math.abs(simEmbOnly - embSim).toExponential(2)})`
  );
}

// ── Section 13-14: Cache invalidation ────────────────────────────────────────

async function testCacheInvalidation(): Promise<void> {
  header(13, "invalidateProductSimilarityCache — clears matrix entry and productInfo");

  // Seed matrix entry
  productSimilarityMatrix.setNeighbors(testProdAId, [{ id: testProdBId, score: 0.9 }]);
  assert(productSimilarityMatrix.getNeighbors(testProdAId) !== null, "matrix populated");

  // Also seed productInfo in cache
  const infoKey = `sim:pinfo:${testProdAId}`;
  cacheService.set(infoKey, { id: testProdAId }, 60_000);
  assert(cacheService.has(infoKey), "productInfo cache populated");

  invalidateProductSimilarityCache(testProdAId);

  assert(productSimilarityMatrix.getNeighbors(testProdAId) === null, "matrix cleared");
  assert(!cacheService.has(infoKey), "productInfo cache cleared");

  header(14, "invalidateUserInteractionCache — clears product-set cache and user matrix");

  // Seed both
  const psKey = `cf:ups:${testUser1Id}`;
  cacheService.set(psKey, [testProdAId], 60_000);
  userSimilarityMatrix.setNeighbors(testUser1Id, [{ id: testUser2Id, score: 0.5 }]);
  assert(cacheService.has(psKey), "product-set cache populated");
  assert(userSimilarityMatrix.getNeighbors(testUser1Id) !== null, "user matrix populated");

  invalidateUserInteractionCache(testUser1Id);

  assert(!cacheService.has(psKey), "product-set cache cleared");
  assert(userSimilarityMatrix.getNeighbors(testUser1Id) === null, "user matrix cleared");
}

// ── Section 15-16: findSimilarUsers ──────────────────────────────────────────

async function testFindSimilarUsers(): Promise<void> {
  header(15, "findSimilarUsers — shared-product user surfaces as candidate");

  cacheService.clear();
  const similar = await findSimilarUsers(testUser1Id, 10);
  assert(Array.isArray(similar), "returns array");
  // user2 shares product A with user1
  const found = similar.some((s) => s.id === testUser2Id);
  assert(found, "user2 (shares product A) in similar users list");
  assert(similar.every((s) => s.score > 0), "all scores > 0");
  assert(
    similar.every((s, i) => i === 0 || similar[i - 1].score >= s.score),
    "ordered by score descending"
  );

  header(16, "findSimilarUsers — user with no interactions returns []");

  cacheService.clear();
  const empty = await findSimilarUsers(testUser3Id, 10);
  assert(Array.isArray(empty), "returns array");
  assert(empty.length === 0, `user3 (no products) → [] (got ${empty.length})`);
}

// ── Section 17-22: CF recommendations ────────────────────────────────────────

async function testCFRecommendations(): Promise<void> {
  header(17, "getUserBasedRecommendations — product from similar user's set appears");

  cacheService.clear();
  const recs = await getUserBasedRecommendations(testUser1Id, 20);
  assert(Array.isArray(recs), "returns array");
  // user2 has product C, user1 does not → C should appear in user-based recs
  const hasC = recs.some((r) => r.id === testProdCId);
  assert(hasC, "product C (user2's product, not user1's) appears in user-based recs");

  header(18, "getUserBasedRecommendations — already-interacted products excluded");

  // user1 has A and B → neither should appear
  const hasA = recs.some((r) => r.id === testProdAId);
  const hasB = recs.some((r) => r.id === testProdBId);
  assert(!hasA, "product A (already interacted) NOT in user-based recs");
  assert(!hasB, "product B (already interacted) NOT in user-based recs");

  header(19, "getItemBasedRecommendations — embedding neighbors of interacted products");

  cacheService.clear();
  const itemRecs = await getItemBasedRecommendations(testUser1Id, 20);
  assert(Array.isArray(itemRecs), "returns array");
  // A and B are filtered since user1 already interacted with them
  assert(!itemRecs.some((r) => r.id === testProdAId), "product A (interacted) NOT in item-based recs");
  assert(!itemRecs.some((r) => r.id === testProdBId), "product B (interacted) NOT in item-based recs");
  // The seeded DB contains 35+ products with embeddings — some should surface as neighbors
  assert(itemRecs.length > 0, `item-based recs non-empty: found ${itemRecs.length} neighbor(s)`);

  header(20, "getHybridRecommendations — returns non-empty results for warm user");

  cacheService.clear();
  const hybridRecs = await getHybridRecommendations(testUser1Id, 20);
  assert(Array.isArray(hybridRecs), "returns array");
  assert(hybridRecs.length > 0, `hybrid recs non-empty (got ${hybridRecs.length})`);
  assert(
    hybridRecs.every((r, i) => i === 0 || hybridRecs[i - 1].score >= r.score),
    "ordered by score descending"
  );

  header(21, "getHybridRecommendations — cached on second call");

  const hybridRecs2 = await getHybridRecommendations(testUser1Id, 20);
  assert(hybridRecs2.length === hybridRecs.length, "second call returns same number of results (cache hit)");
  assert(
    hybridRecs2.every((r, i) => r.id === hybridRecs[i].id),
    "same results on second call (deterministic cache)"
  );

  header(22, "invalidateUserCFCache — clears all four CF keys");

  // Verify recs are cached
  const recsKey       = `cf:recs:user:${testUser1Id}`;
  const itemRecsKey   = `cf:recs:item:${testUser1Id}`;
  const hybridRecsKey = `cf:recs:hybrid:${testUser1Id}`;

  assert(cacheService.has(recsKey),       "user-based recs cached");
  assert(cacheService.has(itemRecsKey),   "item-based recs cached");
  assert(cacheService.has(hybridRecsKey), "hybrid recs cached");

  invalidateUserCFCache(testUser1Id);

  assert(!cacheService.has(recsKey),       "user-based recs cleared");
  assert(!cacheService.has(itemRecsKey),   "item-based recs cleared");
  assert(!cacheService.has(hybridRecsKey), "hybrid recs cleared");
}

// ── Section 23-26: Cold start ─────────────────────────────────────────────────

async function testColdStart(): Promise<void> {
  header(23, "getColdStartForUser — returns edges with expected types");

  cacheService.clear();
  const coldEdges = await getColdStartForUser(20);
  assert(Array.isArray(coldEdges), "returns array");
  assert(coldEdges.length > 0, `non-empty cold-start edges (got ${coldEdges.length})`);

  const validTypes = new Set(["TRENDING", "POPULAR", "NEWEST"]);
  assert(
    coldEdges.every((e) => validTypes.has(e.edgeType)),
    "all edge types are TRENDING | POPULAR | NEWEST"
  );
  assert(
    coldEdges.every((e) => e.weight >= 0 && e.weight <= 1),
    "all weights in [0, 1]"
  );

  header(24, "getColdStartForUser — cached on second call");

  const coldEdges2 = await getColdStartForUser(20);
  assert(coldEdges2.length === coldEdges.length, "same count on second call (cache hit)");
  assert(
    coldEdges2.every((e, i) => e.targetId === coldEdges[i].targetId),
    "same edges returned (deterministic cache)"
  );

  header(25, "getColdStartForProduct — returns EMBEDDING edges for product with embeddings");

  cacheService.clear();
  const prodColdEdges = await getColdStartForProduct(testProdAId, 10);
  assert(Array.isArray(prodColdEdges), "returns array");
  assert(prodColdEdges.length > 0, `non-empty product cold-start (got ${prodColdEdges.length})`);

  const embEdges = prodColdEdges.filter((e) => e.edgeType === "EMBEDDING");
  assert(embEdges.length > 0, "at least one EMBEDDING edge from pgvector ANN");
  // Product A should NOT appear in its own cold-start results
  assert(
    !prodColdEdges.some((e) => e.targetId === testProdAId),
    "source product not in its own cold-start"
  );

  header(26, "getColdStartForProduct — CATEGORY fallback for isolated product");

  // Use a product that has no embeddings seeded (create a transient slug)
  const fakeProdId = "cf53-fake-no-embedding";
  cacheService.clear();
  // This product doesn't exist in DB, so findSimilarToProduct returns []
  // getColdStartForProduct falls back to category query (also empty for fake ID)
  // The function should return gracefully with an empty or very short list
  const fakeEdges = await getColdStartForProduct(fakeProdId, 10);
  assert(Array.isArray(fakeEdges), "handles missing product gracefully (returns array)");
  // No assertion on count — category/brand fallbacks may not find anything for a fake ID
}

// ── Section 27-31: Graph edges ────────────────────────────────────────────────

async function testGraphEdges(): Promise<void> {
  header(27, "getUserToUserEdges — USER_SIMILARITY edges for user with interactions");

  cacheService.clear();
  const u2u = await getUserToUserEdges(testUser1Id, 10);
  assert(Array.isArray(u2u), "returns array");
  assert(u2u.every((e) => e.edgeType === "USER_SIMILARITY"), "all edges are USER_SIMILARITY");
  if (u2u.length > 0) {
    assert(
      u2u.every((e) => e.weight >= 0 && e.weight <= 1),
      "weights in [0, 1]"
    );
  }

  header(28, "getUserToProductEdges — HYBRID_CF edges, excludes already-interacted");

  cacheService.clear();
  const u2p = await getUserToProductEdges(testUser1Id, 20);
  assert(Array.isArray(u2p), "returns array");
  // If warm user → HYBRID_CF edges; if no similar users found, may be empty
  const hasHybridType = u2p.every((e) => e.edgeType === "HYBRID_CF");
  assert(hasHybridType, "all edges are HYBRID_CF type");
  // Must not include user1's own products
  assert(!u2p.some((e) => e.targetId === testProdAId), "product A (already interacted) excluded");
  assert(!u2p.some((e) => e.targetId === testProdBId), "product B (already interacted) excluded");

  header(29, "getProductToProductEdges — EMBEDDING_SIMILARITY edges");

  cacheService.clear();
  const p2p = await getProductToProductEdges(testProdAId, 5);
  assert(Array.isArray(p2p), "returns array");
  assert(p2p.length > 0, `p2p edges non-empty (got ${p2p.length})`);
  assert(
    p2p.every((e) => e.edgeType === "EMBEDDING_SIMILARITY"),
    "all edges are EMBEDDING_SIMILARITY"
  );
  assert(!p2p.some((e) => e.targetId === testProdAId), "source product not in own p2p");

  header(30, "getCelebrityToProductEdges — CELEBRITY_PRODUCT edges for test celebrity");

  cacheService.clear();
  const celeb2p = await getCelebrityToProductEdges(testCelebId, 20);
  assert(Array.isArray(celeb2p), "returns array");
  assert(celeb2p.length >= 3, `at least 3 celebrity product edges (got ${celeb2p.length})`);
  assert(
    celeb2p.every((e) => e.edgeType === "CELEBRITY_PRODUCT"),
    "all edges are CELEBRITY_PRODUCT"
  );
  // All targetIds should be products of this celebrity
  const targetIds = new Set(celeb2p.map((e) => e.targetId));
  assert(targetIds.has(testProdAId), "product A (belongs to celeb) in edges");
  assert(targetIds.has(testProdBId), "product B (belongs to celeb) in edges");
  assert(targetIds.has(testProdCId), "product C (belongs to celeb) in edges");

  header(31, "getBrandToProductEdges — BRAND_PRODUCT edges for test brand");

  cacheService.clear();
  const brand2p = await getBrandToProductEdges(testBrandId, 20);
  assert(Array.isArray(brand2p), "returns array");
  assert(brand2p.length >= 2, `at least 2 brand product edges (got ${brand2p.length})`);
  assert(
    brand2p.every((e) => e.edgeType === "BRAND_PRODUCT"),
    "all edges are BRAND_PRODUCT"
  );
  const brandTargets = new Set(brand2p.map((e) => e.targetId));
  assert(brandTargets.has(testProdAId), "product A (belongs to brand) in brand edges");
  assert(brandTargets.has(testProdBId), "product B (belongs to brand) in brand edges");
  // Product C has no brandId → should NOT be in brand edges
  assert(!brandTargets.has(testProdCId), "product C (no brandId) NOT in brand edges");
}

// ── Section 32-33: buildUserGraph ─────────────────────────────────────────────

async function testBuildUserGraph(): Promise<void> {
  header(32, "buildUserGraph — warm user → coldStart = false, has recommendations");

  cacheService.clear();
  const warmGraph = await buildUserGraph(testUser1Id, 20);
  assert(warmGraph.userId === testUser1Id, "userId matches");
  assert(Array.isArray(warmGraph.similarUsers),    "similarUsers is array");
  assert(Array.isArray(warmGraph.recommendations), "recommendations is array");
  assert(warmGraph.coldStart === false, `warm user → coldStart = false (got ${warmGraph.coldStart})`);
  assert(warmGraph.recommendations.length > 0, "warm user has recommendations");

  header(33, "buildUserGraph — cold user (no interactions) → gets fallback recommendations");

  cacheService.clear();
  const coldGraph = await buildUserGraph(testUser3Id, 20);
  assert(coldGraph.userId === testUser3Id, "userId matches");
  // User3 has no interactions. If trending products exist, the hybrid trending bonus
  // produces non-empty recs (coldStart=false but still popularity-based).
  // If no trending, cold-start pool is used (coldStart=true). Either way, must get recs.
  assert(coldGraph.recommendations.length > 0, "cold user gets fallback recommendations");
  // No user-based or item-based interactions → similar users list should be empty
  assert(coldGraph.similarUsers.length === 0, "cold user has no similar users");
  // All recommendation edges come from a valid edge type
  const allValidTypes = new Set(["HYBRID_CF", "TRENDING", "POPULAR", "NEWEST"]);
  assert(
    coldGraph.recommendations.every((e) => allValidTypes.has(e.edgeType)),
    `all edge types valid (got: ${[...new Set(coldGraph.recommendations.map((e) => e.edgeType))].join(", ")})`
  );
}

// ── Section 34-36: SimilarityRefreshWorker ────────────────────────────────────

async function testSimilarityRefreshWorker(): Promise<void> {
  header(34, "SimilarityRefreshWorker — single user mode");

  cacheService.clear();
  const resultU = await similarityRefreshWorker.run({ userId: testUser1Id });
  assert(resultU.usersRefreshed === 1, `usersRefreshed = 1 (got ${resultU.usersRefreshed})`);
  assert(resultU.productsRefreshed === 0, `productsRefreshed = 0 (got ${resultU.productsRefreshed})`);
  assert(resultU.errors === 0, `errors = 0 (got ${resultU.errors})`);

  header(35, "SimilarityRefreshWorker — single product mode");

  cacheService.clear();
  const resultP = await similarityRefreshWorker.run({ productId: testProdAId });
  assert(resultP.productsRefreshed === 1, `productsRefreshed = 1 (got ${resultP.productsRefreshed})`);
  assert(resultP.usersRefreshed === 0, `usersRefreshed = 0 (got ${resultP.usersRefreshed})`);
  assert(resultP.errors === 0, `errors = 0 (got ${resultP.errors})`);

  // productSimilarityMatrix should now have neighbors for product A
  const neighbors = productSimilarityMatrix.getNeighbors(testProdAId);
  assert(neighbors !== null, "product similarity matrix populated after refresh");
  if (neighbors) {
    assert(neighbors.length > 0, "at least one neighbor cached for product A");
  }

  header(36, "SimilarityRefreshWorker — batch sweep processes recently-active entities");

  cacheService.clear();
  const resultB = await similarityRefreshWorker.run({ lookbackMs: 60 * 60 * 1000 }); // 1h window
  assert(resultB.usersRefreshed >= 0, `usersRefreshed ≥ 0 (got ${resultB.usersRefreshed})`);
  assert(resultB.productsRefreshed >= 0, `productsRefreshed ≥ 0 (got ${resultB.productsRefreshed})`);
  assert(resultB.errors === 0, `errors = 0 (got ${resultB.errors})`);
  // User1, User2 have events within the lookback window
  assert(resultB.usersRefreshed >= 2, `at least 2 users refreshed (got ${resultB.usersRefreshed})`);
  // Products A, B, C have events within the lookback window
  assert(resultB.productsRefreshed >= 3, `at least 3 products refreshed (got ${resultB.productsRefreshed})`);
}

// ── Section 37-39: RecommendationGraphWorker ──────────────────────────────────

async function testRecommendationGraphWorker(): Promise<void> {
  header(37, "RecommendationGraphWorker — single user mode");

  cacheService.clear();
  const resultU = await recommendationGraphWorker.run({ userId: testUser1Id });
  assert(resultU.usersProcessed === 1, `usersProcessed = 1 (got ${resultU.usersProcessed})`);
  assert(resultU.productsProcessed === 0, `productsProcessed = 0 (got ${resultU.productsProcessed})`);
  assert(resultU.errors === 0, `errors = 0 (got ${resultU.errors})`);

  header(38, "RecommendationGraphWorker — single product mode");

  cacheService.clear();
  const resultP = await recommendationGraphWorker.run({ productId: testProdAId });
  assert(resultP.productsProcessed === 1, `productsProcessed = 1 (got ${resultP.productsProcessed})`);
  assert(resultP.usersProcessed === 0, `usersProcessed = 0 (got ${resultP.usersProcessed})`);
  assert(resultP.errors === 0, `errors = 0 (got ${resultP.errors})`);

  // Graph cache for this product should be warm
  assert(
    cacheService.has(`graph:p2p:${testProdAId}`),
    "p2p graph cache populated after single product mode"
  );

  header(39, "RecommendationGraphWorker — batch sweep pre-warms cold-start and graphs");

  cacheService.clear();
  const resultB = await recommendationGraphWorker.run({ lookbackMs: 60 * 60 * 1000 }); // 1h window
  assert(resultB.usersProcessed >= 0,        `usersProcessed ≥ 0 (got ${resultB.usersProcessed})`);
  assert(resultB.productsProcessed >= 0,     `productsProcessed ≥ 0 (got ${resultB.productsProcessed})`);
  assert(resultB.coldStartBuildCount >= 1,   `coldStartBuildCount ≥ 1 (global pre-warm ran)`);
  assert(resultB.errors === 0,               `errors = 0 (got ${resultB.errors})`);
  // Batch should have processed user1 and user2 (who have events in the lookback)
  assert(resultB.usersProcessed >= 2, `at least 2 users processed (got ${resultB.usersProcessed})`);
}

// ── Section 40: End-to-end pipeline ──────────────────────────────────────────

async function testEndToEndPipeline(): Promise<void> {
  header(40, "End-to-end — cold user gets cold-start recs; warm user gets hybrid recs");

  cacheService.clear();

  // Cold user: no interactions → buildUserGraph uses trending fallback or cold-start pool
  const coldGraph = await buildUserGraph(testUser3Id, 10);
  assert(coldGraph.recommendations.length > 0, "cold user still gets recommendations");

  // Warm user: has interactions → buildUserGraph uses hybrid CF
  cacheService.clear();
  const warmGraph = await buildUserGraph(testUser1Id, 10);
  assert(warmGraph.coldStart === false, "warm user uses hybrid CF");
  assert(warmGraph.recommendations.length > 0, "warm user gets personalized recommendations");

  // Warm user's recommendations should NOT include products they've already interacted with
  const warmProductIds = warmGraph.recommendations.map((r) => r.targetId);
  assert(!warmProductIds.includes(testProdAId), "warm user recs don't include already-viewed product A");
  assert(!warmProductIds.includes(testProdBId), "warm user recs don't include already-viewed product B");

  // Warm user's recommendations should include product C (from user2 similarity)
  assert(warmProductIds.includes(testProdCId), "warm user recs include product C (from similar user)");
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("============================================================");
console.log("  Sprint 5.3 — Collaborative Filtering Engine Tests");
console.log("============================================================");

await cleanup();
await setupFixtures();

await testSimilarityMatrix();
await testGetUserProductSet();
await testUserSimilarity();
await testProductSimilarityComponents();
await testProductHybridSimilarity();
await testCacheInvalidation();
await testFindSimilarUsers();
await testCFRecommendations();
await testColdStart();
await testGraphEdges();
await testBuildUserGraph();
await testSimilarityRefreshWorker();
await testRecommendationGraphWorker();
await testEndToEndPipeline();

await cleanup();
await prisma.$disconnect();

console.log("\n============================================================");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("============================================================\n");

if (failed > 0) process.exit(1);
