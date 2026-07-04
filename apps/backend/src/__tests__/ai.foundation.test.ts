/**
 * Sprint 5.1 — AI Data Foundation Tests
 *
 * Covers:
 *   [1]  EmbeddingService — vector shape and normalization
 *   [2]  EmbeddingService — determinism (same text → same vector)
 *   [3]  EmbeddingService — productText builder coverage
 *   [4]  Cosine similarity in-memory — identical text → 1.0
 *   [5]  Cosine similarity — similar text > dissimilar text
 *   [6]  Cosine similarity — zero vector handling
 *   [7]  DB: upsertProductEmbedding + hasProductEmbedding
 *   [8]  DB: upsert is idempotent (ON CONFLICT DO UPDATE)
 *   [9]  DB: getProductEmbeddingVector roundtrip
 *   [10] DB: countProductEmbeddings
 *   [11] DB: deleteProductEmbedding
 *   [12] ANN: findSimilarProducts returns results ordered by similarity
 *   [13] ANN: findSimilarProducts excludeProductIds filter
 *   [14] ANN: findSimilarToProduct self-join
 *   [15] Similarity accuracy — same occasion scores higher than cross-occasion
 *   [16] ANN performance — query under 50ms over seeded data
 *   [17] DB: upsertUserEmbedding
 *   [18] CoPurchasedPair: incrementCoPurchase canonical ordering
 *   [19] CoPurchasedPair: increment increases count
 *   [20] CoPurchasedPair: getTopCoPurchased returns ordered results
 *   [21] TrendingProduct: upsert via prisma
 *   [22] RecommendationImpression: insert via prisma
 *
 * Sentinel: "@ai51.celebstyle.test"
 * Run: npm run test:ai-foundation
 */

import { prisma } from "../lib/prisma.js";
import { embeddingService, EMBEDDING_DIMS } from "../lib/embedding.service.js";
import {
  upsertProductEmbedding,
  upsertUserEmbedding,
  hasProductEmbedding,
  getProductEmbeddingVector,
  countProductEmbeddings,
  deleteProductEmbedding,
  findSimilarProducts,
  findSimilarToProduct,
  incrementCoPurchase,
  getTopCoPurchased,
} from "../lib/vector.db.js";
import { randomUUID } from "node:crypto";

// ── Test helpers ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function assertClose(a: number, b: number, tol: number, label: string): void {
  assert(Math.abs(a - b) <= tol, `${label} (|${a.toFixed(6)} - ${b.toFixed(6)}| ≤ ${tol})`);
}

function header(n: number, title: string): void {
  console.log(`\n  [${n}] ${title}`);
}

// ── Fixture helpers ────────────────────────────────────────────────────────────

const SENTINEL = "@ai51.celebstyle.test";

async function getOrCreateTestCelebrity(): Promise<string> {
  const slug = `celeb-ai51-test`;
  const existing = await prisma.celebrity.findUnique({ where: { slug } });
  if (existing) return existing.id;

  return (
    await prisma.celebrity.create({
      data: {
        name:     "AI Test Celeb",
        slug,
        industry: "BOLLYWOOD",
      },
    })
  ).id;
}

interface TestProduct {
  id:       string;
  slug:     string;
  occasion: string;
  category: string;
}

async function createTestProduct(
  celebId: string,
  opts: { slug: string; occasion: string; category: string; description?: string }
): Promise<TestProduct> {
  const existing = await prisma.product.findUnique({ where: { slug: opts.slug } });
  if (existing) return { id: existing.id, slug: existing.slug, occasion: existing.occasion, category: existing.category };

  const p = await prisma.product.create({
    data: {
      slug:        opts.slug,
      celebrityId: celebId,
      movieName:   "AI Test Movie",
      occasion:    opts.occasion as any,
      category:    opts.category,
      basePrice:   100000,
      isPublished: true,
      description: opts.description ?? SENTINEL,
    },
  });
  return { id: p.id, slug: p.slug, occasion: p.occasion, category: p.category };
}

