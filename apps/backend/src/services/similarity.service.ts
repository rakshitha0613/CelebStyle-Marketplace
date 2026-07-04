/**
 * similarity.service — core similarity algorithms for users and products.
 *
 * User similarity:
 *   - Cosine (sparse feature vectors from UserFeatureStore)
 *   - Jaccard (product interaction sets)
 *   - Weighted hybrid
 *
 * Product similarity:
 *   - Embedding (pgvector cosine)
 *   - Co-purchase (CoPurchasedPair)
 *   - Co-view (CoviewedPair)
 *   - Brand / Category / Price / Celebrity / Style-tag
 *   - Weighted hybrid
 *
 * All DB operations are single-statement queries (PgBouncer-safe).
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { getUserFeatures } from "./feature.service.js";
import { getProductEmbeddingVector } from "../lib/vector.db.js";
import { embeddingService } from "../lib/embedding.service.js";

// ── Cache key helpers ─────────────────────────────────────────────────────────

const KEY = {
  userSimilarity:    (id: string) => `cf:sim:u2u:${id}`,
  productSimilarity: (id: string) => `cf:sim:p2p:${id}`,
  userProductSet:    (id: string) => `cf:ups:${id}`,
  productInfo:       (id: string) => `sim:pinfo:${id}`,
};

// ── Sparse vector utilities ───────────────────────────────────────────────────

type SparseVector = Map<string, number>;

function l2NormalizeSparse(vec: SparseVector): SparseVector {
  let norm = 0;
  for (const v of vec.values()) norm += v * v;
  if (norm === 0) return vec;
  const sqrtNorm = Math.sqrt(norm);
  const out = new Map<string, number>();
  for (const [k, v] of vec) out.set(k, v / sqrtNorm);
  return out;
}

function sparseDot(a: SparseVector, b: SparseVector): number {
  // Iterate over the smaller vector for efficiency
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, av] of small) {
    const bv = large.get(k);
    if (bv !== undefined) dot += av * bv;
  }
  return dot;
}

function jaccardSet(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── SimilarityMatrix — sparse cached adjacency list ──────────────────────────

export interface SimilarityEntry {
  id:    string;
  score: number;
}

class SimilarityMatrix {
  constructor(
    private readonly type: "user" | "product",
    private readonly ttlMs: number
  ) {}

  private key = (id: string) => `sim:mat:${this.type}:${id}`;

  getNeighbors(id: string): SimilarityEntry[] | null {
    return cacheService.get<SimilarityEntry[]>(this.key(id));
  }

  setNeighbors(id: string, neighbors: SimilarityEntry[]): void {
    cacheService.set(this.key(id), neighbors, this.ttlMs);
  }

  invalidate(...ids: string[]): void {
    for (const id of ids) cacheService.del(this.key(id));
  }
}

export const userSimilarityMatrix    = new SimilarityMatrix("user",    15 * 60_000);
export const productSimilarityMatrix = new SimilarityMatrix("product", 30 * 60_000);

// ── User interaction set ──────────────────────────────────────────────────────

export async function getUserProductSet(userId: string): Promise<Set<string>> {
  const cached = cacheService.get<string[]>(KEY.userProductSet(userId));
  if (cached) return new Set(cached);

  const [orders, wishlist, cart, views] = await Promise.all([
    prisma.orderItem.findMany({
      where:  { order: { userId } },
      select: { productId: true },
    }),
    prisma.wishlistItem.findMany({
      where:  { wishlist: { userId } },
      select: { productId: true },
    }),
    prisma.cartItem.findMany({
      where:  { cart: { userId } },
      select: { productId: true },
    }),
    prisma.analyticsEvent.findMany({
      where:  { userId, type: "PRODUCT_VIEW", productId: { not: null } },
      select: { productId: true },
      take:   300,
    }),
  ]);

  const set = new Set<string>();
  for (const r of [...orders, ...wishlist, ...cart, ...views]) {
    if (r.productId) set.add(r.productId);
  }

  cacheService.set(KEY.userProductSet(userId), [...set], 5 * 60_000);
  return set;
}

// ── User sparse feature vector ────────────────────────────────────────────────

async function buildUserSparseVector(userId: string): Promise<SparseVector> {
  const features = await getUserFeatures(userId);
  if (!features) return new Map();

  const vec = new Map<string, number>();

  for (const [k, w] of Object.entries(features.categoryAffinity))   vec.set(`cat:${k}`,   Number(w));
  for (const [k, w] of Object.entries(features.occasionPreference)) vec.set(`occ:${k}`,   Number(w));
  for (const [k, w] of Object.entries(features.brandAffinity))      vec.set(`brand:${k}`, Number(w));
  for (const [k, w] of Object.entries(features.celebrityAffinity))  vec.set(`celeb:${k}`, Number(w));
  for (const [k, w] of Object.entries(features.wishlistAffinity))   vec.set(`wl:${k}`,    Number(w) * 2);
  for (const [k, w] of Object.entries(features.cartAffinity))       vec.set(`cart:${k}`,  Number(w) * 3);
  for (const [k, w] of Object.entries(features.colorPreference))    vec.set(`color:${k}`, Number(w));

  // Price range bucket (₹500 per bucket)
  const avg = features.pricePreference.avg;
  if (avg > 0) vec.set(`price:${Math.floor(avg / 50_000)}`, 5);

  return l2NormalizeSparse(vec);
}

// ── User similarity ───────────────────────────────────────────────────────────

export async function userCosineSimilarity(userA: string, userB: string): Promise<number> {
  const [vecA, vecB] = await Promise.all([
    buildUserSparseVector(userA),
    buildUserSparseVector(userB),
  ]);
  if (!vecA.size || !vecB.size) return 0;
  // Vectors are already L2-normalized — dot product = cosine similarity
  return Math.max(0, Math.min(1, sparseDot(vecA, vecB)));
}

export async function userJaccardSimilarity(userA: string, userB: string): Promise<number> {
  const [setA, setB] = await Promise.all([
    getUserProductSet(userA),
    getUserProductSet(userB),
  ]);
  return jaccardSet(setA, setB);
}

export async function userHybridSimilarity(userA: string, userB: string): Promise<number> {
  const [cosine, jaccard] = await Promise.all([
    userCosineSimilarity(userA, userB),
    userJaccardSimilarity(userA, userB),
  ]);
  return 0.60 * cosine + 0.40 * jaccard;
}

// ── Product info (cached) ─────────────────────────────────────────────────────

interface ProductInfo {
  id:          string;
  category:    string;
  occasion:    string;
  basePrice:   number;
  brandId:     string | null;
  celebrityId: string;
  tags:        string[];
  publishedAt: Date | null;
}

async function getProductInfo(productId: string): Promise<ProductInfo | null> {
  const cached = cacheService.get<ProductInfo>(KEY.productInfo(productId));
  if (cached) return cached;

  const p = await prisma.product.findUnique({
    where:  { id: productId },
    select: {
      id:          true,
      category:    true,
      occasion:    true,
      basePrice:   true,
      brandId:     true,
      celebrityId: true,
      publishedAt: true,
      tags:        { include: { tag: { select: { name: true } } } },
    },
  });
  if (!p) return null;

  const info: ProductInfo = {
    id:          p.id,
    category:    p.category,
    occasion:    p.occasion,
    basePrice:   p.basePrice,
    brandId:     p.brandId,
    celebrityId: p.celebrityId,
    publishedAt: p.publishedAt,
    tags:        p.tags.map((t) => t.tag.name),
  };
  cacheService.set(KEY.productInfo(productId), info, 15 * 60_000);
  return info;
}

// ── Product similarity components ─────────────────────────────────────────────

export async function productEmbeddingSimilarity(pidA: string, pidB: string): Promise<number> {
  const [vecA, vecB] = await Promise.all([
    getProductEmbeddingVector(pidA),
    getProductEmbeddingVector(pidB),
  ]);
  if (!vecA || !vecB) return 0;
  return Math.max(0, embeddingService.cosineSimilarity(vecA, vecB));
}

export async function productCoPurchaseSimilarity(pidA: string, pidB: string): Promise<number> {
  const [a, b] = pidA < pidB ? [pidA, pidB] : [pidB, pidA];
  const pair = await prisma.coPurchasedPair.findUnique({
    where: { productAId_productBId: { productAId: a, productBId: b } },
  });
  if (!pair) return 0;
  return Math.min(Math.log(pair.coPurchaseCount + 1) / Math.log(100), 1);
}

export async function productCoViewSimilarity(pidA: string, pidB: string): Promise<number> {
  const [a, b] = pidA < pidB ? [pidA, pidB] : [pidB, pidA];
  const pair = await prisma.coviewedPair.findUnique({
    where: { productAId_productBId: { productAId: a, productBId: b } },
  });
  if (!pair) return 0;
  return Math.min(Math.log(pair.coviewCount + 1) / Math.log(100), 1);
}

// ── Product hybrid similarity ─────────────────────────────────────────────────

export interface ProductSimilarityWeights {
  embedding:  number;
  coPurchase: number;
  coView:     number;
  brand:      number;
  category:   number;
  price:      number;
  celebrity:  number;
  styleTag:   number;
}

export const DEFAULT_PRODUCT_WEIGHTS: ProductSimilarityWeights = {
  embedding:  0.40,
  coPurchase: 0.20,
  coView:     0.10,
  category:   0.10,
  brand:      0.05,
  price:      0.05,
  celebrity:  0.05,
  styleTag:   0.05,
};

export async function productHybridSimilarity(
  pidA:    string,
  pidB:    string,
  weights: ProductSimilarityWeights = DEFAULT_PRODUCT_WEIGHTS
): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB) return 0;

  const [embSim, coPurchSim, coViewSim] = await Promise.all([
    productEmbeddingSimilarity(pidA, pidB),
    productCoPurchaseSimilarity(pidA, pidB),
    productCoViewSimilarity(pidA, pidB),
  ]);

  const brandSim    = pA.brandId && pA.brandId === pB.brandId ? 1 : 0;
  const categorySim = pA.category === pB.category ? 1 : 0;
  const celebSim    = pA.celebrityId === pB.celebrityId ? 1 : 0;
  const priceSim    = 1 - Math.abs(pA.basePrice - pB.basePrice) / Math.max(pA.basePrice, pB.basePrice, 1);
  const tagSim      = jaccardSet(new Set(pA.tags), new Set(pB.tags));

  const score =
    weights.embedding  * embSim      +
    weights.coPurchase * coPurchSim  +
    weights.coView     * coViewSim   +
    weights.brand      * brandSim    +
    weights.category   * categorySim +
    weights.price      * priceSim    +
    weights.celebrity  * celebSim    +
    weights.styleTag   * tagSim;

  return parseFloat(score.toFixed(6));
}

// ── Individual component accessors (for graph service) ────────────────────────

export async function productBrandSimilarity(pidA: string, pidB: string): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB || !pA.brandId || !pB.brandId) return 0;
  return pA.brandId === pB.brandId ? 1 : 0;
}

export async function productCategorySimilarity(pidA: string, pidB: string): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB) return 0;
  return pA.category === pB.category ? 1 : 0;
}

export async function productPriceSimilarity(pidA: string, pidB: string): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB) return 0;
  return 1 - Math.abs(pA.basePrice - pB.basePrice) / Math.max(pA.basePrice, pB.basePrice, 1);
}

export async function productCelebritySimilarity(pidA: string, pidB: string): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB) return 0;
  return pA.celebrityId === pB.celebrityId ? 1 : 0;
}

export async function productStyleTagSimilarity(pidA: string, pidB: string): Promise<number> {
  const [pA, pB] = await Promise.all([getProductInfo(pidA), getProductInfo(pidB)]);
  if (!pA || !pB) return 0;
  return jaccardSet(new Set(pA.tags), new Set(pB.tags));
}

// ── Cache invalidation ────────────────────────────────────────────────────────

export function invalidateProductSimilarityCache(productId: string): void {
  productSimilarityMatrix.invalidate(productId);
  cacheService.del(KEY.productInfo(productId));
}

export function invalidateUserInteractionCache(userId: string): void {
  cacheService.del(KEY.userProductSet(userId));
  userSimilarityMatrix.invalidate(userId);
}

export const similarityService = {
  userCosineSimilarity,
  userJaccardSimilarity,
  userHybridSimilarity,
  productEmbeddingSimilarity,
  productCoPurchaseSimilarity,
  productCoViewSimilarity,
  productHybridSimilarity,
  productBrandSimilarity,
  productCategorySimilarity,
  productPriceSimilarity,
  productCelebritySimilarity,
  productStyleTagSimilarity,
  getUserProductSet,
  userSimilarityMatrix,
  productSimilarityMatrix,
  invalidateProductSimilarityCache,
  invalidateUserInteractionCache,
};
