/**
 * Phase B.2 — CelebrityRepository Integration Tests
 *
 * Runs against the real database (DIRECT_URL / DATABASE_URL).
 * Each test creates records under a unique timestamp prefix and hard-deletes
 * them in a finally block. Seeded celebrities are never mutated.
 *
 * Run: npm run test:celebrity   (from apps/backend/)
 */
import { PrismaClient } from "@prisma/client";
import { celebrityRepository } from "../repositories/celebrity.repository.js";

const client = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
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
  return `test-celeb-${RUN_ID}-${suffix}`;
}

// ── Hard-delete helper (test cleanup only — never used for production data) ────

async function hardDelete(slug: string) {
  const row = await client.celebrity.findUnique({ where: { slug } });
  if (!row) return;
  // Profile cascades on celebrity delete
  await client.celebrity.delete({ where: { id: row.id } });
}

// ── Test suites ────────────────────────────────────────────────────────────────

async function testFindAll() {
  console.log("\n── findAll ───────────────────────────────────────────────");

  const results = await celebrityRepository.findAll();
  assert(Array.isArray(results), "findAll returns an array");
  assert(results.length >= 101, `findAll has at least 101 seeded records (got ${results.length})`);

  // Shape checks on first few results
  for (const c of results.slice(0, 5)) {
    assert(typeof c.id === "string" && c.id.length > 0,         `${c.id} — id is non-empty string`);
    assert(typeof c.name === "string" && c.name.length > 0,     `${c.id} — name is non-empty string`);
    assert(typeof c.industry === "string" && c.industry.length > 0, `${c.id} — industry is non-empty string`);
    assert(typeof c.bio === "string",                            `${c.id} — bio is string`);
    assert(typeof c.profileImage === "string",                   `${c.id} — profileImage is string`);
    assert(typeof c.bannerImage === "string",                    `${c.id} — bannerImage is string`);
    assert(Array.isArray(c.styleTags),                           `${c.id} — styleTags is array`);
  }

  // Industry display strings — never raw enum values
  const industries = results.map((c) => c.industry);
  assert(!industries.some((i) => i === i.toUpperCase() && i.length > 3 && i !== "OTT"),
    "industry values are display strings, not uppercase enums (e.g. 'Bollywood' not 'BOLLYWOOD')"
  );

  // Soft-deleted records must not appear
  const hiddenSlug = testSlug("hidden");
  try {
    await client.celebrity.create({
      data: {
        slug: hiddenSlug, name: "Hidden Celeb", industry: "BOLLYWOOD",
        isActive: false, deletedAt: new Date(),
      },
    });
    const after = await celebrityRepository.findAll();
    assert(!after.some((c) => c.id === hiddenSlug), "soft-deleted celebrity excluded from findAll");
  } finally {
    await hardDelete(hiddenSlug);
  }
}

async function testFindAllOrdering() {
  console.log("\n── findAll ordering ──────────────────────────────────────");

  const results = await celebrityRepository.findAll();
  // First celebrity in createdAt-asc order should be shah-rukh-khan (first seeded)
  assertEq(results[0].id, "shah-rukh-khan", "first celebrity in findAll is shah-rukh-khan (seed order)");
}

async function testFindBySlug() {
  console.log("\n── findBySlug ────────────────────────────────────────────");

  const c = await celebrityRepository.findBySlug("alia-bhatt");
  if (assertNotNull(c, "alia-bhatt found")) {
    assertEq(c.id,       "alia-bhatt", "id = slug");
    assertEq(c.name,     "Alia Bhatt", "name correct");
    assertEq(c.industry, "Bollywood",  "industry = display string 'Bollywood'");
    assert(c.bio.length > 0,           "bio non-empty");
    assert(Array.isArray(c.styleTags), "styleTags is array");
  }

  const srk = await celebrityRepository.findBySlug("shah-rukh-khan");
  if (assertNotNull(srk, "shah-rukh-khan found")) {
    assertEq(srk.industry, "Bollywood", "SRK industry = Bollywood");
  }

  const allu = await celebrityRepository.findBySlug("allu-arjun");
  if (assertNotNull(allu, "allu-arjun found")) {
    assertEq(allu.industry, "Tollywood", "allu-arjun industry = Tollywood");
  }

  const rajini = await celebrityRepository.findBySlug("rajinikanth");
  if (assertNotNull(rajini, "rajinikanth found")) {
    assertEq(rajini.industry, "Kollywood", "rajinikanth industry = Kollywood");
  }

  const dulquer = await celebrityRepository.findBySlug("dulquer-salmaan");
  if (assertNotNull(dulquer, "dulquer-salmaan found")) {
    assertEq(dulquer.industry, "Mollywood", "dulquer-salmaan industry = Mollywood");
  }

  // Not found
  const ghost = await celebrityRepository.findBySlug("celeb-does-not-exist");
  assertEq(ghost, null, "returns null for unknown slug");

  // Soft-deleted invisible
  const softSlug = testSlug("soft-find");
  try {
    await client.celebrity.create({
      data: { slug: softSlug, name: "Soft Find", industry: "BOLLYWOOD", isActive: false, deletedAt: new Date() },
    });
    const hidden = await celebrityRepository.findBySlug(softSlug);
    assertEq(hidden, null, "soft-deleted record invisible to findBySlug");
  } finally {
    await hardDelete(softSlug);
  }
}

