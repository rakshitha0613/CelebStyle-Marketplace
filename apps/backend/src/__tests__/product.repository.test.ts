/**
 * Phase B.3 — Product Repository Tests
 *
 * Verifies:
 *   - findAll: shape, count, occasion display strings, soft-delete exclusion
 *   - findBySlug: known records, manufacturer/image arrays, not-found, soft-delete
 *   - create: full round-trip including images and manufacturer links
 *   - update: scalar fields, occasion enum mapping, image rebuild, manufacturer rebuild
 *   - delete: soft-delete visibility, isActive/deletedAt, idempotency
 *
 * Run: npm run test:product   (from apps/backend/)
 *
 * NOTE: This test creates additional Product rows in the DB. Run npm run seed
 * to restore the canonical 35-record state before running test:integration.
 */
import { PrismaClient } from "@prisma/client";
import { productRepository } from "../repositories/product.repository.js";

const client = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
  log: ["error"],
});

// ── Assertion helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert(
    actual === expected,
    label,
    `expected ${String(expected)}, got ${String(actual)}`
  );
}

// ── Unique test slug to avoid collisions with seeded data ──────────────────────

const TS = Date.now();
const TEST_SLUG  = `test-product-${TS}`;
const TEST_SLUG2 = `test-product-multi-${TS}`;
const TEST_SLUG3 = `test-product-nodels-${TS}`;
const TEST_SLUG4 = `test-product-del-${TS}`;

// ── Suite: findAll ─────────────────────────────────────────────────────────────

async function testFindAll() {
  console.log("\n── findAll ────────────────────────────────────────────────");

  const all = await productRepository.findAll();

  assert(Array.isArray(all), "findAll returns an array");
  assert(all.length >= 35, `findAll has at least 35 seeded records (got ${all.length})`);

  // Shape check on first known record
  const srk = all.find((o) => o.id === "look-shah-rukh-khan-red-carpet");
  assert(srk !== undefined, "look-shah-rukh-khan-red-carpet present in findAll");
  if (srk) {
    assert(typeof srk.id           === "string" && srk.id.length > 0,  "id is non-empty string");
    assert(typeof srk.celebrityId  === "string" && srk.celebrityId.length > 0, "celebrityId is non-empty string");
    assert(typeof srk.movieName    === "string", "movieName is string");
    assert(typeof srk.occasion     === "string", "occasion is string");
    assert(typeof srk.category     === "string", "category is string");
    assert(typeof srk.price        === "number", "price is a JS number");
    assert(typeof srk.imageUrl     === "string", "imageUrl is string");
    assert(Array.isArray(srk.images),            "images is array");
    assert(Array.isArray(srk.manufacturerIds),   "manufacturerIds is array");
  }

  // Occasion values must be display strings, not DB enums
  const occasions = [...new Set(all.map((o) => o.occasion))];
  assert(
    occasions.every((occ) => occ === occ[0]?.toUpperCase() + occ.slice(1).toLowerCase() || occ === occ),
    "occasion values are display strings (title-case), not uppercase enums"
  );
  assert(
    !occasions.some((occ) => occ === occ.toUpperCase() && occ.length > 1 && occ !== "OTT"),
    "no occasion value is all-caps DB enum (e.g. PARTY)"
  );

  // Celebrity ID is a slug, not a cuid
  if (srk) {
    assert(
      srk.celebrityId === "shah-rukh-khan",
      "celebrityId is celebrity slug, not internal cuid"
    );
  }
}

// ── Suite: findBySlug ──────────────────────────────────────────────────────────