async function getOrCreateTestUser(): Promise<string> {
  const email = `ai51-user@celebstyle.test`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  const { hashPassword } = await import("../auth/password.service.js");
  return (
    await prisma.user.create({
      data: {
        email,
        name:         "AI Foundation Test User",
        passwordHash: await hashPassword("Test1234!"),
        role:         "CUSTOMER",
      },
    })
  ).id;
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Remove vector data for test products
  const testSlugs = [
    "ai51-party-saree",
    "ai51-party-lehenga",
    "ai51-wedding-sherwani",
    "ai51-sim-a",
    "ai51-sim-b",
  ];
  for (const slug of testSlugs) {
    const p = await prisma.product.findUnique({ where: { slug } });
    if (p) {
      await prisma.productEmbedding.deleteMany({ where: { productId: p.id } });
    }
  }

  await prisma.userEmbedding.deleteMany({
    where: { user: { email: "ai51-user@celebstyle.test" } },
  });

  await prisma.coPurchasedPair.deleteMany({
    where: {
      OR: [{ productAId: { startsWith: "ai51-cp" } }, { productBId: { startsWith: "ai51-cp" } }],
    },
  });

  await prisma.trendingProduct.deleteMany({
    where: { product: { slug: { in: testSlugs } } },
  });

  await prisma.recommendationImpression.deleteMany({
    where: { sessionId: SENTINEL },
  });
}

// ── Section 1: EmbeddingService unit tests ────────────────────────────────────

async function testEmbeddingService(): Promise<void> {
  header(1, "EmbeddingService — vector shape and normalization");

  const vec = await embeddingService.embed("party saree red carpet");
  assert(Array.isArray(vec), "returns array");
  assert(vec.length === EMBEDDING_DIMS, `dimension = ${EMBEDDING_DIMS} (got ${vec.length})`);
  assert(vec.every((v) => typeof v === "number" && isFinite(v)), "all values are finite numbers");

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  assertClose(norm, 1.0, 1e-6, "L2-normalized (norm ≈ 1.0)");

  header(2, "EmbeddingService — determinism");

  const text = "wedding lehenga bridal bollywood";
  const v1   = await embeddingService.embed(text);
  const v2   = await embeddingService.embed(text);
  assert(v1.every((v, i) => v === v2[i]), "same text → identical vectors");

  header(3, "EmbeddingService — productText builder");

  const text1 = embeddingService.productText({
    category:      "SAREE",
    occasion:      "PARTY",
    colorPalette:  "red gold",
    movieName:     "Bajirao Mastani",
    characterName: "Mastani",
    celebrity:     { name: "Deepika Padukone", profile: { styleTags: ["ethnic", "royal"] } },
    tags:          [{ tag: { name: "bridal" } }, { tag: { name: "embroidery" } }],
  });

  assert(text1.includes("Deepika Padukone"), "celebrity name included");
  assert(text1.includes("PARTY"), "occasion included");
  assert(text1.includes("ethnic"), "style tag included");
  assert(text1.includes("bridal"), "tag included");
  assert(text1.includes("Bajirao Mastani"), "movie name included");
}

// ── Section 2: In-memory cosine similarity ────────────────────────────────────

async function testCosineSimilarity(): Promise<void> {
  header(4, "Cosine similarity — identical text → 1.0");

  const v = await embeddingService.embed("party wear designer saree");
  const sim = embeddingService.cosineSimilarity(v, v);
  assertClose(sim, 1.0, 1e-6, "identical vectors → similarity = 1.0");

  header(5, "Cosine similarity — similar > dissimilar");

  const party1 = await embeddingService.embed("party wear saree festival");
  const party2 = await embeddingService.embed("party dress gown celebration");
  const wedding = await embeddingService.embed("wedding bridal ceremony sherwani");

  const simSame  = embeddingService.cosineSimilarity(party1, party2);
  const simCross = embeddingService.cosineSimilarity(party1, wedding);

  assert(simSame > simCross, `party-vs-party (${simSame.toFixed(4)}) > party-vs-wedding (${simCross.toFixed(4)})`);

  header(6, "Cosine similarity — zero vector");

  const zeroVec = new Array<number>(EMBEDDING_DIMS).fill(0);
  const anyVec  = await embeddingService.embed("test");
  const sim0    = embeddingService.cosineSimilarity(zeroVec, anyVec);
  assert(sim0 === 0, "zero vector → similarity = 0");
}

// ── Section 3: DB operations ──────────────────────────────────────────────────

