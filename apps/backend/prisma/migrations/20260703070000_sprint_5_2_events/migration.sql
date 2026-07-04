-- Sprint 5.2: Event Pipeline & Feature Store

-- ── New enum values (idempotent in PG 12+) ───────────────────────────────────

ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'REMOVE_FROM_WISHLIST';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'SCROLL_DEPTH';
ALTER TYPE "AnalyticsEventType" ADD VALUE IF NOT EXISTS 'SESSION_END';

-- ── AnalyticsEvent: add page column ──────────────────────────────────────────

ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "page" TEXT;

-- ── AnalyticsSession ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AnalyticsSession" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT,
  "device"      TEXT,
  "browser"     TEXT,
  "country"     TEXT,
  "state"       TEXT,
  "city"        TEXT,
  "referrer"    TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "firstPage"   TEXT,
  "eventCount"  INTEGER      NOT NULL DEFAULT 0,
  "endedAt"     TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsSession_userId_idx"
  ON "AnalyticsSession"("userId");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_createdAt_idx"
  ON "AnalyticsSession"("createdAt" DESC);

-- ── UserFeatureStore ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "UserFeatureStore" (
  "id"                 TEXT             NOT NULL,
  "userId"             TEXT             NOT NULL,
  "categoryAffinity"   JSONB            NOT NULL DEFAULT '{}',
  "celebrityAffinity"  JSONB            NOT NULL DEFAULT '{}',
  "brandAffinity"      JSONB            NOT NULL DEFAULT '{}',
  "pricePreference"    JSONB            NOT NULL DEFAULT '{}',
  "colorPreference"    JSONB            NOT NULL DEFAULT '{}',
  "occasionPreference" JSONB            NOT NULL DEFAULT '{}',
  "purchaseFrequency"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recencyScore"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "monetaryScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "wishlistAffinity"   JSONB            NOT NULL DEFAULT '{}',
  "cartAffinity"       JSONB            NOT NULL DEFAULT '{}',
  "searchAffinity"     JSONB            NOT NULL DEFAULT '{}',
  "computedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFeatureStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserFeatureStore_userId_key"
  ON "UserFeatureStore"("userId");

ALTER TABLE "UserFeatureStore"
  ADD CONSTRAINT "UserFeatureStore_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "UserFeatureStore"
  VALIDATE CONSTRAINT "UserFeatureStore_userId_fkey";

-- ── ProductFeatureStore ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductFeatureStore" (
  "id"              TEXT             NOT NULL,
  "productId"       TEXT             NOT NULL,
  "ctr"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversionRate"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "wishlistRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "addToCartRate"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "returnRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendingScore"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freshnessScore"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "computedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFeatureStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFeatureStore_productId_key"
  ON "ProductFeatureStore"("productId");

ALTER TABLE "ProductFeatureStore"
  ADD CONSTRAINT "ProductFeatureStore_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ProductFeatureStore"
  VALIDATE CONSTRAINT "ProductFeatureStore_productId_fkey";
