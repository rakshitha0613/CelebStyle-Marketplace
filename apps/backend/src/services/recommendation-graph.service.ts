/**
 * recommendation-graph.service — multi-relation recommendation graph.
 *
 * Supports edges:
 *   user → user    (similar users)
 *   user → product (personalized recommendations)
 *   product → product (similar products)
 *   celebrity → product (celebrity's published catalogue)
 *   brand → product (brand's published catalogue)
 *
 * Cold-start strategy:
 *   New users  → trending + popular + newest + celebrity picks
 *   New products → embedding neighbors + category + brand + celebrity
 *
 * All queries are single-statement (PgBouncer-safe).
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import {
  findSimilarUsers,
  getHybridRecommendations,
} from "./collaborative-filtering.service.js";
import { getUserProductSet } from "./similarity.service.js";
import { findSimilarToProduct } from "../lib/vector.db.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GraphEdge {
  targetId:  string;
  weight:    number;
  edgeType:  string;
}

// ── Cache key helpers ─────────────────────────────────────────────────────────

const KEY = {
  u2u:   (id: string) => `graph:u2u:${id}`,
  u2p:   (id: string) => `graph:u2p:${id}`,
  p2p:   (id: string) => `graph:p2p:${id}`,
  celeb: (id: string) => `graph:celeb:${id}`,
  brand: (id: string) => `graph:brand:${id}`,
  cold:  () => "graph:cold:start",
};

const TTL = {
  graph:  20 * 60_000,  // 20 min
  celeb:  30 * 60_000,  // 30 min (celebrity catalogue changes rarely)
  brand:  30 * 60_000,
  cold:   10 * 60_000,
};

// ── user → user ───────────────────────────────────────────────────────────────

export async function getUserToUserEdges(userId: string, limit = 10): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.u2u(userId));
  if (cached) return cached;

  const similar = await findSimilarUsers(userId, limit);
  const edges: GraphEdge[] = similar.map(({ id, score }) => ({
    targetId: id,
    weight:   score,
    edgeType: "USER_SIMILARITY",
  }));

  cacheService.set(KEY.u2u(userId), edges, TTL.graph);
  return edges;
}

// ── user → product ────────────────────────────────────────────────────────────

export async function getUserToProductEdges(userId: string, limit = 20): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.u2p(userId));
  if (cached) return cached;

  const recs = await getHybridRecommendations(userId, limit);
  const interacted = await getUserProductSet(userId);

  const edges: GraphEdge[] = recs
    .filter(({ id }) => !interacted.has(id))
    .map(({ id, score }) => ({
      targetId: id,
      weight:   score,
      edgeType: "HYBRID_CF",
    }));

  cacheService.set(KEY.u2p(userId), edges, TTL.graph);
  return edges;
}

// ── product → product ─────────────────────────────────────────────────────────

export async function getProductToProductEdges(productId: string, limit = 10): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.p2p(productId));
  if (cached) return cached;

  const similar = await findSimilarToProduct(productId, limit);
  const edges: GraphEdge[] = similar.map(({ productId: id, similarity }) => ({
    targetId: id,
    weight:   similarity,
    edgeType: "EMBEDDING_SIMILARITY",
  }));

  cacheService.set(KEY.p2p(productId), edges, TTL.graph);
  return edges;
}

// ── celebrity → product ───────────────────────────────────────────────────────

export async function getCelebrityToProductEdges(
  celebrityId: string,
  limit = 20
): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.celeb(celebrityId));
  if (cached) return cached;

  const products = await prisma.product.findMany({
    where:   { celebrityId, isPublished: true, deletedAt: null },
    select:  { id: true, viewCount: true, orderCount: true, wishlistCount: true },
    orderBy: { publishedAt: "desc" },
    take:    limit,
  });

  const edges: GraphEdge[] = products.map((p) => ({
    targetId: p.id,
    weight:   (p.viewCount + p.orderCount * 5 + p.wishlistCount * 2) / 100 || 0.1,
    edgeType: "CELEBRITY_PRODUCT",
  }));

  cacheService.set(KEY.celeb(celebrityId), edges, TTL.celeb);
  return edges;
}

// ── brand → product ───────────────────────────────────────────────────────────

export async function getBrandToProductEdges(brandId: string, limit = 20): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.brand(brandId));
  if (cached) return cached;

  const products = await prisma.product.findMany({
    where:   { brandId, isPublished: true, deletedAt: null },
    select:  { id: true, viewCount: true, orderCount: true, wishlistCount: true },
    orderBy: { publishedAt: "desc" },
    take:    limit,
  });

  const edges: GraphEdge[] = products.map((p) => ({
    targetId: p.id,
    weight:   (p.viewCount + p.orderCount * 5 + p.wishlistCount * 2) / 100 || 0.1,
    edgeType: "BRAND_PRODUCT",
  }));

  cacheService.set(KEY.brand(brandId), edges, TTL.brand);
  return edges;
}

// ── Cold start: new users ─────────────────────────────────────────────────────

export async function getColdStartForUser(limit = 20): Promise<GraphEdge[]> {
  const cached = cacheService.get<GraphEdge[]>(KEY.cold());
  if (cached) return cached;

  const third = Math.ceil(limit / 3);

  const [trending, popular, newest] = await Promise.all([
    // Trending (from TrendingProduct table)
    prisma.trendingProduct.findMany({
      where:   { rank: { lte: third * 2 } },
      select:  { productId: true, rank: true },
      orderBy: { rank: "asc" },
      take:    third,
    }),
    // Popular (by order count)
    prisma.product.findMany({
      where:   { isPublished: true, deletedAt: null },
      select:  { id: true, orderCount: true, viewCount: true },
      orderBy: { orderCount: "desc" },
      take:    third,
    }),
    // Newest
    prisma.product.findMany({
      where:   { isPublished: true, deletedAt: null },
      select:  { id: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take:    third,
    }),
  ]);

  const seen  = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const t of trending) {
    if (!seen.has(t.productId)) {
      seen.add(t.productId);
      edges.push({ targetId: t.productId, weight: 1 - (t.rank - 1) / 100, edgeType: "TRENDING" });
    }
  }
  for (const p of popular) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      edges.push({ targetId: p.id, weight: 0.7, edgeType: "POPULAR" });
    }
  }
  for (const p of newest) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      edges.push({ targetId: p.id, weight: 0.5, edgeType: "NEWEST" });
    }
  }

  cacheService.set(KEY.cold(), edges, TTL.cold);
  return edges;
}

// ── Cold start: new products ──────────────────────────────────────────────────

export async function getColdStartForProduct(productId: string, limit = 10): Promise<GraphEdge[]> {
  // 1. Embedding neighbors (ANN)
  const embSimilar = await findSimilarToProduct(productId, Math.ceil(limit / 2));
  const seen = new Set<string>([productId, ...embSimilar.map((s) => s.productId)]);
  const edges: GraphEdge[] = embSimilar.map(({ productId: id, similarity }) => ({
    targetId: id,
    weight:   similarity,
    edgeType: "EMBEDDING",
  }));

  // 2. Same-category fallback
  if (edges.length < limit) {
    const product = await prisma.product.findUnique({
      where:  { id: productId },
      select: { category: true, brandId: true, celebrityId: true },
    });

    if (product) {
      const remain = limit - edges.length;

      const [catProds, celebProds] = await Promise.all([
        prisma.product.findMany({
          where:   { category: product.category, isPublished: true, deletedAt: null, id: { notIn: [...seen] } },
          select:  { id: true },
          orderBy: { orderCount: "desc" },
          take:    Math.ceil(remain / 2),
        }),
        prisma.product.findMany({
          where:   { celebrityId: product.celebrityId, isPublished: true, deletedAt: null, id: { notIn: [...seen] } },
          select:  { id: true },
          orderBy: { publishedAt: "desc" },
          take:    Math.floor(remain / 2),
        }),
      ]);

      for (const p of catProds) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          edges.push({ targetId: p.id, weight: 0.4, edgeType: "CATEGORY" });
        }
      }
      for (const p of celebProds) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          edges.push({ targetId: p.id, weight: 0.35, edgeType: "CELEBRITY" });
        }
      }

      // 3. Brand fallback
      if (product.brandId && edges.length < limit) {
        const brandProds = await prisma.product.findMany({
          where:   { brandId: product.brandId, isPublished: true, deletedAt: null, id: { notIn: [...seen] } },
          select:  { id: true },
          orderBy: { orderCount: "desc" },
          take:    limit - edges.length,
        });
        for (const p of brandProds) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            edges.push({ targetId: p.id, weight: 0.3, edgeType: "BRAND" });
          }
        }
      }
    }
  }

  return edges.slice(0, limit);
}

// ── Build user graph snapshot ─────────────────────────────────────────────────

export interface UserGraph {
  userId:            string;
  similarUsers:      GraphEdge[];
  recommendations:   GraphEdge[];
  coldStart:         boolean;
}

export async function buildUserGraph(userId: string, limit = 20): Promise<UserGraph> {
  const [u2u, u2p] = await Promise.all([
    getUserToUserEdges(userId, 10),
    getUserToProductEdges(userId, limit),
  ]);

  const coldStart = u2p.length === 0;
  const recs = coldStart ? await getColdStartForUser(limit) : u2p;

  return { userId, similarUsers: u2u, recommendations: recs, coldStart };
}

export const recommendationGraphService = {
  getUserToUserEdges,
  getUserToProductEdges,
  getProductToProductEdges,
  getCelebrityToProductEdges,
  getBrandToProductEdges,
  getColdStartForUser,
  getColdStartForProduct,
  buildUserGraph,
};