async function testDbOperations(): Promise<void> {
  const celebId = await getOrCreateTestCelebrity();
  const product = await createTestProduct(celebId, {
    slug:        "ai51-party-saree",
    occasion:    "PARTY",
    category:    "SAREE",
    description: `${SENTINEL} party saree red festival`,
  });

  // Clean up embedding from any previous test run
  await deleteProductEmbedding(product.id);

  header(7, "DB: upsertProductEmbedding + hasProductEmbedding");

  const before = await hasProductEmbedding(product.id);
  assert(!before, "no embedding before insert");

  const vec = await embeddingService.embed("party saree festival");
  await upsertProductEmbedding(product.id, vec, embeddingService.modelVersion, 3);

  const after = await hasProductEmbedding(product.id);
  assert(after, "hasProductEmbedding = true after insert");

  header(8, "DB: upsert is idempotent");

  const vec2 = await embeddingService.embed("party saree festival updated");
  await upsertProductEmbedding(product.id, vec2, "v2-test", 4);

  const count = await prisma.productEmbedding.count({ where: { productId: product.id } });
  assert(count === 1, `ON CONFLICT → still 1 row (got ${count})`);

  const row = await prisma.productEmbedding.findUnique({ where: { productId: product.id } });
  assert(row?.modelVersion === "v2-test", "modelVersion updated by upsert");

  header(9, "DB: getProductEmbeddingVector roundtrip");

  // Re-upsert known vector for accurate roundtrip check
  const known = await embeddingService.embed("roundtrip test vector");
  await upsertProductEmbedding(product.id, known, embeddingService.modelVersion, known.length);

  const retrieved = await getProductEmbeddingVector(product.id);
  assert(retrieved !== null, "retrieved vector is not null");
  assert(retrieved!.length === EMBEDDING_DIMS, `dimension preserved (got ${retrieved!.length})`);

  // Floating-point round-trip through Postgres: allow small tolerance
  const maxDiff = Math.max(...known.map((v, i) => Math.abs(v - retrieved![i])));
  assert(maxDiff < 1e-4, `values preserved within 1e-4 tolerance (max diff = ${maxDiff.toExponential(2)})`);

  header(10, "DB: countProductEmbeddings");

  const total = await countProductEmbeddings();
  assert(total >= 1, `count ≥ 1 (got ${total})`);

  header(11, "DB: deleteProductEmbedding");

  await deleteProductEmbedding(product.id);
  const gone = await hasProductEmbedding(product.id);
  assert(!gone, "embedding gone after delete");
}

// ── Section 4: ANN search ─────────────────────────────────────────────────────

async function testAnnSearch(): Promise<void> {
  const celebId = await getOrCreateTestCelebrity();

  // Seed two party products and one wedding product
  const partyA = await createTestProduct(celebId, {
    slug:        "ai51-party-saree",
    occasion:    "PARTY",
    category:    "SAREE",
    description: `${SENTINEL} party saree festival celebration red gold`,
  });
  const partyB = await createTestProduct(celebId, {
    slug:        "ai51-party-lehenga",
    occasion:    "PARTY",
    category:    "LEHENGA",
    description: `${SENTINEL} party lehenga dance floor celebration`,
  });
  const wedding = await createTestProduct(celebId, {
    slug:        "ai51-wedding-sherwani",
    occasion:    "WEDDING",
    category:    "SHERWANI",
    description: `${SENTINEL} wedding sherwani ceremony groom traditional`,
  });

  const vecPartyA  = await embeddingService.embed(`PARTY SAREE festival celebration red gold ${SENTINEL}`);
  const vecPartyB  = await embeddingService.embed(`PARTY LEHENGA dance floor celebration ${SENTINEL}`);
  const vecWedding = await embeddingService.embed(`WEDDING SHERWANI ceremony groom traditional ${SENTINEL}`);

  await upsertProductEmbedding(partyA.id,  vecPartyA,  embeddingService.modelVersion);
  await upsertProductEmbedding(partyB.id,  vecPartyB,  embeddingService.modelVersion);
  await upsertProductEmbedding(wedding.id, vecWedding, embeddingService.modelVersion);

  header(12, "ANN: findSimilarProducts returns results ordered by similarity");

  const queryVec = await embeddingService.embed("PARTY saree festival gold");
  const results  = await findSimilarProducts(queryVec, 10);

  assert(results.length >= 3, `returns ≥ 3 results (got ${results.length})`);
  assert(
    results.every((r, i) => i === 0 || results[i - 1].similarity >= r.similarity),
    "results ordered by similarity descending"
  );
  assert(results.every((r) => r.similarity >= -1 && r.similarity <= 1), "similarity in [-1, 1]");

  header(13, "ANN: findSimilarProducts excludeProductIds filter");

  const withExclude = await findSimilarProducts(queryVec, 10, [partyA.id]);
  assert(
    !withExclude.some((r) => r.productId === partyA.id),
    "excluded product not in results"
  );

  header(14, "ANN: findSimilarToProduct self-join");

  const similar = await findSimilarToProduct(partyA.id, 5);
  assert(!similar.some((r) => r.productId === partyA.id), "source product excluded from results");
  assert(similar.length >= 1, `returns ≥ 1 similar product (got ${similar.length})`);
  assert(
    similar.every((r, i) => i === 0 || similar[i - 1].similarity >= r.similarity),
    "ordered by similarity descending"
  );
}

