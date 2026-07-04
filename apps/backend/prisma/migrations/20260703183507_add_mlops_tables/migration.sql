-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('REGISTERED', 'VALIDATING', 'ACTIVE', 'SHADOW', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeploymentType" AS ENUM ('BLUE_GREEN', 'CANARY', 'SHADOW', 'PINNED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('ACTIVE', 'ROLLED_BACK', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "ModelRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModelStatus" NOT NULL DEFAULT 'REGISTERED',
    "trainingDate" TIMESTAMP(3),
    "trainingDataSize" INTEGER,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "hyperparams" JSONB NOT NULL DEFAULT '{}',
    "artifactPath" TEXT,
    "createdById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelDeployment" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "deploymentType" "DeploymentType" NOT NULL DEFAULT 'BLUE_GREEN',
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" "DeploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "trafficPercent" INTEGER NOT NULL DEFAULT 100,
    "pinnedVersion" TEXT,
    "previousModelId" TEXT,
    "deployedById" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionLog" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "requestId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "context" TEXT NOT NULL,
    "topN" JSONB NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "experimentId" TEXT,
    "variant" TEXT,
    "outcomeClicked" BOOLEAN,
    "outcomePurchased" BOOLEAN,
    "feedbackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureSnapshot" (
    "id" TEXT NOT NULL,
    "featureType" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleSize" INTEGER NOT NULL,
    "mean" DOUBLE PRECISION NOT NULL,
    "stddev" DOUBLE PRECISION NOT NULL,
    "min" DOUBLE PRECISION NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "p25" DOUBLE PRECISION NOT NULL,
    "p50" DOUBLE PRECISION NOT NULL,
    "p75" DOUBLE PRECISION NOT NULL,
    "p95" DOUBLE PRECISION NOT NULL,
    "distribution" JSONB NOT NULL,

    CONSTRAINT "FeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLOpsAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLOpsAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelRegistry_name_status_idx" ON "ModelRegistry"("name", "status");

-- CreateIndex
CREATE INDEX "ModelRegistry_modelType_status_idx" ON "ModelRegistry"("modelType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRegistry_name_version_key" ON "ModelRegistry"("name", "version");

-- CreateIndex
CREATE INDEX "ModelDeployment_environment_status_idx" ON "ModelDeployment"("environment", "status");

-- CreateIndex
CREATE INDEX "ModelDeployment_deployedAt_idx" ON "ModelDeployment"("deployedAt");

-- CreateIndex
CREATE INDEX "PredictionLog_modelId_createdAt_idx" ON "PredictionLog"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionLog_context_createdAt_idx" ON "PredictionLog"("context", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionLog_createdAt_idx" ON "PredictionLog"("createdAt");

-- CreateIndex
CREATE INDEX "PredictionLog_requestId_idx" ON "PredictionLog"("requestId");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_featureType_snapshotAt_idx" ON "FeatureSnapshot"("featureType", "snapshotAt");

-- CreateIndex
CREATE INDEX "MLOpsAlert_alertType_isResolved_idx" ON "MLOpsAlert"("alertType", "isResolved");

-- CreateIndex
CREATE INDEX "MLOpsAlert_severity_isResolved_idx" ON "MLOpsAlert"("severity", "isResolved");

-- CreateIndex
CREATE INDEX "MLOpsAlert_createdAt_idx" ON "MLOpsAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "ModelDeployment" ADD CONSTRAINT "ModelDeployment_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionLog" ADD CONSTRAINT "PredictionLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
