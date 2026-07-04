/**
 * Phase B.1 — ManufacturerRepository Integration Tests
 *
 * Tests are run against the real database (DIRECT_URL / DATABASE_URL).
 * Each test creates its own isolated records with a unique timestamp prefix
 * and hard-deletes them in a finally block so the suite is self-cleaning.
 *
 * Run: npm run test:manufacturer   (from apps/backend/)
 */
import { PrismaClient } from "@prisma/client";
import { manufacturerRepository } from "../repositories/manufacturer.repository.js";

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
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

function assertNotNull<T>(value: T | null | undefined, label: string): value is T {
  assert(value !== null && value !== undefined, label, "got null/undefined");
  return value !== null && value !== undefined;
}

// ── Unique slug helper ─────────────────────────────────────────────────────────

const RUN_ID = Date.now();
function testSlug(suffix: string) {
  return `mfr-test-${RUN_ID}-${suffix}`;
}

// ── Hard-delete helper (test cleanup only) ─────────────────────────────────────

async function hardDelete(slug: string) {
  const row = await client.manufacturer.findUnique({ where: { slug } });
  if (!row) return;
  await client.manufacturerProfile.deleteMany({ where: { manufacturerId: row.id } });
  await client.manufacturer.delete({ where: { id: row.id } });
}

// ── Test suites ────────────────────────────────────────────────────────────────

async function testFindAll() {
  console.log("\n── findAll ───────────────────────────────────────────────");

  const results = await manufacturerRepository.findAll();
  assert(Array.isArray(results), "findAll returns an array");
  assert(results.length >= 6, `findAll has at least 6 seeded records (got ${results.length})`);

  for (const m of results) {
    assert(typeof m.id === "string" && m.id.length > 0,            `${m.id} — id is a non-empty string`);
    assert(typeof m.name === "string",                              `${m.id} — name is a string`);
    assert(typeof m.rating === "number",                            `${m.id} — rating is a JS number (not Decimal)`);
    assert(Array.isArray(m.specialties),                            `${m.id} — specialties is an array`);
  }

  // Ensure soft-deleted records are excluded
  const slugToHide = testSlug("hidden");
  try {
    await client.manufacturer.create({
      data: {
        slug: slugToHide, name: "Hidden Mfr", location: "Nowhere",
        rating: 3.0, contactEmail: "hidden@test.com", verified: false,
        isActive: false, deletedAt: new Date(),
      },
    });
    const afterHide = await manufacturerRepository.findAll();
    assert(
      !afterHide.some((m) => m.id === slugToHide),
      "soft-deleted manufacturer excluded from findAll"
    );
  } finally {
    await hardDelete(slugToHide);
  }
}

async function testFindBySlug() {
  console.log("\n── findBySlug ────────────────────────────────────────────");

  const m = await manufacturerRepository.findBySlug("mfr-sabyasachi");
  if (assertNotNull(m, "mfr-sabyasachi found")) {
    assertEq(m.id, "mfr-sabyasachi",         "id = slug");
    assertEq(m.name, "Sabyasachi Mukherjee", "name correct");
    assertEq(m.rating, 5.0,                  "rating = 5.0 as number");
    assertEq(m.verified, true,               "verified = true");
    assert(m.specialties.includes("Saree"),  "specialties includes Saree");
    assertEq(m.location, "Kolkata, India",   "location correct");
  }

  const missing = await manufacturerRepository.findBySlug("mfr-does-not-exist");
  assertEq(missing, null, "returns null for unknown slug");

  // Soft-deleted record is invisible
  const slugHidden = testSlug("find-hidden");
  try {
    await client.manufacturer.create({
      data: {
        slug: slugHidden, name: "FindHidden", location: "X",
        rating: 3.0, contactEmail: "x@x.com", verified: false,
        isActive: false, deletedAt: new Date(),
      },
    });
    const hidden = await manufacturerRepository.findBySlug(slugHidden);
    assertEq(hidden, null, "soft-deleted record invisible to findBySlug");
  } finally {
    await hardDelete(slugHidden);
  }
}

async function testCreate() {
  console.log("\n── create ────────────────────────────────────────────────");

  const slug = testSlug("create");
  try {
    const created = await manufacturerRepository.create({
      name:         "Test Atelier",
      location:     "Pune, India",
      rating:       4.3,
      contactEmail: "test@atelier.com",
      verified:     true,
      specialties:  ["Kurta", "Sherwani"],
    });

    assert(created.id.startsWith("mfr-"), "id starts with 'mfr-'");
    assertEq(created.name,         "Test Atelier",      "name round-trips");
    assertEq(created.location,     "Pune, India",       "location round-trips");
    assertEq(created.rating,       4.3,                 "rating round-trips as number");
    assertEq(created.contactEmail, "test@atelier.com",  "contactEmail round-trips");
    assertEq(created.verified,     true,                "verified round-trips");
    assert(created.specialties.includes("Kurta"),       "specialties include Kurta");
    assert(created.specialties.includes("Sherwani"),    "specialties include Sherwani");

    // Verify it's visible in findAll and findBySlug
    const found = await manufacturerRepository.findBySlug(created.id);
    if (assertNotNull(found, "created record findBySlug")) {
      assertEq(found.name, "Test Atelier", "findBySlug returns same record");
    }

    const all = await manufacturerRepository.findAll();
    assert(all.some((m) => m.id === created.id), "created record appears in findAll");

    // Track the actual slug so cleanup works
    slug !== created.id && (await hardDelete(created.id));
  } finally {
    await hardDelete(slug);
  }
}

