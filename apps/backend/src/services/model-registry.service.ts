/**
 * model-registry.service — manages model versions, activation, and rollback.
 *
 * In-memory active model cache avoids per-request DB lookups.
 * Only one model per (name, modelType) combination is ACTIVE at a time.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import type { ModelStatus } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelRegistrationInput {
  name:             string;
  version:          string;
  modelType:        string;
  description?:     string;
  trainingDate?:    Date;
  trainingDataSize?: number;
  metrics?:         Record<string, unknown>;
  hyperparams?:     Record<string, unknown>;
  artifactPath?:    string;
  createdById?:     string;
}

export interface ModelVersion {
  id:              string;
  name:            string;
  version:         string;
  modelType:       string;
  description:     string | null;
  status:          ModelStatus;
  trainingDate:    Date | null;
  trainingDataSize: number | null;
  metrics:         Record<string, unknown>;
  hyperparams:     Record<string, unknown>;
  artifactPath:    string | null;
  createdById:     string | null;
  activatedAt:     Date | null;
  deprecatedAt:    Date | null;
  createdAt:       Date;
  updatedAt:       Date;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const ACTIVE_MODEL_KEY = (modelType: string) => `mlops:active:${modelType}`;
const ACTIVE_TTL = 5 * 60 * 1_000; // 5 min

function invalidateActiveCache(modelType: string) {
  cacheService.del(ACTIVE_MODEL_KEY(modelType));
}

// ── registerModel ─────────────────────────────────────────────────────────────

export async function registerModel(input: ModelRegistrationInput): Promise<ModelVersion> {
  const model = await prisma.modelRegistry.create({
    data: {
      name:             input.name,
      version:          input.version,
      modelType:        input.modelType,
      description:      input.description       ?? null,
      trainingDate:     input.trainingDate       ?? null,
      trainingDataSize: input.trainingDataSize   ?? null,
      metrics:          (input.metrics           ?? {}) as any,
      hyperparams:      (input.hyperparams        ?? {}) as any,
      artifactPath:     input.artifactPath       ?? null,
      createdById:      input.createdById        ?? null,
      status:           "REGISTERED",
    },
  });
  return normalise(model);
}

// ── activateModel ─────────────────────────────────────────────────────────────
// Sets the given model to ACTIVE, deprecates the previous active model.
// PgBouncer-safe: uses array-form transaction.

export async function activateModel(modelId: string): Promise<ModelVersion> {
  const target = await prisma.modelRegistry.findUnique({ where: { id: modelId } });
  if (!target) throw new Error(`Model ${modelId} not found`);
  if (target.status === "ARCHIVED") throw new Error("Cannot activate an ARCHIVED model");

  // Deprecate current active model(s) for this type
  const prevActives = await prisma.modelRegistry.findMany({
    where: { modelType: target.modelType, status: "ACTIVE", id: { not: modelId } },
  });

  const deprecateOps = prevActives.map((m) =>
    prisma.modelRegistry.update({
      where: { id: m.id },
      data:  { status: "DEPRECATED", deprecatedAt: new Date() },
    })
  );

  const activateOp = prisma.modelRegistry.update({
    where: { id: modelId },
    data:  { status: "ACTIVE", activatedAt: new Date() },
  });

  const results = await prisma.$transaction([...deprecateOps, activateOp]);
  const updated = results[results.length - 1] as Awaited<typeof activateOp>;

  invalidateActiveCache(target.modelType);
  return normalise(updated);
}

// ── getActiveModel ────────────────────────────────────────────────────────────

export async function getActiveModel(modelType: string): Promise<ModelVersion | null> {
  const cached = cacheService.get<ModelVersion>(ACTIVE_MODEL_KEY(modelType));
  if (cached) return cached;

  const model = await prisma.modelRegistry.findFirst({
    where:   { modelType, status: "ACTIVE" },
    orderBy: { activatedAt: "desc" },
  });

  if (!model) return null;
  const result = normalise(model);
  cacheService.set(ACTIVE_MODEL_KEY(modelType), result, ACTIVE_TTL);
  return result;
}

// ── getModelVersions ──────────────────────────────────────────────────────────

export async function getModelVersions(name: string): Promise<ModelVersion[]> {
  const models = await prisma.modelRegistry.findMany({
    where:   { name },
    orderBy: { createdAt: "desc" },
  });
  return models.map(normalise);
}

// ── getAllModels ──────────────────────────────────────────────────────────────

export async function getAllModels(): Promise<ModelVersion[]> {
  const models = await prisma.modelRegistry.findMany({
    orderBy: [{ modelType: "asc" }, { createdAt: "desc" }],
  });
  return models.map(normalise);
}

// ── getModelById ──────────────────────────────────────────────────────────────

export async function getModelById(id: string): Promise<ModelVersion | null> {
  const model = await prisma.modelRegistry.findUnique({ where: { id } });
  return model ? normalise(model) : null;
}

// ── deprecateModel ────────────────────────────────────────────────────────────

export async function deprecateModel(modelId: string): Promise<ModelVersion> {
  const model = await prisma.modelRegistry.update({
    where: { id: modelId },
    data:  { status: "DEPRECATED", deprecatedAt: new Date() },
  });
  invalidateActiveCache(model.modelType);
  return normalise(model);
}

// ── rollbackModel ─────────────────────────────────────────────────────────────
// Activates the model that was active immediately before the current active one.

export async function rollbackModel(modelType: string): Promise<{ rolled: ModelVersion | null; restored: ModelVersion }> {
  const current = await prisma.modelRegistry.findFirst({
    where:   { modelType, status: "ACTIVE" },
    orderBy: { activatedAt: "desc" },
  });

  const previous = await prisma.modelRegistry.findFirst({
    where:   { modelType, status: "DEPRECATED" },
    orderBy: { deprecatedAt: "desc" },
  });

  if (!previous) throw new Error(`No previous model to roll back to for type ${modelType}`);

  if (current) {
    const [deprecated, activated] = await prisma.$transaction([
      prisma.modelRegistry.update({
        where: { id: current.id },
        data:  { status: "DEPRECATED", deprecatedAt: new Date() },
      }),
      prisma.modelRegistry.update({
        where: { id: previous.id },
        data:  { status: "ACTIVE", activatedAt: new Date(), deprecatedAt: null },
      }),
    ]);
    invalidateActiveCache(modelType);
    return { rolled: normalise(deprecated), restored: normalise(activated) };
  }

  const [activated] = await prisma.$transaction([
    prisma.modelRegistry.update({
      where: { id: previous.id },
      data:  { status: "ACTIVE", activatedAt: new Date(), deprecatedAt: null },
    }),
  ]);
  invalidateActiveCache(modelType);
  return { rolled: null, restored: normalise(activated) };
}

// ── archiveModel ──────────────────────────────────────────────────────────────

export async function archiveModel(modelId: string): Promise<ModelVersion> {
  const model = await prisma.modelRegistry.update({
    where: { id: modelId },
    data:  { status: "ARCHIVED" },
  });
  invalidateActiveCache(model.modelType);
  return normalise(model);
}

// ── updateModelMetrics ────────────────────────────────────────────────────────

export async function updateModelMetrics(
  modelId: string,
  metrics: Record<string, unknown>,
): Promise<ModelVersion> {
  const model = await prisma.modelRegistry.update({
    where: { id: modelId },
    data:  { metrics: metrics as any },
  });
  return normalise(model);
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normalise(m: any): ModelVersion {
  return {
    id:              m.id,
    name:            m.name,
    version:         m.version,
    modelType:       m.modelType,
    description:     m.description,
    status:          m.status,
    trainingDate:    m.trainingDate,
    trainingDataSize: m.trainingDataSize,
    metrics:         (m.metrics   as Record<string, unknown>) ?? {},
    hyperparams:     (m.hyperparams as Record<string, unknown>) ?? {},
    artifactPath:    m.artifactPath,
    createdById:     m.createdById,
    activatedAt:     m.activatedAt,
    deprecatedAt:    m.deprecatedAt,
    createdAt:       m.createdAt,
    updatedAt:       m.updatedAt,
  };
}
