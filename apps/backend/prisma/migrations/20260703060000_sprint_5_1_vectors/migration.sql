-- Sprint 5.1: AI Data Foundation — pgvector extension + vector store tables

-- Enable pgvector (idempotent; already enabled on most Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── ProductEmbedding ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductEmbedding" (
  "id"           TEXT         NOT NULL,
  "productId"    TEXT         NOT NULL,
  "embedding"    vector(1536) NOT NULL,
  "modelVersion" TEXT         NOT NULL DEFAULT 'v1-deterministic',
  "tokenCount"   INTEGER,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductEmbedding_productId_key"
  ON "ProductEmbedding"("productId");

-- HNSW index for fast approximate nearest-neighbor cosine search
CREATE INDEX IF NOT EXISTS "ProductEmbedding_embedding_hnsw"
  ON "ProductEmbedding" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE "ProductEmbedding"
  ADD CONSTRAINT "ProductEmbedding_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ProductEmbedding"
  VALIDATE CONSTRAINT "ProductEmbedding_productId_fkey";

-- ── UserEmbedding ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "UserEmbedding" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "embedding"    vector(1536) NOT NULL,
  "modelVersion" TEXT         NOT NULL DEFAULT 'v1-deterministic',
  "signalCount"  INTEGER      NOT NULL DEFAULT 0,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserEmbedding_userId_key"
  ON "UserEmbedding"("userId");

CREATE INDEX IF NOT EXISTS "UserEmbedding_embedding_hnsw"
  ON "UserEmbedding" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE "UserEmbedding"
  ADD CONSTRAINT "UserEmbedding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "UserEmbedding"
  VALIDATE CONSTRAINT "UserEmbedding_userId_fkey";

-- ── CoPurchasedPair ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CoPurchasedPair" (
  "productAId"      TEXT         NOT NULL,
  "productBId"      TEXT         NOT NULL,
  "coPurchaseCount" INTEGER      NOT NULL DEFAULT 1,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoPurchasedPair_pkey" PRIMARY KEY ("productAId", "productBId")
);

CREATE INDEX IF NOT EXISTS "CoPurchasedPair_productBId_idx"
  ON "CoPurchasedPair"("productBId");

-- ── CoviewedPair ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CoviewedPair" (
  "productAId"  TEXT         NOT NULL,
  "productBId"  TEXT         NOT NULL,
  "coviewCount" INTEGER      NOT NULL DEFAULT 1,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoviewedPair_pkey" PRIMARY KEY ("productAId", "productBId")
);

CREATE INDEX IF NOT EXISTS "CoviewedPair_productBId_idx"
  ON "CoviewedPair"("productBId");

-- ── TrendingProduct ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TrendingProduct" (
  "id"        TEXT           NOT NULL,
  "productId" TEXT           NOT NULL,
  "score"     DECIMAL(12, 4) NOT NULL,
  "window"    TEXT           NOT NULL DEFAULT '7d',
  "rank"      INTEGER        NOT NULL,
  "updatedAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrendingProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrendingProduct_productId_key"
  ON "TrendingProduct"("productId");

CREATE INDEX IF NOT EXISTS "TrendingProduct_rank_idx"
  ON "TrendingProduct"("rank" ASC);

ALTER TABLE "TrendingProduct"
  ADD CONSTRAINT "TrendingProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "TrendingProduct"
  VALIDATE CONSTRAINT "TrendingProduct_productId_fkey";

-- ── RecommendationImpression ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RecommendationImpression" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT,
  "sessionId"   TEXT,
  "productId"   TEXT         NOT NULL,
  "context"     TEXT         NOT NULL,
  "position"    INTEGER      NOT NULL,
  "modelId"     TEXT,
  "wasClicked"  BOOLEAN      NOT NULL DEFAULT false,
  "dwellTimeMs" INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationImpression_pkey" PRIMARY KEY ("id")
);

-- Indexes for analytics queries (CTR by product, user, time)
CREATE INDEX IF NOT EXISTS "RecommendationImpression_productId_idx"
  ON "RecommendationImpression"("productId");
CREATE INDEX IF NOT EXISTS "RecommendationImpression_userId_idx"
  ON "RecommendationImpression"("userId");
CREATE INDEX IF NOT EXISTS "RecommendationImpression_createdAt_idx"
  ON "RecommendationImpression"("createdAt" DESC);