async function testCreateEmptySpecialties() {
  console.log("\n── create — empty specialties ────────────────────────────");

  const created = await manufacturerRepository.create({
    name: "Minimal Mfr", location: "Goa, India",
    rating: 4.0, contactEmail: "min@test.com",
    verified: false, specialties: [],
  });
  try {
    assertEq(created.specialties.length, 0, "empty specialties round-trips");
  } finally {
    await hardDelete(created.id);
  }
}

async function testUpdate() {
  console.log("\n── update ────────────────────────────────────────────────");

  const original = await manufacturerRepository.create({
    name: "Update Test", location: "Delhi, India",
    rating: 4.1, contactEmail: "up@test.com",
    verified: false, specialties: ["Gown"],
  });

  try {
    // Partial update — scalars only
    const updated = await manufacturerRepository.update(original.id, {
      name:    "Updated Atelier",
      rating:  4.8,
      verified: true,
    });
    if (assertNotNull(updated, "update returns updated record")) {
      assertEq(updated.name,     "Updated Atelier", "name updated");
      assertEq(updated.rating,   4.8,               "rating updated");
      assertEq(updated.verified, true,              "verified updated");
      assertEq(updated.location, "Delhi, India",    "location unchanged");
      assertEq(updated.specialties.length, 1,       "specialties unchanged when not provided");
    }

    // Specialties update
    const withNewSpecialties = await manufacturerRepository.update(original.id, {
      specialties: ["Saree", "Lehenga", "Anarkali"],
    });
    if (assertNotNull(withNewSpecialties, "specialties update returns record")) {
      assertEq(withNewSpecialties.specialties.length, 3,           "3 specialties after update");
      assert(withNewSpecialties.specialties.includes("Saree"),     "Saree in updated specialties");
      assert(withNewSpecialties.specialties.includes("Lehenga"),   "Lehenga in updated specialties");
      assert(withNewSpecialties.specialties.includes("Anarkali"),  "Anarkali in updated specialties");
    }

    // Not-found returns null
    const notFound = await manufacturerRepository.update("mfr-does-not-exist", { name: "x" });
    assertEq(notFound, null, "update returns null for unknown slug");
  } finally {
    await hardDelete(original.id);
  }
}

async function testUpdateNotFound() {
  console.log("\n── update — not found ────────────────────────────────────");
  const result = await manufacturerRepository.update("mfr-ghost-slug", { name: "ghost" });
  assertEq(result, null, "update returns null for non-existent slug");
}

async function testSoftDelete() {
  console.log("\n── delete (soft) ────────────────────────────────────────");

  const created = await manufacturerRepository.create({
    name: "Delete Target", location: "Hyderabad, India",
    rating: 4.0, contactEmail: "del@test.com",
    verified: false, specialties: [],
  });

  try {
    // Delete succeeds
    const deleted = await manufacturerRepository.delete(created.id);
    assertEq(deleted, true, "delete returns true for existing record");

    // Record invisible to findBySlug
    const found = await manufacturerRepository.findBySlug(created.id);
    assertEq(found, null, "soft-deleted record not visible via findBySlug");

    // Record invisible to findAll
    const all = await manufacturerRepository.findAll();
    assert(!all.some((m) => m.id === created.id), "soft-deleted record not in findAll");

    // DB row still exists with isActive=false
    const row = await client.manufacturer.findUnique({ where: { slug: created.id } });
    if (assertNotNull(row, "DB row still exists after soft-delete")) {
      assertEq(row.isActive, false, "isActive = false after soft-delete");
      assert(row.deletedAt !== null, "deletedAt is set after soft-delete");
    }

    // Double-delete returns false (already inactive)
    const secondDelete = await manufacturerRepository.delete(created.id);
    assertEq(secondDelete, false, "second delete returns false (already deleted)");
  } finally {
    await hardDelete(created.id);
  }
}

async function testDeleteNotFound() {
  console.log("\n── delete — not found ────────────────────────────────────");
  const result = await manufacturerRepository.delete("mfr-ghost-does-not-exist");
  assertEq(result, false, "delete returns false for non-existent slug");
}

async function testRatingDecimalPrecision() {
  console.log("\n── Decimal → number precision ────────────────────────────");

  const ratings = [4.0, 4.5, 4.9, 5.0, 3.7];
  const created: string[] = [];
  try {
    for (const r of ratings) {
      const m = await manufacturerRepository.create({
        name: `Precision ${r}`, location: "Test",
        rating: r, contactEmail: `p${r}@test.com`,
        verified: false, specialties: [],
      });
      created.push(m.id);
      assertEq(typeof m.rating, "number", `rating ${r} is JS number type`);
      assertEq(m.rating, r, `rating ${r} round-trips exactly`);
    }
  } finally {
    for (const id of created) await hardDelete(id);
  }
}

async function testProfileUpsertOnCreate() {
  console.log("\n── ManufacturerProfile created with manufacturer ─────────");

  const m = await manufacturerRepository.create({
    name: "Profile Test", location: "Mumbai, India",
    rating: 4.2, contactEmail: "prof@test.com",
    verified: true, specialties: ["Gown", "Kurta"],
  });
  try {
    const row = await client.manufacturer.findUnique({
      where: { slug: m.id },
      include: { profile: true },
    });
    if (assertNotNull(row?.profile, "ManufacturerProfile row created")) {
      assertEq(row!.profile!.specialties.length, 2, "profile has 2 specialties");
    }
  } finally {
    await hardDelete(m.id);
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Phase B.1 — Manufacturer Repository Tests ║");
  console.log("╚════════════════════════════════════════════╝");

  await testFindAll();
  await testFindBySlug();
  await testCreate();
  await testCreateEmptySpecialties();
  await testUpdate();
  await testUpdateNotFound();
  await testSoftDelete();
  await testDeleteNotFound();
  await testRatingDecimalPrecision();
  await testProfileUpsertOnCreate();

  console.log("\n── Results ───────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("Manufacturer repository test suite failed:", e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
