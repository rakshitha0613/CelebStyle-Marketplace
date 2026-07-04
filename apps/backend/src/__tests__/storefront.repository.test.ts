/**
 * Phase B.5 — Storefront Repository Integration Tests
 *
 * Runs against the real Supabase database.
 * Seeded storefronts (4): shah-rukh-khan, deepika-padukone,
 *                          priyanka-chopra, amitabh-bachchan
 *
 * Test storefront created for: alia-bhatt (no seeded storefront)
 * Cleaned up in the final step.
 */

import { prisma } from "../lib/prisma.js";
import { storefrontRepository } from "../repositories/storefront.repository.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Test suite ─────────────────────────────────────────────────────────────────
async function run() {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║   Phase B.5 — Storefront Repository Tests ║");
  console.log("╚════════════════════════════════════════════╝\n");

  // ── 1. findAll — baseline seeded storefronts ───────────────────────────────
  console.log("── findAll (seeded baseline) ──────────────────────────────────");
  const all = await storefrontRepository.findAll();
  assert(Array.isArray(all), "findAll returns an array");
  assert(all.length >= 4, `findAll returns at least 4 storefronts (got ${all.length})`);

  const srkStorefront = all.find((s) => s.celebrityId === "shah-rukh-khan");
  assert(srkStorefront !== undefined, "shah-rukh-khan storefront present");
  assertEq(srkStorefront!.displayName, "Shah Rukh Khan", "SRK displayName");
  assertEq(srkStorefront!.verified, true, "SRK verified = true");
  assert(srkStorefront!.message.length > 0, "SRK message is non-empty");
  assert(Array.isArray(srkStorefront!.featuredOutfitIds), "SRK featuredOutfitIds is array");
  assert(srkStorefront!.featuredOutfitIds.length > 0, "SRK has featured outfits");
  assert(
    srkStorefront!.featuredOutfitIds.every((id) => typeof id === "string"),
    "all featuredOutfitIds are strings"
  );

  const deepikaStorefront = all.find((s) => s.celebrityId === "deepika-padukone");
  assert(deepikaStorefront !== undefined, "deepika-padukone storefront present");
  assertEq(deepikaStorefront!.verified, true, "Deepika verified = true");

  const pcStorefront = all.find((s) => s.celebrityId === "priyanka-chopra");
  assert(pcStorefront !== undefined, "priyanka-chopra storefront present");

  const abStorefront = all.find((s) => s.celebrityId === "amitabh-bachchan");
  assert(abStorefront !== undefined, "amitabh-bachchan storefront present");

  // Every entry must have the required shape
  for (const sf of all) {
    assert(typeof sf.celebrityId === "string" && sf.celebrityId.length > 0, `${sf.celebrityId}: id is string`);
    assert(typeof sf.displayName === "string", `${sf.celebrityId}: displayName is string`);
    assert(typeof sf.bannerImage === "string", `${sf.celebrityId}: bannerImage is string`);
    assert(Array.isArray(sf.featuredOutfitIds), `${sf.celebrityId}: featuredOutfitIds is array`);
    assert(typeof sf.message === "string", `${sf.celebrityId}: message is string`);
    assert(typeof sf.verified === "boolean", `${sf.celebrityId}: verified is boolean`);
  }

  // ── 2. findByCelebritySlug — known storefront ──────────────────────────────
  console.log("\n── findByCelebritySlug — known ────────────────────────────────");
  const found = await storefrontRepository.findByCelebritySlug("shah-rukh-khan");
  assert(found !== null, "findByCelebritySlug returns storefront for SRK");
  assertEq(found!.celebrityId, "shah-rukh-khan", "found.celebrityId = shah-rukh-khan");
  assertEq(found!.displayName, "Shah Rukh Khan", "found.displayName matches");
  assertEq(found!.verified, true, "found.verified = true");
  assert(found!.featuredOutfitIds.length > 0, "found.featuredOutfitIds non-empty");
  assert(
    found!.featuredOutfitIds[0].startsWith("look-shah-rukh-khan"),
    "first featured outfit belongs to SRK"
  );

  // ── 3. findByCelebritySlug — unknown ──────────────────────────────────────
  console.log("\n── findByCelebritySlug — unknown ──────────────────────────────");
  const notFound = await storefrontRepository.findByCelebritySlug("no-such-celebrity");
  assert(notFound === null, "findByCelebritySlug returns null for unknown slug");

  // ── 4. upsert — create new storefront ─────────────────────────────────────
  console.log("\n── upsert — create new storefront ─────────────────────────────");
  const createResult = await storefrontRepository.upsert({
    celebrityId: "alia-bhatt",
    displayName: "Alia Bhatt Official",
    bannerImage: "https://example.com/alia-banner.jpg",
    featuredOutfitIds: ["look-alia-bhatt-gangubai"],
    message: "Alia's curated looks.",
    verified: true,
  });

  assert(createResult !== null, "upsert create returns a result");
  assertEq(createResult!.created, true, "created = true on first upsert");
  assertEq(createResult!.entry.celebrityId, "alia-bhatt", "entry.celebrityId = alia-bhatt");
  assertEq(createResult!.entry.displayName, "Alia Bhatt Official", "entry.displayName");
  assertEq(createResult!.entry.bannerImage, "https://example.com/alia-banner.jpg", "entry.bannerImage");
  assertEq(createResult!.entry.message, "Alia's curated looks.", "entry.message");
  assertEq(createResult!.entry.verified, true, "entry.verified = true");
  assertEq(createResult!.entry.featuredOutfitIds.length, 1, "featuredOutfitIds.length = 1");
  assertEq(
    createResult!.entry.featuredOutfitIds[0],
    "look-alia-bhatt-gangubai",
    "featuredOutfitIds[0] = Gangubai slug"
  );

  // ── 5. upsert — update existing storefront ────────────────────────────────
  console.log("\n── upsert — update existing storefront ────────────────────────");
  const updateResult = await storefrontRepository.upsert({
    celebrityId: "alia-bhatt",
    displayName: "Alia Bhatt — Updated",
    bannerImage: "https://example.com/alia-banner-v2.jpg",
    featuredOutfitIds: [], // clear featured
    message: "Updated message.",
    verified: false,
  });

  assert(updateResult !== null, "upsert update returns a result");
  assertEq(updateResult!.created, false, "created = false on second upsert");
  assertEq(updateResult!.entry.displayName, "Alia Bhatt — Updated", "updated displayName");
  assertEq(updateResult!.entry.bannerImage, "https://example.com/alia-banner-v2.jpg", "updated bannerImage");
  assertEq(updateResult!.entry.message, "Updated message.", "updated message");
  assertEq(updateResult!.entry.verified, false, "updated verified = false");
  assertEq(updateResult!.entry.featuredOutfitIds.length, 0, "featured cleared to 0");

  // ── 6. findAll includes the newly created storefront ──────────────────────
  console.log("\n── findAll after create ───────────────────────────────────────");
  const allAfter = await storefrontRepository.findAll();
  assert(allAfter.length >= 5, `findAll now has ≥ 5 storefronts (got ${allAfter.length})`);
  const aliaSf = allAfter.find((s) => s.celebrityId === "alia-bhatt");
  assert(aliaSf !== undefined, "alia-bhatt storefront appears in findAll");

  // ── 7. upsert — replace featured products with multiple slugs ─────────────
  console.log("\n── upsert — replace featured products ─────────────────────────");
  const multiResult = await storefrontRepository.upsert({
    celebrityId: "shah-rukh-khan",
    displayName: "Shah Rukh Khan",
    featuredOutfitIds: ["look-shah-rukh-khan-red-carpet", "look-shah-rukh-khan-jawan"],
    message: "SRK updated",
    verified: true,
  });

  assert(multiResult !== null, "upsert returns result for SRK");
  assertEq(multiResult!.created, false, "SRK created = false (existing)");
  assertEq(multiResult!.entry.featuredOutfitIds.length, 2, "featured count = 2");
  assertEq(
    multiResult!.entry.featuredOutfitIds[0],
    "look-shah-rukh-khan-red-carpet",
    "first featured = red-carpet"
  );
  assertEq(
    multiResult!.entry.featuredOutfitIds[1],
    "look-shah-rukh-khan-jawan",
    "second featured = jawan"
  );

  // ── 8. upsert — sortOrder preserved after replacement ─────────────────────
  console.log("\n── upsert — sortOrder preserved ────────────────────────────────");
  const reverseResult = await storefrontRepository.upsert({
    celebrityId: "shah-rukh-khan",
    displayName: "Shah Rukh Khan",
    featuredOutfitIds: ["look-shah-rukh-khan-jawan", "look-shah-rukh-khan-red-carpet"],
    message: "SRK reverse order",
    verified: true,
  });
  assertEq(
    reverseResult!.entry.featuredOutfitIds[0],
    "look-shah-rukh-khan-jawan",
    "sortOrder[0] = jawan after reversal"
  );
  assertEq(
    reverseResult!.entry.featuredOutfitIds[1],
    "look-shah-rukh-khan-red-carpet",
    "sortOrder[1] = red-carpet after reversal"
  );

  // ── 9. upsert — unknown celebrity returns null ────────────────────────────
  console.log("\n── upsert — unknown celebrity ──────────────────────────────────");
  const unknownResult = await storefrontRepository.upsert({
    celebrityId: "no-such-celebrity",
    displayName: "Ghost",
    featuredOutfitIds: [],
    message: "",
    verified: false,
  });
  assert(unknownResult === null, "upsert returns null for unknown celebrity");

  // ── 10. commission — structure and types ──────────────────────────────────
  console.log("\n── commission — structure ──────────────────────────────────────");
  const summary = await storefrontRepository.commission();
  assert(typeof summary === "object" && summary !== null, "commission returns an object");
  assert(typeof summary.orders === "number", "summary.orders is number");
  assert(typeof summary.gross === "number", "summary.gross is number");
  assert(typeof summary.platformFee === "number", "summary.platformFee is number");
  assert(typeof summary.celebrityCommission === "number", "summary.celebrityCommission is number");
  assert(typeof summary.manufacturerShare === "number", "summary.manufacturerShare is number");
  assert(typeof summary.paid === "number", "summary.paid is number");
  assert(summary.orders >= 0, "orders ≥ 0");
  assert(summary.gross >= 0, "gross ≥ 0");
  assert(summary.platformFee >= 0, "platformFee ≥ 0");
  assert(summary.celebrityCommission >= 0, "celebrityCommission ≥ 0");
  assert(summary.manufacturerShare >= 0, "manufacturerShare ≥ 0");
  assert(summary.paid >= 0, "paid ≥ 0");

  // ── 11. commission — consistency with DB ──────────────────────────────────
  console.log("\n── commission — consistency with DB ────────────────────────────");
  const dbOrderCount = await prisma.order.count();
  assertEq(summary.orders, dbOrderCount, "commission.orders matches DB order count");

  const dbCommission = await prisma.orderCommission.aggregate({
    _sum: { platformFee: true, celebrityCommission: true, manufacturerShare: true },
  });
  assertEq(
    summary.platformFee,
    dbCommission._sum.platformFee ?? 0,
    "commission.platformFee matches DB aggregate"
  );
  assertEq(
    summary.celebrityCommission,
    dbCommission._sum.celebrityCommission ?? 0,
    "commission.celebrityCommission matches DB aggregate"
  );

  const dbPaid = await prisma.order.aggregate({
    where: { paymentStatus: "CAPTURED" },
    _sum: { total: true },
  });
  assertEq(
    summary.paid,
    dbPaid._sum.total ?? 0,
    "commission.paid matches DB CAPTURED total"
  );

  // ── 12. DB persistence check for created storefront ───────────────────────
  console.log("\n── DB persistence check ────────────────────────────────────────");
  const dbSf = await prisma.storefront.findFirst({
    where: { celebrity: { slug: "alia-bhatt" } },
    include: {
      celebrity: { select: { slug: true } },
      featuredProducts: true,
    },
  });
  assert(dbSf !== null, "alia-bhatt storefront exists in DB");
  assertEq(dbSf!.celebrity.slug, "alia-bhatt", "DB celebrity.slug = alia-bhatt");
  assertEq(dbSf!.displayName, "Alia Bhatt — Updated", "DB displayName = updated value");
  assertEq(dbSf!.verified, false, "DB verified = false after update");
  assertEq(dbSf!.featuredProducts.length, 0, "DB featuredProducts cleared");

  // ── 13. Restore SRK storefront to seeded state ────────────────────────────
  console.log("\n── restore SRK storefront ──────────────────────────────────────");
  await storefrontRepository.upsert({
    celebrityId: "shah-rukh-khan",
    displayName: "Shah Rukh Khan",
    bannerImage: srkStorefront!.bannerImage,
    featuredOutfitIds: srkStorefront!.featuredOutfitIds,
    message: srkStorefront!.message,
    verified: true,
  });
  const restoredSrk = await storefrontRepository.findByCelebritySlug("shah-rukh-khan");
  assert(restoredSrk !== null, "SRK storefront restored");
  assert(restoredSrk!.featuredOutfitIds.length > 0, "SRK featured outfits restored");
  console.log(`  (SRK restored with ${restoredSrk!.featuredOutfitIds.length} featured outfits)`);

  // ── 14. Cleanup ───────────────────────────────────────────────────────────
  console.log("\n── cleanup ────────────────────────────────────────────────────");
  const deleted = await prisma.storefront.deleteMany({
    where: { celebrity: { slug: "alia-bhatt" } },
  });
  assert(deleted.count === 1, `Cleaned up ${deleted.count} test storefront`);
  console.log(`  (deleted ${deleted.count} test storefronts)`);

  // ── Results ───────────────────────────────────────────────────────────────
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
