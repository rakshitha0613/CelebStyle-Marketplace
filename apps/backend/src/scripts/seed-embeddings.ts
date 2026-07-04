/**
 * seed-embeddings — generate and store product embeddings for all published products.
 *
 * Idempotent: skips products that already have embeddings.
 * Rate-limits if using OpenAI provider (100ms delay per 10 requests).
 *
 * Usage: npm run seed:embeddings
 */

import { prisma } from "../lib/prisma.js";
import { embeddingService } from "../lib/embedding.service.js";
import { upsertProductEmbedding, hasProductEmbedding } from "../lib/vector.db.js";

const RATE_LIMIT_BATCH = 10;
const RATE_LIMIT_DELAY_MS = 100;

async function delay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`[seed-embeddings] provider = ${embeddingService.provider}`);

  const products = await prisma.product.findMany({
    where: { isPublished: true, deletedAt: null },
    include: {
      celebrity: {
        include: { profile: true },
      },
      tags: { include: { tag: true } },
    },
  });

  console.log(`[seed-embeddings] found ${products.length} published products`);

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    if (await hasProductEmbedding(product.id)) {
      skipped++;
      continue;
    }

    try {
      const text = embeddingService.productText({
        category:       product.category,
        occasion:       product.occasion,
        colorPalette:   product.colorPalette ?? undefined,
        movieName:      product.movieName ?? undefined,
        characterName:  product.characterName ?? undefined,
        fabricDetails:  product.fabricDetails ?? undefined,
        description:    product.description ?? undefined,
        celebrity: product.celebrity
          ? {
              name:    product.celebrity.name,
              profile: { styleTags: product.celebrity.profile?.styleTags ?? [] },
            }
          : undefined,
        tags: product.tags as Array<{ tag: { name: string } }>,
      });

      const embedding = await embeddingService.embed(text);

      await upsertProductEmbedding(
        product.id,
        embedding,
        embeddingService.modelVersion,
        embedding.length
      );

      seeded++;
      process.stdout.write(`  ✓ [${i + 1}/${products.length}] ${product.slug}\n`);

      // Rate-limit for OpenAI to avoid hitting per-minute token caps
      if (embeddingService.provider === "openai" && seeded % RATE_LIMIT_BATCH === 0) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ [${i + 1}/${products.length}] ${product.slug}:`, (err as Error).message);
    }
  }

  console.log(
    `\n[seed-embeddings] done — seeded: ${seeded}, skipped: ${skipped}, failed: ${failed}`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed-embeddings] fatal:", err);
  process.exit(1);
});