async function testFindBySlug() {
  console.log("\n── findBySlug ─────────────────────────────────────────────");

  // SRK red carpet — full field verification
  const srk = await productRepository.findBySlug("look-shah-rukh-khan-red-carpet");
  assert(srk !== null,                          "look-shah-rukh-khan-red-carpet found");
  if (srk) {
    assertEq(srk.id,           "look-shah-rukh-khan-red-carpet", "id = slug");
    assertEq(srk.celebrityId,  "shah-rukh-khan",                 "celebrityId = celebrity slug");
    assertEq(srk.movieName,    "Pathaan",                         "movieName correct");
    assertEq(srk.occasion,     "Party",                           "occasion = 'Party' (display string)");
    assertEq(srk.category,     "Bandhgala",                       "category correct");
    assertEq(srk.price,        28999,                             "price = 28999");
    assertEq(srk.year,         2023,                              "year = 2023");
    assertEq(srk.characterName, "Pathaan / Vikram",               "characterName correct");
    assert(srk.colorPalette.length > 0,                           "colorPalette non-empty");
    assert(srk.imageUrl.length > 0,                               "imageUrl non-empty");
    assert(srk.images.length === 5,                               `images array has 5 items (got ${srk.images.length})`);
    assert(srk.images.every((url) => typeof url === "string" && url.length > 0), "all image URLs are non-empty strings");
    assertEq(srk.manufacturerIds.length, 1,                       "manufacturerIds has 1 entry");
    assertEq(srk.manufacturerIds[0], "mfr-tarun-tahiliani",       "manufacturer = mfr-tarun-tahiliani");
  }

  // Alia Bhatt — Gangubai (Festival occasion, Sabyasachi)
  const gangubai = await productRepository.findBySlug("look-alia-bhatt-gangubai");
  assert(gangubai !== null,                       "look-alia-bhatt-gangubai found");
  if (gangubai) {
    assertEq(gangubai.occasion,          "Festival",       "gangubai occasion = 'Festival'");
    assertEq(gangubai.manufacturerIds[0], "mfr-sabyasachi", "gangubai manufacturer = mfr-sabyasachi");
    assertEq(gangubai.images.length,     4,                 `gangubai has 4 images (got ${gangubai.images.length})`);
  }

  // Priyanka Chopra party — 2 manufacturers, ordered by priority
  const pc = await productRepository.findBySlug("look-priyanka-chopra-party");
  assert(pc !== null,                              "look-priyanka-chopra-party found");
  if (pc) {
    assertEq(pc.manufacturerIds.length,  2,                      "pc-party has 2 manufacturer IDs");
    assertEq(pc.manufacturerIds[0],      "mfr-manish-malhotra",  "primary manufacturer correct");
    assertEq(pc.manufacturerIds[1],      "mfr-tarun-tahiliani",  "secondary manufacturer correct");
  }

  // Deepika wedding — Wedding occasion
  const dp = await productRepository.findBySlug("look-deepika-padukone-wedding");
  assert(dp !== null,                          "look-deepika-padukone-wedding found");
  if (dp) {
    assertEq(dp.occasion, "Wedding",           "dp wedding occasion = 'Wedding'");
  }

  // Not-found
  const missing = await productRepository.findBySlug("does-not-exist-xyz");
  assertEq(missing, null, "returns null for unknown slug");

  // Soft-delete test — create, delete, then verify invisible
  await productRepository.create({
    id:           `test-vis-${TS}`,
    celebrityId:  "shah-rukh-khan",
    movieName:    "Visibility Test",
    occasion:     "Party",
    category:     "Test",
    price:        9999,
    manufacturerIds: ["mfr-sabyasachi"],
  });
  await productRepository.delete(`test-vis-${TS}`);
  const deleted = await productRepository.findBySlug(`test-vis-${TS}`);
  assertEq(deleted, null, "soft-deleted record invisible to findBySlug");
  const allAfterDel = await productRepository.findAll();
  assert(
    !allAfterDel.some((o) => o.id === `test-vis-${TS}`),
    "soft-deleted record not in findAll"
  );
}

// ── Suite: create ──────────────────────────────────────────────────────────────

