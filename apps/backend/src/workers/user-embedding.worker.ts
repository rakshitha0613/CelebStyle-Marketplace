/**
 * UserEmbeddingWorker — refreshes a user's embedding from their feature store.
 *
 * Converts the user's affinity maps into a text description, embeds it
 * using the EmbeddingService (OpenAI or deterministic fallback), and
 * upserts the result into UserEmbedding.
 *
 * BullMQ-ready: data = { userId } matches BullMQ job.data shape.
 */

import { prisma } from "../lib/prisma.js";
import { embeddingService } from "../lib/embedding.service.js";
import { upsertUserEmbedding } from "../lib/vector.db.js";
import { getUserFeatures, refreshUserFeatures } from "../services/feature.service.js";

export interface UserEmbeddingWorkerData {
  userId: string;
}

export interface UserEmbeddingResult {
  userId:       string;
  signalCount:  number;
  provider:     string;
  modelVersion: string;
}

function featuresToText(features: Awaited<ReturnType<typeof getUserFeatures>>): string {
  if (!features) return "";

  const parts: string[] = [];

  // Top categories
  const topCategories = Object.entries(features.categoryAffinity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k);
  if (topCategories.length) parts.push(`prefers ${topCategories.join(" ")}`);

  // Top occasions
  const topOccasions = Object.entries(features.occasionPreference)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);
  if (topOccasions.length) parts.push(`occasion ${topOccasions.join(" ")}`);

  // Top colours
  const topColors = Object.entries(features.colorPreference)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => k);
  if (topColors.length) parts.push(`color ${topColors.join(" ")}`);

  // Search terms (top 5)
  const topSearches = Object.entries(features.searchAffinity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k);
  if (topSearches.length) parts.push(topSearches.join(" "));

  // Wishlist + cart categories
  const wishCats = Object.entries(features.wishlistAffinity).slice(0, 3).map(([k]) => k);
  if (wishCats.length) parts.push(`wishlist ${wishCats.join(" ")}`);

  // Price signal
  const { avg } = features.pricePreference;
  if (avg > 0) {
    const band = avg < 100_000 ? "budget" : avg < 500_000 ? "midrange" : "premium";
    parts.push(`price ${band}`);
  }

  return parts.filter(Boolean).join(" ");
}

export const userEmbeddingWorker = {
  name: "user-embedding",

  async run(data: UserEmbeddingWorkerData): Promise<UserEmbeddingResult> {
    const { userId } = data;

    // Get existing features or compute fresh
    let features = await getUserFeatures(userId);
    if (!features) features = await refreshUserFeatures(userId);

    const text        = featuresToText(features);
    const signalCount = Object.values(features.categoryAffinity).reduce((s, v) => s + v, 0)
      + features.purchaseFrequency * 10;

    const embedding = text
      ? await embeddingService.embed(text)
      : new Array<number>(embeddingService.dimensions).fill(0);

    await upsertUserEmbedding(userId, embedding, embeddingService.modelVersion, Math.round(signalCount));

    return {
      userId,
      signalCount: Math.round(signalCount),
      provider:    embeddingService.provider,
      modelVersion: embeddingService.modelVersion,
    };
  },
};
