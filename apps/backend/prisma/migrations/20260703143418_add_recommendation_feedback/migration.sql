-- CreateEnum
CREATE TYPE "RecommendationFeedbackType" AS ENUM ('IMPRESSION', 'CLICK', 'DISMISS', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE', 'HIDE', 'SKIP', 'CONVERSION');

-- DropIndex
DROP INDEX "AnalyticsSession_createdAt_idx";

-- DropIndex
DROP INDEX "AnalyticsSession_userId_idx";

-- DropIndex
DROP INDEX "CoPurchasedPair_productBId_idx";

-- DropIndex
DROP INDEX "CoviewedPair_productBId_idx";

-- DropIndex
DROP INDEX "ProductEmbedding_embedding_hnsw";

-- DropIndex
DROP INDEX "RecommendationImpression_createdAt_idx";

-- DropIndex
DROP INDEX "RecommendationImpression_productId_idx";

-- DropIndex
DROP INDEX "RecommendationImpression_userId_idx";

-- DropIndex
DROP INDEX "TrendingProduct_rank_idx";

-- DropIndex
DROP INDEX "UserEmbedding_embedding_hnsw";

-- AlterTable
ALTER TABLE "AnalyticsSession" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CoPurchasedPair" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CoviewedPair" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductEmbedding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductFeatureStore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecommendationImpression" ADD COLUMN     "experimentId" TEXT,
ADD COLUMN     "variant" TEXT;

-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrendingProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserEmbedding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserFeatureStore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT NOT NULL,
    "feedbackType" "RecommendationFeedbackType" NOT NULL,
    "context" TEXT,
    "position" INTEGER,
    "experimentId" TEXT,
    "variant" TEXT,
    "revenue" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_feedbackType_idx" ON "RecommendationFeedback"("userId", "feedbackType");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_productId_feedbackType_idx" ON "RecommendationFeedback"("productId", "feedbackType");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_experimentId_variant_idx" ON "RecommendationFeedback"("experimentId", "variant");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_feedbackType_createdAt_idx" ON "RecommendationFeedback"("feedbackType", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_createdAt_idx" ON "RecommendationFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "ExperimentAssignment_experimentId_idx" ON "ExperimentAssignment"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentAssignment_userId_experimentId_key" ON "ExperimentAssignment"("userId", "experimentId");