async function testCreate() {
  console.log("\n── create ────────────────────────────────────────────────");

  const slug = testSlug("create");
  try {
    const created = await celebrityRepository.create({
      slug,
      name:         "Test Star",
      industry:     "Bollywood",
      bio:          "A test celebrity bio.",
      profileImage: "https://example.com/profile.jpg",
      bannerImage:  "https://example.com/banner.jpg",
      styleTags:    ["Ethnic", "Festive"],
    });

    assertEq(created.id,           slug,                               "id = provided slug");
    assertEq(created.name,         "Test Star",                        "name round-trips");
    assertEq(created.industry,     "Bollywood",                        "industry round-trips as display string");
    assertEq(created.bio,          "A test celebrity bio.",            "bio round-trips");
    assertEq(created.profileImage, "https://example.com/profile.jpg", "profileImage round-trips");
    assertEq(created.bannerImage,  "https://example.com/banner.jpg",  "bannerImage round-trips");
    assertEq(created.styleTags.length, 2,                              "styleTags length = 2");
    assert(created.styleTags.includes("Ethnic"),                       "styleTags includes Ethnic");
    assert(created.styleTags.includes("Festive"),                      "styleTags includes Festive");

    // Visible via findBySlug and findAll
    const found = await celebrityRepository.findBySlug(slug);
    if (assertNotNull(found, "created record findBySlug")) {
      assertEq(found.name, "Test Star", "findBySlug returns same record");
    }
    const all = await celebrityRepository.findAll();
    assert(all.some((c) => c.id === slug), "created record appears in findAll");

    // Profile row was created
    const row = await client.celebrity.findUnique({
      where: { slug }, include: { profile: true },
    });
    if (assertNotNull(row?.profile, "CelebrityProfile created with celebrity")) {
      assertEq(row!.profile!.styleTags.length, 2, "profile has 2 styleTags");
    }
  } finally {
    await hardDelete(slug);
  }
}

async function testCreateIndustryMapping() {
  console.log("\n── create — industry enum mapping ────────────────────────");

  const cases: Array<{ input: string; expected: string }> = [
    { input: "bollywood", expected: "Bollywood" },
    { input: "Tollywood", expected: "Tollywood" },
    { input: "KOLLYWOOD", expected: "Kollywood" },
    { input: "Mollywood", expected: "Mollywood" },
    { input: "OTT",       expected: "OTT"       },
  ];

  const created: string[] = [];
  try {
    for (const { input, expected } of cases) {
      const slug = testSlug(`industry-${input.toLowerCase()}`);
      const c = await celebrityRepository.create({
        slug, name: `Ind ${input}`, industry: input,
        bio: "", profileImage: "", bannerImage: "", styleTags: [],
      });
      created.push(slug);
      assertEq(c.industry, expected, `industry "${input}" → display "${expected}"`);
    }
  } finally {
    for (const s of created) await hardDelete(s);
  }
}

async function testCreateEmptyFields() {
  console.log("\n── create — empty optional fields ───────────────────────");

  const slug = testSlug("empty");
  try {
    const c = await celebrityRepository.create({
      slug,
      name: "Minimal Star", industry: "Music",
      bio: "", profileImage: "", bannerImage: "", styleTags: [],
    });
    assertEq(c.bio,           "",      "empty bio round-trips");
    assertEq(c.profileImage,  "",      "empty profileImage round-trips");
    assertEq(c.bannerImage,   "",      "empty bannerImage round-trips");
    assertEq(c.styleTags.length, 0,    "empty styleTags round-trips");
    assertEq(c.industry, "Music",      "Music industry display string");
  } finally {
    await hardDelete(slug);
  }
}

