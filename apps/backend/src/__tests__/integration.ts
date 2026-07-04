/**
 * Phase B.0 Integration Tests
 *
 * Verifies:
 *   - Record counts match expected seed values
 *   - FK relationships are intact (profiles, images, manufacturer links)
 *   - Specific records have correct field values
 *   - Seed is idempotent: running runSeed() twice produces identical counts
 *
 * Run: npm run test:integration   (from apps/backend/)
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../lib/seeder.js";

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

// ── Test suites ────────────────────────────────────────────────────────────────

async function testManufacturers() {
  console.log("\n── Manufacturers ─────────────────────────────────────────");

  const mfrCount = await client.manufacturer.count();
  assertEq(mfrCount, 6, "Exactly 6 manufacturers");

  // Profile 1-to-1: count must match
  const profileCount = await client.manufacturerProfile.count();
  assertEq(profileCount, 6, "Every manufacturer has a profile (count parity)");

  const sabyasachi = await client.manufacturer.findUnique({
    where: { slug: "mfr-sabyasachi" },
    include: { profile: true },
  });
  assert(sabyasachi !== null, "mfr-sabyasachi found by slug");
  assertEq(Number(sabyasachi?.rating), 5.0, "mfr-sabyasachi rating = 5.0");
  assertEq(sabyasachi?.verified, true, "mfr-sabyasachi verified = true");
  assert(
    sabyasachi?.profile?.specialties.includes("Saree") ?? false,
    "mfr-sabyasachi specialties include 'Saree'"
  );

  const southSilk = await client.manufacturer.findUnique({
    where: { slug: "mfr-south-silk" },
  });
  assertEq(southSilk?.location, "Chennai, India", "mfr-south-silk location");
  assertEq(Number(southSilk?.rating), 4.5, "mfr-south-silk rating = 4.5");
}

async function testCelebrities() {
  console.log("\n── Celebrities ───────────────────────────────────────────");

  const celebCount = await client.celebrity.count();
  // 101 records in celebs-seed.json (98 original + dulquer-salmaan, khesari-lal-yadav, anubhav-mohanty)
  assertEq(celebCount, 101, "Exactly 101 celebrities");

  const profileCount = await client.celebrityProfile.count();
  assertEq(profileCount, 101, "Every celebrity has a profile (count parity)");

  const alia = await client.celebrity.findUnique({
    where: { slug: "alia-bhatt" },
    include: { profile: true },
  });
  assert(alia !== null, "alia-bhatt found");
  assertEq(alia?.industry, "BOLLYWOOD", "alia-bhatt industry = BOLLYWOOD");
  assertEq(alia?.isActive, true, "alia-bhatt isActive = true");
  assert(
    (alia?.profile?.styleTags?.length ?? 0) > 0,
    "alia-bhatt has styleTags"
  );
  assert((alia?.profile?.bio?.length ?? 0) > 0, "alia-bhatt bio is set");
  assert(
    (alia?.profile?.profileImage?.length ?? 0) > 0,
    "alia-bhatt profileImage is set"
  );

  const srk = await client.celebrity.findUnique({ where: { slug: "shah-rukh-khan" } });
  assertEq(srk?.industry, "BOLLYWOOD", "shah-rukh-khan industry = BOLLYWOOD");

  const alluArjun = await client.celebrity.findUnique({ where: { slug: "allu-arjun" } });
  assertEq(alluArjun?.industry, "TOLLYWOOD", "allu-arjun industry = TOLLYWOOD");

  const rajini = await client.celebrity.findUnique({ where: { slug: "rajinikanth" } });
  assertEq(rajini?.industry, "KOLLYWOOD", "rajinikanth industry = KOLLYWOOD");

  const dulquer = await client.celebrity.findUnique({ where: { slug: "dulquer-salmaan" } });
  assertEq(dulquer?.industry, "MOLLYWOOD", "dulquer-salmaan industry = MOLLYWOOD");
}

async function testProducts() {
  console.log("\n── Products ──────────────────────────────────────────────");

  const productCount = await client.product.count();
  assertEq(productCount, 35, "Exactly 35 products — no skips");

  // Verify the three previously-skipped products now seed correctly
  const dulquerOutfit = await client.product.findUnique({ where: { slug: "look-dulquer-salmaan-formal" } });
  assert(dulquerOutfit !== null, "look-dulquer-salmaan-formal seeds (dulquer-salmaan in JSON)");
  const khesariOutfit = await client.product.findUnique({ where: { slug: "look-khesari-lal-yadav-wedding" } });
  assert(khesariOutfit !== null, "look-khesari-lal-yadav-wedding seeds (khesari-lal-yadav in JSON)");
  const anubhavOutfit = await client.product.findUnique({ where: { slug: "look-anubhav-mohanty-festival" } });
  assert(anubhavOutfit !== null, "look-anubhav-mohanty-festival seeds (anubhav-mohanty in JSON)");

  // Every product must have ≥1 image
  const productsWithImages = await client.product.count({
    where: { images: { some: {} } },
  });
  assertEq(productsWithImages, productCount, "Every product has at least one image");

  // Every product must have ≥1 manufacturer link
  const productsWithMfr = await client.product.count({
    where: { manufacturerLinks: { some: {} } },
  });
  assertEq(
    productsWithMfr,
    productCount,
    "Every product has at least one manufacturer link"
  );

  // Spot-check: look-alia-bhatt-gangubai
  const gangubai = await client.product.findUnique({
    where: { slug: "look-alia-bhatt-gangubai" },
    include: {
      celebrity: true,
      images: { orderBy: { sortOrder: "asc" } },
      manufacturerLinks: {
        orderBy: { priority: "asc" },
        include: { manufacturer: true },
      },
    },
  });
  assert(gangubai !== null, "look-alia-bhatt-gangubai exists");
  assertEq(gangubai?.celebrity.slug, "alia-bhatt", "Gangubai → alia-bhatt celebrity");
  assertEq(gangubai?.occasion, "FESTIVAL", "Gangubai occasion = FESTIVAL");
  assertEq(gangubai?.basePrice, 14999, "Gangubai basePrice = 14999");
  assertEq(gangubai?.isPublished, true, "Gangubai isPublished = true");
  assertEq(
    gangubai?.manufacturerLinks[0]?.manufacturer.slug,
    "mfr-sabyasachi",
    "Gangubai primary manufacturer = mfr-sabyasachi"
  );
  assertEq(
    gangubai?.manufacturerLinks[0]?.isPrimary,
    true,
    "Gangubai manufacturerLink isPrimary = true"
  );
  assert(
    (gangubai?.images.length ?? 0) >= 1,
    `Gangubai has images (${gangubai?.images.length ?? 0})`
  );
  assertEq(gangubai?.images[0]?.isPrimary, true, "Gangubai first image isPrimary");
  assertEq(gangubai?.images[0]?.sortOrder, 0, "Gangubai first image sortOrder = 0");

  // Spot-check: look-priyanka-chopra-party has 2 manufacturer links
  const priyanka = await client.product.findUnique({
    where: { slug: "look-priyanka-chopra-party" },
    include: { manufacturerLinks: { orderBy: { priority: "asc" } } },
  });
  assertEq(
    priyanka?.manufacturerLinks.length,
    2,
    "look-priyanka-chopra-party has 2 manufacturer links"
  );
  assertEq(
    priyanka?.manufacturerLinks[0]?.isPrimary,
    true,
    "First manufacturer link isPrimary"
  );
  assertEq(
    priyanka?.manufacturerLinks[1]?.isPrimary,
    false,
    "Second manufacturer link is not primary"
  );

  // Spot-check: SRK red-carpet
  const srk = await client.product.findUnique({
    where: { slug: "look-shah-rukh-khan-red-carpet" },
    include: { images: true },
  });
  assert(srk !== null, "look-shah-rukh-khan-red-carpet exists");
  assertEq(srk?.occasion, "PARTY", "SRK red-carpet occasion = PARTY");
  assertEq(srk?.basePrice, 28999, "SRK red-carpet basePrice = 28999");
  assert((srk?.images.length ?? 0) > 1, "SRK red-carpet has multiple images");
}

async function testStorefronts() {
  console.log("\n── Storefronts ───────────────────────────────────────────");

  const storefrontCount = await client.storefront.count();
  assertEq(storefrontCount, 4, "Exactly 4 storefronts");

  const featuredCount = await client.storefrontFeaturedProduct.count();
  assert(featuredCount >= 4, `At least 4 featured products (got ${featuredCount})`);
  assert(featuredCount <= 12, `At most 12 featured products (got ${featuredCount})`);

  const storefronts = await client.storefront.findMany({
    include: {
      celebrity: true,
      featuredProducts: {
        orderBy: { sortOrder: "asc" },
        include: { product: true },
      },
    },
  });

  for (const sf of storefronts) {
    assert(sf.celebrity !== null, `"${sf.displayName}" storefront has celebrity`);
    assertEq(sf.verified, true, `"${sf.displayName}" is verified`);
    assertEq(sf.isPublished, true, `"${sf.displayName}" isPublished`);
    // Not every celebrity has outfits (Amitabh Bachchan has none in catalogue.ts)
    // so we only assert featured products when they exist
    for (const fp of sf.featuredProducts) {
      assertEq(
        fp.product.celebrityId,
        sf.celebrityId,
        `Featured product "${fp.product.slug}" belongs to storefront celebrity`
      );
    }
  }
}

async function testRelationships() {
  console.log("\n── FK Relationship Integrity ─────────────────────────────");

  // ManufacturerProduct: FK integrity guaranteed by DB, verify counts are sane
  const mfrLinkCount = await client.manufacturerProduct.count();
  assert(mfrLinkCount >= 35, `At least 35 manufacturer-product links (got ${mfrLinkCount})`);

  // Every link should have isPrimary correct: exactly one primary per product
  const products = await client.product.findMany({
    include: { manufacturerLinks: { orderBy: { priority: "asc" } } },
  });
  let primaryFlagErrors = 0;
  for (const p of products) {
    const primaryCount = p.manufacturerLinks.filter((l) => l.isPrimary).length;
    if (primaryCount !== 1) primaryFlagErrors++;
  }
  assertEq(primaryFlagErrors, 0, "Every product has exactly one isPrimary=true manufacturer link");

  // ProductImage: first image per product should have sortOrder=0 and isPrimary=true
  const firstImages = await client.productImage.findMany({
    where: { sortOrder: 0 },
  });
  const firstImagesWithPrimary = firstImages.filter((img) => img.isPrimary);
  assertEq(
    firstImages.length,
    firstImagesWithPrimary.length,
    "Every product's first image (sortOrder=0) is marked isPrimary"
  );

  // CelebrityProfile 1-to-1 parity
  const celebCount2 = await client.celebrity.count();
  const profileCount2 = await client.celebrityProfile.count();
  assertEq(celebCount2, profileCount2, "Celebrity:CelebrityProfile is 1-to-1");

  // ManufacturerProfile 1-to-1 parity
  const mfrCount2 = await client.manufacturer.count();
  const mfrProfileCount2 = await client.manufacturerProfile.count();
  assertEq(mfrCount2, mfrProfileCount2, "Manufacturer:ManufacturerProfile is 1-to-1");
}

async function testIdempotency() {
  console.log("\n── Idempotency ───────────────────────────────────────────");

  async function getCounts() {
    return {
      manufacturers: await client.manufacturer.count(),
      mfrProfiles:   await client.manufacturerProfile.count(),
      celebrities:   await client.celebrity.count(),
      celebProfiles: await client.celebrityProfile.count(),
      products:      await client.product.count(),
      images:        await client.productImage.count(),
      mfrLinks:      await client.manufacturerProduct.count(),
      storefronts:   await client.storefront.count(),
      featured:      await client.storefrontFeaturedProduct.count(),
    };
  }

  const before = await getCounts();

  // Re-run the full seed
  await runSeed(client);

  const after = await getCounts();

  assertEq(after.manufacturers, before.manufacturers, `Manufacturers: ${before.manufacturers} → ${after.manufacturers}`);
  assertEq(after.mfrProfiles,   before.mfrProfiles,   `MfrProfiles: ${before.mfrProfiles} → ${after.mfrProfiles}`);
  assertEq(after.celebrities,   before.celebrities,   `Celebrities: ${before.celebrities} → ${after.celebrities}`);
  assertEq(after.celebProfiles, before.celebProfiles, `CelebProfiles: ${before.celebProfiles} → ${after.celebProfiles}`);
  assertEq(after.products,      before.products,      `Products: ${before.products} → ${after.products}`);
  assertEq(after.images,        before.images,        `Images: ${before.images} → ${after.images}`);
  assertEq(after.mfrLinks,      before.mfrLinks,      `MfrLinks: ${before.mfrLinks} → ${after.mfrLinks}`);
  assertEq(after.storefronts,   before.storefronts,   `Storefronts: ${before.storefronts} → ${after.storefronts}`);
  assertEq(after.featured,      before.featured,      `Featured: ${before.featured} → ${after.featured}`);
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║   Phase B.0 — Integration Tests           ║");
  console.log("╚════════════════════════════════════════════╝");

  await testManufacturers();
  await testCelebrities();
  await testProducts();
  await testStorefronts();
  await testRelationships();
  await testIdempotency();

  console.log("\n── Results ───────────────────────────────────────────────");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Integration test suite failed:", e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