async function testCreate() {
  console.log("\n── create ─────────────────────────────────────────────────");

  const created = await productRepository.create({
    id:             TEST_SLUG,
    celebrityId:    "shah-rukh-khan",
    movieName:      "Test Film",
    occasion:       "Festival",
    category:       "Test Kurta",
    colorPalette:   "Blue, white",
    price:          12345,
    imageUrl:       "https://example.com/img1.jpg",
    images:         ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
    description:    "A test outfit for the repository test suite.",
    year:           2024,
    characterName:  "Test Character",
    manufacturerIds: ["mfr-sabyasachi"],
  });

  assertEq(created.id,             TEST_SLUG,                          "id round-trips");
  assertEq(created.celebrityId,    "shah-rukh-khan",                   "celebrityId round-trips as slug");
  assertEq(created.movieName,      "Test Film",                        "movieName round-trips");
  assertEq(created.occasion,       "Festival",                         "occasion round-trips as display string");
  assertEq(created.category,       "Test Kurta",                       "category round-trips");
  assertEq(created.colorPalette,   "Blue, white",                      "colorPalette round-trips");
  assertEq(created.price,          12345,                              "price round-trips");
  assertEq(created.imageUrl,       "https://example.com/img1.jpg",     "imageUrl round-trips");
  assertEq(created.images.length,  2,                                  "images array has 2 items");
  assertEq(created.images[0],      "https://example.com/img1.jpg",     "images[0] correct");
  assertEq(created.images[1],      "https://example.com/img2.jpg",     "images[1] correct");
  assertEq(created.description,    "A test outfit for the repository test suite.", "description round-trips");
  assertEq(created.year,           2024,                               "year round-trips");
  assertEq(created.characterName,  "Test Character",                   "characterName round-trips");
  assertEq(created.manufacturerIds.length, 1,                          "manufacturerIds has 1 entry");
  assertEq(created.manufacturerIds[0], "mfr-sabyasachi",              "manufacturerIds[0] round-trips as slug");

  // Verify findBySlug and findAll see the new record
  const fetched = await productRepository.findBySlug(TEST_SLUG);
  assert(fetched !== null, "created record visible via findBySlug");
  const all = await productRepository.findAll();
  assert(all.some((o) => o.id === TEST_SLUG), "created record appears in findAll");
}

// ── Suite: create — image fallback ────────────────────────────────────────────

async function testCreateImageFallback() {
  console.log("\n── create — image fallback ────────────────────────────────");

  // No images[] → imageUrl becomes the single ProductImage entry
  const noImgArray = await productRepository.create({
    id:          `test-imgfb-${TS}`,
    celebrityId: "alia-bhatt",
    movieName:   "Image Fallback Test",
    occasion:    "Party",
    category:    "Gown",
    price:       9000,
    imageUrl:    "https://example.com/fallback.jpg",
    // images intentionally omitted
    manufacturerIds: ["mfr-ritu-kumar"],
  });

  assertEq(noImgArray.images.length, 1,                            "no images[] → imageUrl becomes 1-item array");
  assertEq(noImgArray.images[0],     "https://example.com/fallback.jpg", "fallback image URL correct");
}

// ── Suite: create — multiple manufacturers ────────────────────────────────────

async function testCreateMultipleManufacturers() {
  console.log("\n── create — multiple manufacturers ───────────────────────");

  const multi = await productRepository.create({
    id:             TEST_SLUG2,
    celebrityId:    "deepika-padukone",
    movieName:      "Multi Mfr Test",
    occasion:       "Wedding",
    category:       "Saree",
    price:          20000,
    manufacturerIds: ["mfr-sabyasachi", "mfr-ritu-kumar"],
  });

  assertEq(multi.manufacturerIds.length, 2,                  "2 manufacturers created");
  assertEq(multi.manufacturerIds[0], "mfr-sabyasachi",       "first manufacturer (isPrimary) correct");
  assertEq(multi.manufacturerIds[1], "mfr-ritu-kumar",       "second manufacturer correct");

  // Verify DB: isPrimary and priority flags
  const links = await client.manufacturerProduct.findMany({
    where: { product: { slug: TEST_SLUG2 } },
    include: { manufacturer: { select: { slug: true } } },
    orderBy: { priority: "asc" },
  });
  assertEq(links.length,      2,    "exactly 2 DB links");
  assertEq(links[0].isPrimary, true, "first link isPrimary = true");
  assertEq(links[1].isPrimary, false, "second link isPrimary = false");
  assertEq(links[0].priority,  0,    "first link priority = 0");
  assertEq(links[1].priority,  1,    "second link priority = 1");
}

// ── Suite: update ──────────────────────────────────────────────────────────────

