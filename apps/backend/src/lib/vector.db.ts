/**
 * vector.db — pgvector query helpers.
 *
 * All writes and ANN reads use $queryRaw (single SQL statements).
 * Non-vector field operations (count, findUnique on metadata) use normal Prisma client.
 * PgBouncer-safe: no interactive transactions.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

export interface SimilarProduct {
  productId:  string;
  similarity: number;
}

// ── Upserts ───────────────────────────────────────────────────────────────────

export async function upsertProductEmbedding(
  productId:    string,
  embedding:    number[],
  modelVersion: string,
  tokenCount?:  number
): Promise<void> {
  const id  = randomUUID();
  const vec = `[${embedding.join(",")}]`;

  await prisma.$queryRaw`
    INSERT INTO "ProductEmbedding"
      (id, "productId", embedding, "modelVersion", "tokenCount", "updatedAt", "createdAt")
    VALUES
      (${id}, ${productId}, ${vec}::vector, ${modelVersion}, ${tokenCount ?? null}, NOW(), NOW())
    ON CONFLICT ("productId") DO UPDATE SET
      embedding     = EXCLUDED.embedding,
      "modelVersion" = EXCLUDED."modelVersion",
      "tokenCount"   = EXCLUDED."tokenCount",
      "updatedAt"    = NOW()
  `;
}

export async function upsertUserEmbedding(
  userId:       string,
  embedding:    number[],
  modelVersion: string,
  signalCount:  number
): Promise<void> {
  const id  = randomUUID();
  const vec = `[${embedding.join(",")}]`;

  await prisma.$queryRaw`
    INSERT INTO "UserEmbedding"
      (id, "userId", embedding, "modelVersion", "signalCount", "updatedAt", "createdAt")
    VALUES
      (${id}, ${userId}, ${vec}::vector, ${modelVersion}, ${signalCount}, NOW(), NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      embedding      = EXCLUDED.embedding,
      "modelVersion" = EXCLUDED."modelVersion",
      "signalCount"  = EXCLUDED."signalCount",
      "updatedAt"    = NOW()
  `;
}

// ── ANN search ────────────────────────────────────────────────────────────────

/**
 * Find the most similar products to a query vector using cosine similarity.
 * Uses HNSW index when table is large enough (pgvector decides automatically).
 */
export async function findSimilarProducts(
  queryEmbedding:    number[],
  limit:             number   = 20,
  excludeProductIds: string[] = []
): Promise<SimilarProduct[]> {
  const vec = `[${queryEmbedding.join(",")}]`;

  let rows: Array<{ productId: string; similarity: number }>;

  if (excludeProductIds.length === 0) {
    rows = await prisma.$queryRaw`
      SELECT
        pe."productId",
        (1 - (pe.embedding <=> ${vec}::vector))::float8 AS similarity
      FROM "ProductEmbedding" pe
      ORDER BY pe.embedding <=> ${vec}::vector
      LIMIT ${limit}
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        pe."productId",
        (1 - (pe.embedding <=> ${vec}::vector))::float8 AS similarity
      FROM "ProductEmbedding" pe
      WHERE pe."productId" != ALL(${excludeProductIds}::text[])
      ORDER BY pe.embedding <=> ${vec}::vector
      LIMIT ${limit}
    `;
  }

  return rows.map((r) => ({
    productId:  r.productId,
    similarity: Number(r.similarity),
  }));
}

/**
 * Find products similar to a given product (excluding the product itself).
 * Self-join on the embedding table — the source embedding is read once.
 */
export async function findSimilarToProduct(
  productId: string,
  limit:     number = 10
): Promise<SimilarProduct[]> {
  const rows = await prisma.$queryRaw<Array<{ productId: string; similarity: number }>>`
    SELECT
      cand."productId",
      (1 - (cand.embedding <=> src.embedding))::float8 AS similarity
    FROM "ProductEmbedding" src
    JOIN "ProductEmbedding" cand
      ON cand."productId" != src."productId"
    WHERE src."productId" = ${productId}
    ORDER BY cand.embedding <=> src.embedding
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    productId:  r.productId,
    similarity: Number(r.similarity),
  }));
}

// ── Vector retrieval ──────────────────────────────────────────────────────────

/**
 * Read a stored product embedding back as a number[].
 * pgvector returns the vector in "[x,y,...]" text format.
 */
export async function getProductEmbeddingVector(productId: string): Promise<number[] | null> {
  const rows = await prisma.$queryRaw<Array<{ emb: string }>>`
    SELECT embedding::text AS emb
    FROM "ProductEmbedding"
    WHERE "productId" = ${productId}
  `;
  if (!rows.length) return null;
  return rows[0].emb.slice(1, -1).split(",").map(Number);
}

/**
 * Read a stored user embedding back as a number[].
 */
export async function getUserEmbeddingVector(userId: string): Promise<number[] | null> {
  const rows = await prisma.$queryRaw<Array<{ emb: string }>>`
    SELECT embedding::text AS emb
    FROM "UserEmbedding"
    WHERE "userId" = ${userId}
  `;
  if (!rows.length) return null;
  return rows[0].emb.slice(1, -1).split(",").map(Number);
}

/**
 * Batch-load product embedding vectors for a set of product IDs.
 * Returns a Map from productId → number[].
 */
export async function getBatchProductEmbeddings(
  productIds: string[]
): Promise<Map<string, number[]>> {
  if (productIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<Array<{ productId: string; emb: string }>>`
    SELECT "productId", embedding::text AS emb
    FROM "ProductEmbedding"
    WHERE "productId" = ANY(${productIds}::text[])
  `;

  const out = new Map<string, number[]>();
  for (const row of rows) {
    out.set(row.productId, row.emb.slice(1, -1).split(",").map(Number));
  }
  return out;
}

// ── Metadata (normal Prisma) ──────────────────────────────────────────────────

export async function hasProductEmbedding(productId: string): Promise<boolean> {
  const n = await prisma.productEmbedding.count({ where: { productId } });
  return n > 0;
}

export async function countProductEmbeddings(): Promise<number> {
  return prisma.productEmbedding.count();
}

export async function deleteProductEmbedding(productId: string): Promise<void> {
  await prisma.productEmbedding.deleteMany({ where: { productId } });
}

// ── Co-occurrence helpers ─────────────────────────────────────────────────────

export async function incrementCoPurchase(productAId: string, productBId: string): Promise<void> {
  // Always store with lexicographically smaller ID first (canonical pair)
  const [a, b] = productAId < productBId ? [productAId, productBId] : [productBId, productAId];

  await prisma.$queryRaw`
    INSERT INTO "CoPurchasedPair" ("productAId", "productBId", "coPurchaseCount", "updatedAt")
    VALUES (${a}, ${b}, 1, NOW())
    ON CONFLICT ("productAId", "productBId") DO UPDATE SET
      "coPurchaseCount" = "CoPurchasedPair"."coPurchaseCount" + 1,
      "updatedAt" = NOW()
  `;
}

export async function getTopCoPurchased(
  productId: string,
  limit:     number = 5
): Promise<Array<{ productId: string; count: number }>> {
  const rows = await prisma.$queryRaw<Array<{ productId: string; count: number }>>`
    SELECT
      CASE WHEN "productAId" = ${productId} THEN "productBId" ELSE "productAId" END AS "productId",
      "coPurchaseCount" AS count
    FROM "CoPurchasedPair"
    WHERE "productAId" = ${productId} OR "productBId" = ${productId}
    ORDER BY "coPurchaseCount" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ productId: r.productId, count: Number(r.count) }));
}
