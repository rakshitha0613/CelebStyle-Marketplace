-- CreateTable
CREATE TABLE "CelebrityRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "celebrityId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CelebrityRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CelebrityRating_celebrityId_idx" ON "CelebrityRating"("celebrityId");

-- CreateIndex
CREATE UNIQUE INDEX "CelebrityRating_userId_celebrityId_key" ON "CelebrityRating"("userId", "celebrityId");

-- AddForeignKey
ALTER TABLE "CelebrityRating" ADD CONSTRAINT "CelebrityRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CelebrityRating" ADD CONSTRAINT "CelebrityRating_celebrityId_fkey" FOREIGN KEY ("celebrityId") REFERENCES "Celebrity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