async function testUpdate() {
  console.log("\n── update ─────────────────────────────────────────────────");

  // Create a fresh record to update
  await productRepository.create({
    id:             TEST_SLUG3,
    celebrityId:    "allu-arjun",
    movieName:      "Original Title",
    occasion:       "Festival",
    category:       "Kurta Set",
    colorPalette:   "Red, gold",
    price:          15000,
    imageUrl:       "https://example.com/orig.jpg",
    images:         ["https://example.com/orig.jpg"],
    description:    "Original description",
    year:           2022,
    characterName:  "Original Character",
    manufacturerIds: ["mfr-rohit-bal"],
  });

  // Scalar update
  const updated = await productRepository.update(TEST_SLUG3, {
    movieName: "Updated Title",
    occasion:  "Wedding",
    price:     20000,
  });

  assert(updated !== null,              "update returns record");
  assertEq(updated!.movieName, "Updated Title", "movieName updated");
  assertEq(updated!.occasion,  "Wedding",       "occasion updated and mapped to display string");
  assertEq(updated!.price,     20000,           "price updated");
  assertEq(updated!.category,  "Kurta Set",     "category unchanged");
  assertEq(updated!.colorPalette, "Red, gold",  "colorPalette unchanged");

  // Image rebuild
  const withImages = await productRepository.update(TEST_SLUG3, {
    images: ["https://example.com/new1.jpg", "https://example.com/new2.jpg"],
  });
  assert(withImages !== null,                         "update with images returns record");
  assertEq(withImages!.images.length, 2,              "new images array has 2 items");
  assertEq(withImages!.images[0], "https://example.com/new1.jpg", "new images[0] correct");
  assertEq(withImages!.images[1], "https://example.com/new2.jpg", "new images[1] correct");

  // Manufacturer rebuild
  const withMfrs = await productRepository.update(TEST_SLUG3, {
    manufacturerIds: ["mfr-manish-malhotra"],
  });
  assert(withMfrs !== null,                                    "update with manufacturers returns record");
  assertEq(withMfrs!.manufacturerIds.length, 1,                "manufacturer links rebuilt to 1");
  assertEq(withMfrs!.manufacturerIds[0], "mfr-manish-malhotra", "new manufacturer correct");

  // Celebrity change
  const withCeleb = await productRepository.update(TEST_SLUG3, {
    celebrityId: "priyanka-chopra",
  });
  assert(withCeleb !== null,                             "update with new celebrity returns record");
  assertEq(withCeleb!.celebrityId, "priyanka-chopra",   "celebrity updated to new slug");

  // Not-found
  const notFound = await productRepository.update("slug-does-not-exist", { movieName: "X" });
  assertEq(notFound, null, "update returns null for unknown slug");
}

// ── Suite: update — occasion enum mapping ─────────────────────────────────────

async function testUpdateOccasionMapping() {
  console.log("\n── update — occasion mapping ──────────────────────────────");

  const cases: Array<[string, string]> = [
    ["party",     "Party"],
    ["FESTIVAL",  "Festival"],
    ["Wedding",   "Wedding"],
  ];

  for (const [input, expected] of cases) {
    const r = await productRepository.update(TEST_SLUG3, { occasion: input });
    assertEq(r?.occasion, expected, `occasion "${input}" → display "${expected}"`);
  }
}

// ── Suite: delete (soft) ──────────────────────────────────────────────────────

async function testDelete() {
  console.log("\n── delete (soft) ──────────────────────────────────────────");

  // Create a fresh record to delete
  await productRepository.create({
    id:          TEST_SLUG4,
    celebrityId: "ranveer-singh",
    movieName:   "Delete Test",
    occasion:    "Party",
    category:    "Streetwear",
    price:       9999,
    manufacturerIds: ["mfr-manish-malhotra"],
  });

  const result = await productRepository.delete(TEST_SLUG4);
  assertEq(result, true, "delete returns true for existing record");

  // Invisible to public API
  const bySlug = await productRepository.findBySlug(TEST_SLUG4);
  assertEq(bySlug, null, "soft-deleted record invisible via findBySlug");
  const all = await productRepository.findAll();
  assert(!all.some((o) => o.id === TEST_SLUG4), "soft-deleted record not in findAll");

  // DB row still exists with correct flags
  const dbRow = await client.product.findFirst({ where: { slug: TEST_SLUG4 } });
  assert(dbRow !== null,              "DB row still exists after soft-delete");
  assertEq(dbRow!.isActive,  false,   "isActive = false after soft-delete");
  assert(dbRow!.deletedAt !== null,   "deletedAt is set after soft-delete");

  // Second delete returns false
  const again = await productRepository.delete(TEST_SLUG4);
  assertEq(again, false, "second delete returns false (already deleted)");
}