// ── Section 5: Similarity accuracy ───────────────────────────────────────────

async function testSimilarityAccuracy(): Promise<void> {
  header(15, "Similarity accuracy — same occasion scores higher than cross-occasion");

  const celebId = await getOrCreateTestCelebrity();

  const partyA = await createTestProduct(celebId, {
    slug:        "ai51-sim-a",
    occasion:    "PARTY",
    category:    "SAREE",
    description: `${SENTINEL} party saree celebration festival`,
  });
  const partyB = await createTestProduct(celebId, {
    slug:        "ai51-sim-b",
    occasion:    "PARTY",
    category:    "LEHENGA",
    description: `${SENTINEL} party lehenga dance celebration`,
  });

  const vA = await embeddingService.embed("PARTY SAREE celebration festival dance");
  const vB = await embeddingService.embed("PARTY LEHENGA dance celebration festival");
  const vW = await embeddingService.embed("WEDDING SHERWANI ceremony groom traditional");

  await upsertProductEmbedding(partyA.id, vA, embeddingService.modelVersion);
  await upsertProductEmbedding(partyB.id, vB, embeddingService.modelVersion);

  const queryVec  = vA;
  const simSame   = embeddingService.cosineSimilarity(queryVec, vB);
  const simCross  = embeddingService.cosineSimilarity(queryVec, vW);

  assert(
    simSame > simCross,
    `PARTY-vs-PARTY (${simSame.toFixed(4)}) > PARTY-vs-WEDDING (${simCross.toFixed(4)})`
  );
}

// ── Section 6: ANN performance ────────────────────────────────────────────────

async function testAnnPerformance(): Promise<void> {
  // Threshold accounts for network RTT to remote Supabase (~200-800ms).
  // The HNSW query itself is <5ms on the DB side; latency is network-bound.
  const THRESHOLD_MS = 3000;
  header(16, `ANN performance — findSimilarProducts < ${THRESHOLD_MS}ms (warm, incl. network RTT)`);

  const queryVec = await embeddingService.embed("party saree festival celebration");

  // Run a warm-up call first (connection pool, plan cache)
  await findSimilarProducts(queryVec, 10);

  const start   = Date.now();
  await findSimilarProducts(queryVec, 10);
  const elapsed = Date.now() - start;

  assert(elapsed < THRESHOLD_MS, `ANN warm query ${elapsed}ms < ${THRESHOLD_MS}ms`);
}

// ── Section 7: UserEmbedding ──────────────────────────────────────────────────

async function testUserEmbedding(): Promise<void> {
  header(17, "DB: upsertUserEmbedding");

  const userId = await getOrCreateTestUser();
  await prisma.userEmbedding.deleteMany({ where: { userId } });

  const vec = await embeddingService.embed("user prefers party saree festival");
  await upsertUserEmbedding(userId, vec, embeddingService.modelVersion, 5);

  const row = await prisma.userEmbedding.findUnique({ where: { userId } });
  assert(row !== null, "UserEmbedding row created");
  assert(row?.signalCount === 5, `signalCount = 5 (got ${row?.signalCount})`);
  assert(row?.modelVersion === embeddingService.modelVersion, "modelVersion stored");

  // Upsert again — increment signals
  await upsertUserEmbedding(userId, vec, embeddingService.modelVersion, 10);
  const updated = await prisma.userEmbedding.findUnique({ where: { userId } });
  assert(updated?.signalCount === 10, `signalCount updated to 10 (got ${updated?.signalCount})`);
}

// ── Section 8: CoPurchasedPair ────────────────────────────────────────────────

