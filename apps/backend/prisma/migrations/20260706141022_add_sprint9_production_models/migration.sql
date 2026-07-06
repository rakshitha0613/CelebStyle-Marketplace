-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "celebrityId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "coverImage" TEXT,
    "tags" TEXT[],
    "productIds" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "outfitName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "screenshotUrl" TEXT,
    "notes" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedLook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "outfitName" TEXT NOT NULL,
    "targetPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CelebrityFollowAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "celebrityName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CelebrityFollowAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontPageView" (
    "id" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "productId" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontPageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "deliveryAddress" TEXT NOT NULL,
    "totalUnits" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountRate" DECIMAL(5,4) NOT NULL,
    "discountedTotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkOrderItem" (
    "id" TEXT NOT NULL,
    "bulkOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "outfitName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "pricePerUnit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BulkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brideName" TEXT NOT NULL DEFAULT '',
    "groomName" TEXT NOT NULL DEFAULT '',
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "deliveryAddress" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "rushFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "stylistNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingOrderItem" (
    "id" TEXT NOT NULL,
    "weddingOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "outfitName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "customFabric" TEXT,
    "customColour" TEXT,
    "customNotes" TEXT,
    "pricePerUnit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "WeddingOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "outfitName" TEXT NOT NULL,
    "customFabric" TEXT,
    "customColour" TEXT,
    "embroidery" BOOLEAN NOT NULL DEFAULT false,
    "embroideryText" TEXT,
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "additionalNotes" TEXT,
    "estimatedPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "quoteAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_isPublished_createdAt_idx" ON "BlogPost"("isPublished", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SavedLook_userId_savedAt_idx" ON "SavedLook"("userId", "savedAt" DESC);

-- CreateIndex
CREATE INDEX "PriceAlert_userId_isActive_idx" ON "PriceAlert"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PriceAlert_userId_productId_key" ON "PriceAlert"("userId", "productId");

-- CreateIndex
CREATE INDEX "CelebrityFollowAlert_userId_isActive_idx" ON "CelebrityFollowAlert"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CelebrityFollowAlert_userId_celebrityId_key" ON "CelebrityFollowAlert"("userId", "celebrityId");

-- CreateIndex
CREATE INDEX "StorefrontPageView_celebrityId_createdAt_idx" ON "StorefrontPageView"("celebrityId", "createdAt");

-- CreateIndex
CREATE INDEX "BulkOrder_userId_createdAt_idx" ON "BulkOrder"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WeddingOrder_userId_createdAt_idx" ON "WeddingOrder"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CustomizationRequest_userId_createdAt_idx" ON "CustomizationRequest"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLook" ADD CONSTRAINT "SavedLook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CelebrityFollowAlert" ADD CONSTRAINT "CelebrityFollowAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkOrder" ADD CONSTRAINT "BulkOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkOrderItem" ADD CONSTRAINT "BulkOrderItem_bulkOrderId_fkey" FOREIGN KEY ("bulkOrderId") REFERENCES "BulkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingOrder" ADD CONSTRAINT "WeddingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingOrderItem" ADD CONSTRAINT "WeddingOrderItem_weddingOrderId_fkey" FOREIGN KEY ("weddingOrderId") REFERENCES "WeddingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