// ── Suite: delete — not found ─────────────────────────────────────────────────

async function testDeleteNotFound() {
  console.log("\n── delete — not found ─────────────────────────────────────");
  const r = await productRepository.delete("slug-does-not-exist");
  assertEq(r, false, "delete returns false for non-existent slug");
}

// ── Suite: image ordering ─────────────────────────────────────────────────────

async function testImageOrdering() {
  console.log("\n── image ordering ─────────────────────────────────────────");

  // The seeder inserts images with sortOrder 0,1,2,… — verify they come back
  // in the correct order regardless of DB storage order.
  const srk = await productRepository.findBySlug("look-shah-rukh-khan-red-carpet");
  assert(srk !== null, "SRK red-carpet found for image ordering check");
  if (srk) {
    assertEq(srk.images.length, 5, "SRK has 5 images");
    const dbImages = await client.productImage.findMany({
      where:   { product: { slug: "look-shah-rukh-khan-red-carpet" } },
      orderBy: { sortOrder: "asc" },
    });
    const repoUrls = srk.images;
    const dbUrls   = dbImages.map((img) => img.url);
    assert(
      repoUrls.every((url, i) => url === dbUrls[i]),
      "repository image order matches sortOrder ascending"
    );
    // First image is marked isPrimary in DB
    assert(dbImages[0].isPrimary,  "sortOrder=0 image is isPrimary");
    assert(!dbImages[1].isPrimary, "sortOrder=1 image is not isPrimary");
  }
}

// ── Suite: manufacturer ordering ──────────────────────────────────────────────

async function testManufacturerOrdering() {
  console.log("\n── manufacturer ordering ──────────────────────────────────");

  const pc = await productRepository.findBySlug("look-priyanka-chopra-party");
  assert(pc !== null, "PC party found for manufacturer ordering check");
  if (pc) {
    assertEq(pc.manufacturerIds.length, 2, "PC party has 2 manufacturers");
    const dbLinks = await client.manufacturerProduct.findMany({
      where:   { product: { slug: "look-priyanka-chopra-party" } },
      include: { manufacturer: { select: { slug: true } } },
      orderBy: { priority: "asc" },
    });
    const repoSlugs = pc.manufacturerIds;
    const dbSlugs   = dbLinks.map((l) => l.manufacturer.slug);
    assert(
      repoSlugs.every((slug, i) => slug === dbSlugs[i]),
      "repository manufacturer order matches priority ascending"
    );
  }
}

// ── Suite: celebrity link ──────────────────────────────────────────────────────

async function testCelebrityLink() {
  console.log("\n── celebrity link ─────────────────────────────────────────");

  // Verify each known celebrity industry is present
  const testCases: Array<[string, string]> = [
    ["look-shah-rukh-khan-red-carpet",  "shah-rukh-khan"],
    ["look-alia-bhatt-gangubai",        "alia-bhatt"],
    ["look-allu-arjun-pushpa",          "allu-arjun"],
    ["look-rajinikanth-classic",        "rajinikanth"],
    ["look-dulquer-salmaan-formal",     "dulquer-salmaan"],
    ["look-zendaya-red-carpet",         "zendaya"],
  ];

  for (const [slug, expectedCelebId] of testCases) {
    const product = await productRepository.findBySlug(slug);
    assertEq(product?.celebrityId, expectedCelebId, `${slug} → celebrityId = ${expectedCelebId}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Phase B.3 — Product Repository Tests     ║");
  console.log("╚════════════════════════════════════════════╝");

  try {
    await testFindAll();
    await testFindBySlug();
    await testCreate();
    await testCreateImageFallback();
    await testCreateMultipleManufacturers();
    await testUpdate();
    await testUpdateOccasionMapping();
    await testDelete();
    await testDeleteNotFound();
    await testImageOrdering();
    await testManufacturerOrdering();
    await testCelebrityLink();
  } finally {
    await client.$disconnect();
  }

  console.log("\n── Results ────────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("────────────────────────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Test suite failed:", e);
  process.exit(1);
});