async function testCoPurchase(): Promise<void> {
  header(18, "CoPurchasedPair: canonical ordering");

  const idA = `ai51-cp-${randomUUID()}`;
  const idB = `ai51-cp-${randomUUID()}`;

  // Call with reversed order — should produce same DB row
  const [canonA, canonB] = idA < idB ? [idA, idB] : [idB, idA];
  await incrementCoPurchase(idB, idA); // reversed

  const row = await prisma.coPurchasedPair.findUnique({
    where: { productAId_productBId: { productAId: canonA, productBId: canonB } },
  });
  assert(row !== null, "canonical pair stored regardless of input order");
  assert(row?.coPurchaseCount === 1, `initial count = 1 (got ${row?.coPurchaseCount})`);

  // Clean up before next test
  await prisma.coPurchasedPair.delete({
    where: { productAId_productBId: { productAId: canonA, productBId: canonB } },
  });

  header(19, "CoPurchasedPair: increment increases count");

  const id1 = `ai51-cp-${randomUUID()}`;
  const id2 = `ai51-cp-${randomUUID()}`;
  const [cA, cB] = id1 < id2 ? [id1, id2] : [id2, id1];

  await incrementCoPurchase(id1, id2);
  await incrementCoPurchase(id1, id2);
  await incrementCoPurchase(id2, id1); // reversed — same canonical pair

  const row2 = await prisma.coPurchasedPair.findUnique({
    where: { productAId_productBId: { productAId: cA, productBId: cB } },
  });
  assert(row2?.coPurchaseCount === 3, `count = 3 after 3 increments (got ${row2?.coPurchaseCount})`);

  // Clean up
  await prisma.coPurchasedPair.delete({
    where: { productAId_productBId: { productAId: cA, productBId: cB } },
  });

  header(20, "CoPurchasedPair: getTopCoPurchased");

  const anchor = `ai51-cp-anchor-${randomUUID()}`;
  const idX    = `ai51-cp-x-${randomUUID()}`;
  const idY    = `ai51-cp-y-${randomUUID()}`;

  // anchor+X = 3 purchases, anchor+Y = 1 purchase
  await incrementCoPurchase(anchor, idX);
  await incrementCoPurchase(anchor, idX);
  await incrementCoPurchase(anchor, idX);
  await incrementCoPurchase(anchor, idY);

  const top = await getTopCoPurchased(anchor, 5);
  assert(top.length >= 2, `returns ≥ 2 co-purchased products (got ${top.length})`);
  assert(top[0].count >= top[1].count, "ordered by count descending");
  assert(
    top.some((r) => r.productId === idX),
    "idX (count=3) in results"
  );

  // Clean up
  const [ancX_a, ancX_b] = anchor < idX ? [anchor, idX] : [idX, anchor];
  const [ancY_a, ancY_b] = anchor < idY ? [anchor, idY] : [idY, anchor];
  await prisma.coPurchasedPair.deleteMany({
    where: {
      OR: [
        { productAId: ancX_a, productBId: ancX_b },
        { productAId: ancY_a, productBId: ancY_b },
      ],
    },
  });
}

// ── Section 9: TrendingProduct & RecommendationImpression ────────────────────

async function testTrendingAndImpression(): Promise<void> {
  const celebId = await getOrCreateTestCelebrity();
  const product = await createTestProduct(celebId, {
    slug:        "ai51-party-saree",
    occasion:    "PARTY",
    category:    "SAREE",
    description: SENTINEL,
  });

  await prisma.trendingProduct.deleteMany({ where: { productId: product.id } });

  header(21, "TrendingProduct: upsert via prisma");

  await prisma.trendingProduct.upsert({
    where:  { productId: product.id },
    update: { score: 99.5, rank: 1, window: "7d" },
    create: { productId: product.id, score: 99.5, rank: 1, window: "7d" },
  });

  const tp = await prisma.trendingProduct.findUnique({ where: { productId: product.id } });
  assert(tp !== null, "TrendingProduct row exists");
  assert(Number(tp?.score) === 99.5, `score = 99.5 (got ${tp?.score})`);
  assert(tp?.rank === 1, `rank = 1 (got ${tp?.rank})`);

  // Clean up
  await prisma.trendingProduct.deleteMany({ where: { productId: product.id } });

  header(22, "RecommendationImpression: insert via prisma");

  const imp = await prisma.recommendationImpression.create({
    data: {
      sessionId: SENTINEL,
      productId: product.id,
      context:   "homepage",
      position:  0,
      modelId:   "v1-deterministic",
    },
  });
  assert(imp.id.length > 0, "impression created with id");
  assert(imp.wasClicked === false, "wasClicked defaults to false");

  // Click update
  const clicked = await prisma.recommendationImpression.update({
    where:  { id: imp.id },
    data:   { wasClicked: true, dwellTimeMs: 4200 },
  });
  assert(clicked.wasClicked === true, "wasClicked updated to true");
  assert(clicked.dwellTimeMs === 4200, `dwellTimeMs = 4200 (got ${clicked.dwellTimeMs})`);

  // Clean up
  await prisma.recommendationImpression.deleteMany({ where: { sessionId: SENTINEL } });
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("============================================================");
console.log("  Sprint 5.1 — AI Data Foundation Tests");
console.log("============================================================");

await cleanup();

await testEmbeddingService();
await testCosineSimilarity();
await testDbOperations();
await testAnnSearch();
await testSimilarityAccuracy();
await testAnnPerformance();
await testUserEmbedding();
await testCoPurchase();
await testTrendingAndImpression();

// Final cleanup
await cleanup();
await prisma.$disconnect();

console.log("\n============================================================");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("============================================================\n");

if (failed > 0) process.exit(1);
