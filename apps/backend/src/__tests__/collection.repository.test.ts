/**
 * Collection Repository Integration Tests
 *
 * Assumes `npm run seed` has already run — verifies the 6 derived
 * collections (festive-edit, luxury-atelier, cinematic-icons, wedding-edit,
 * red-carpet-icons, power-dressing) seeded from apps/backend/src/data/collections.ts.
 */

import { collectionRepository } from "../repositories/collection.repository.js";
import { COLLECTION_DEFINITIONS } from "../data/collections.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)})`);
}

async function run() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   Collection Repository Tests               ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log("── findAll — seeded collections ─────────────────────────────────");
  const all = await collectionRepository.findAll();
  assert(Array.isArray(all), "findAll returns an array");
  assertEq(all.length, COLLECTION_DEFINITIONS.length, `findAll returns ${COLLECTION_DEFINITIONS.length} collections`);

  for (const def of COLLECTION_DEFINITIONS) {
    const entry = all.find((c) => c.id === def.slug);
    assert(entry !== undefined, `${def.slug} present in findAll`);
    if (!entry) continue;
    assertEq(entry.name, def.name, `${def.slug}: name matches`);
    assertEq(entry.coverImageUrl, def.coverImageUrl, `${def.slug}: coverImageUrl matches`);
    assert(Array.isArray(entry.outfitIds), `${def.slug}: outfitIds is array`);
    assert(entry.outfitIds.every((id) => typeof id === "string"), `${def.slug}: all outfitIds are strings`);
  }

  console.log("\n── findBySlug — known collection ────────────────────────────────");
  const festive = await collectionRepository.findBySlug("festive-edit");
  assert(festive !== null, "findBySlug returns festive-edit");
  assert(
    festive!.outfitIds.every((id) => id.startsWith("look-festive-")),
    "every festive-edit outfit id starts with look-festive-"
  );
  assert(festive!.outfitIds.length > 0, "festive-edit has at least one outfit");

  const luxury = await collectionRepository.findBySlug("luxury-atelier");
  assert(luxury !== null, "findBySlug returns luxury-atelier");
  assert(
    luxury!.outfitIds.every((id) => id.startsWith("look-luxury-")),
    "every luxury-atelier outfit id starts with look-luxury-"
  );

  console.log("\n── findBySlug — unknown ─────────────────────────────────────────");
  const notFound = await collectionRepository.findBySlug("no-such-collection");
  assert(notFound === null, "findBySlug returns null for unknown slug");

  console.log("\n── cross-collection sanity ──────────────────────────────────────");
  const cinematic = await collectionRepository.findBySlug("cinematic-icons");
  assert(cinematic !== null, "findBySlug returns cinematic-icons");
  assert(
    cinematic!.outfitIds.every((id) => !id.startsWith("look-festive-") && !id.startsWith("look-luxury-")),
    "cinematic-icons excludes festive/luxury ids"
  );

  console.log("\n── Results ────────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("─".repeat(58) + "\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
