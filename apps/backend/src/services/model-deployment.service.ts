/**
 * model-deployment.service — manages blue/green, canary, shadow, and pinned
 * deployments. One ACTIVE deployment per environment at a time.
 *
 * PgBouncer-safe: no interactive transactions.
 */

import { prisma } from "../lib/prisma.js";
import type { DeploymentType, DeploymentStatus } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeploymentRecord {
  id:             string;
  modelId:        string;
  deploymentType: DeploymentType;
  environment:    string;
  status:         DeploymentStatus;
  trafficPercent: number;
  pinnedVersion:  string | null;
  previousModelId: string | null;
  deployedById:   string | null;
  deployedAt:     Date;
  rolledBackAt:   Date | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface DeployOptions {
  deploymentType?: DeploymentType;
  environment?:    string;
  trafficPercent?: number;    // for canary (1-99)
  pinnedVersion?:  string;    // for pinned deployment
  deployedById?:   string;
}

// ── deployModel ───────────────────────────────────────────────────────────────
// Supersedes any currently ACTIVE deployment in the same environment.

export async function deployModel(
  modelId:  string,
  options?: DeployOptions,
): Promise<DeploymentRecord> {
  const env        = options?.environment   ?? "production";
  const type       = options?.deploymentType ?? "BLUE_GREEN";
  const traffic    = options?.trafficPercent ?? 100;

  // Find previous ACTIVE deployment for rollback linkage
  const prev = await prisma.modelDeployment.findFirst({
    where:   { environment: env, status: "ACTIVE" },
    orderBy: { deployedAt: "desc" },
  });

  // Supersede previous deployments
  if (prev) {
    await prisma.modelDeployment.updateMany({
      where: { environment: env, status: "ACTIVE" },
      data:  { status: "SUPERSEDED", updatedAt: new Date() },
    });
  }

  const deployment = await prisma.modelDeployment.create({
    data: {
      modelId,
      deploymentType:  type,
      environment:     env,
      status:          "ACTIVE",
      trafficPercent:  type === "CANARY" ? Math.min(Math.max(traffic, 1), 99) : 100,
      pinnedVersion:   options?.pinnedVersion  ?? null,
      previousModelId: prev?.modelId            ?? null,
      deployedById:    options?.deployedById    ?? null,
    },
  });

  return normalise(deployment);
}

// ── canaryDeploy ──────────────────────────────────────────────────────────────

export async function canaryDeploy(
  modelId:       string,
  trafficPercent: number,
  options?:      Omit<DeployOptions, "deploymentType" | "trafficPercent">,
): Promise<DeploymentRecord> {
  return deployModel(modelId, { ...options, deploymentType: "CANARY", trafficPercent });
}

// ── pinVersion ────────────────────────────────────────────────────────────────

export async function pinVersion(
  modelId:  string,
  version:  string,
  options?: Omit<DeployOptions, "deploymentType" | "pinnedVersion">,
): Promise<DeploymentRecord> {
  return deployModel(modelId, { ...options, deploymentType: "PINNED", pinnedVersion: version });
}

// ── rollback ──────────────────────────────────────────────────────────────────
// Reverts to the previousModelId recorded in the most recent SUPERSEDED deployment.

export async function rollbackDeployment(
  environment = "production",
  deployedById?: string,
): Promise<DeploymentRecord> {
  // The ACTIVE deployment records which model it replaced in previousModelId
  const current = await prisma.modelDeployment.findFirst({
    where:   { environment, status: "ACTIVE" },
    orderBy: { deployedAt: "desc" },
  });

  if (!current?.previousModelId) {
    throw new Error("No previous deployment to roll back to");
  }

  // Mark current ACTIVE as ROLLED_BACK
  await prisma.modelDeployment.update({
    where: { id: current.id },
    data:  { status: "ROLLED_BACK", rolledBackAt: new Date(), updatedAt: new Date() },
  });

  // Create a new ACTIVE deployment from the previous model
  const restored = await prisma.modelDeployment.create({
    data: {
      modelId:        current.previousModelId,
      deploymentType: "BLUE_GREEN",
      environment,
      status:         "ACTIVE",
      trafficPercent: 100,
      previousModelId: current.modelId,
      deployedById:   deployedById ?? null,
    },
  });

  return normalise(restored);
}

// ── getActiveDeployment ───────────────────────────────────────────────────────

export async function getActiveDeployment(environment = "production"): Promise<DeploymentRecord | null> {
  const dep = await prisma.modelDeployment.findFirst({
    where:   { environment, status: "ACTIVE" },
    orderBy: { deployedAt: "desc" },
  });
  return dep ? normalise(dep) : null;
}

// ── getDeploymentHistory ──────────────────────────────────────────────────────

export async function getDeploymentHistory(environment = "production", limit = 20): Promise<DeploymentRecord[]> {
  const rows = await prisma.modelDeployment.findMany({
    where:   { environment },
    orderBy: { deployedAt: "desc" },
    take:    limit,
  });
  return rows.map(normalise);
}

// ── Normaliser ────────────────────────────────────────────────────────────────

function normalise(d: any): DeploymentRecord {
  return {
    id:             d.id,
    modelId:        d.modelId,
    deploymentType: d.deploymentType,
    environment:    d.environment,
    status:         d.status,
    trafficPercent: d.trafficPercent,
    pinnedVersion:  d.pinnedVersion,
    previousModelId: d.previousModelId,
    deployedById:   d.deployedById,
    deployedAt:     d.deployedAt,
    rolledBackAt:   d.rolledBackAt,
    createdAt:      d.createdAt,
    updatedAt:      d.updatedAt,
  };
}