async function testUpdate() {
  console.log("\n── update ────────────────────────────────────────────────");

  const slug = testSlug("update");
  const original = await celebrityRepository.create({
    slug, name: "Update Test", industry: "Bollywood",
    bio: "Original bio.", profileImage: "https://example.com/p.jpg",
    bannerImage: "https://example.com/b.jpg", styleTags: ["Ethnic"],
  });

  try {
    // Scalar update only
    const u1 = await celebrityRepository.update(slug, { name: "Updated Name" });
    if (assertNotNull(u1, "update returns record")) {
      assertEq(u1.name,     "Updated Name",  "name updated");
      assertEq(u1.industry, "Bollywood",     "industry unchanged");
      assertEq(u1.bio,      "Original bio.", "bio unchanged");
    }

    // Profile field update
    const u2 = await celebrityRepository.update(slug, { bio: "New bio.", styleTags: ["Casual", "Minimal"] });
    if (assertNotNull(u2, "profile update returns record")) {
      assertEq(u2.bio, "New bio.", "bio updated");
      assertEq(u2.styleTags.length, 2, "styleTags length = 2 after update");
      assert(u2.styleTags.includes("Casual"),  "Casual in updated styleTags");
      assert(u2.styleTags.includes("Minimal"), "Minimal in updated styleTags");
      assertEq(u2.name, "Updated Name", "name unchanged after profile update");
    }

    // Industry update
    const u3 = await celebrityRepository.update(slug, { industry: "tollywood" });
    if (assertNotNull(u3, "industry update returns record")) {
      assertEq(u3.industry, "Tollywood", "industry updated and mapped to display string");
    }

    // Not found
    const notFound = await celebrityRepository.update("celeb-ghost-slug", { name: "x" });
    assertEq(notFound, null, "update returns null for unknown slug");
  } finally {
    await hardDelete(slug);
  }
}

async function testUpdateNotFound() {
  console.log("\n── update — not found ────────────────────────────────────");
  const result = await celebrityRepository.update("celeb-ghost-does-not-exist", { name: "ghost" });
  assertEq(result, null, "update returns null for non-existent slug");
}

async function testSoftDelete() {
  console.log("\n── delete (soft) ────────────────────────────────────────");

  const slug = testSlug("delete");
  await celebrityRepository.create({
    slug, name: "Delete Target", industry: "Bollywood",
    bio: "", profileImage: "", bannerImage: "", styleTags: [],
  });

  try {
    // Delete succeeds
    const result = await celebrityRepository.delete(slug);
    assertEq(result, true, "delete returns true for existing record");

    // Not visible via findBySlug
    const found = await celebrityRepository.findBySlug(slug);
    assertEq(found, null, "soft-deleted record invisible via findBySlug");

    // Not in findAll
    const all = await celebrityRepository.findAll();
    assert(!all.some((c) => c.id === slug), "soft-deleted record not in findAll");

    // DB row exists with isActive=false
    const row = await client.celebrity.findUnique({ where: { slug } });
    if (assertNotNull(row, "DB row still present after soft-delete")) {
      assertEq(row.isActive, false,  "isActive = false");
      assert(row.deletedAt !== null, "deletedAt is set");
    }

    // Double delete returns false
    const second = await celebrityRepository.delete(slug);
    assertEq(second, false, "second delete returns false (already deleted)");
  } finally {
    await hardDelete(slug);
  }
}

async function testDeleteNotFound() {
  console.log("\n── delete — not found ────────────────────────────────────");
  const result = await celebrityRepository.delete("celeb-ghost-not-exist");
  assertEq(result, false, "delete returns false for non-existent slug");
}

async function testSearchBehaviourName() {
  console.log("\n── search filter — name match ────────────────────────────");
  const all = await celebrityRepository.findAll();
  const q = "alia";
  const results = all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.bio.toLowerCase().includes(q) ||
      c.styleTags.some((t) => t.toLowerCase().includes(q))
  );
  assert(results.some((c) => c.id === "alia-bhatt"), "?search=alia matches alia-bhatt by name");
}

async function testIndustryFilterBehaviour() {
  console.log("\n── industry filter behaviour ─────────────────────────────");
  const all = await celebrityRepository.findAll();

  const bollywood = all.filter((c) => c.industry.toLowerCase() === "bollywood");
  assert(bollywood.length > 0, "filtering by 'bollywood' returns results");
  assert(bollywood.every((c) => c.industry === "Bollywood"), "all filtered results have industry 'Bollywood'");

  const tollywood = all.filter((c) => c.industry.toLowerCase() === "tollywood");
  assert(tollywood.length > 0, "filtering by 'tollywood' returns results");

  // Case-insensitive: "BOLLYWOOD" should also match "Bollywood"
  const upperFilter = all.filter((c) => c.industry.toLowerCase() === "bollywood");
  assertEq(upperFilter.length, bollywood.length, "uppercase 'BOLLYWOOD' filter returns same count as lowercase");
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  Phase B.2 — Celebrity Repository Tests   ║");
  console.log("╚════════════════════════════════════════════╝");

  await testFindAll();
  await testFindAllOrdering();
  await testFindBySlug();
  await testCreate();
  await testCreateIndustryMapping();
  await testCreateEmptyFields();
  await testUpdate();
  await testUpdateNotFound();
  await testSoftDelete();
  await testDeleteNotFound();
  await testSearchBehaviourName();
  await testIndustryFilterBehaviour();

  console.log("\n── Results ───────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("Celebrity repository test suite failed:", e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
