/**
 * Entry point for `prisma db seed`.
 * All logic lives in src/lib/seeder.ts so it can be imported by integration tests.
 */
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seeder.js";

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   CelebStyle — Prisma Seed v1.0      ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Use DIRECT_URL (session mode) to bypass pgBouncer transaction-mode limits
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
  });

  try {
    console.log("Seeding manufacturers...");
    console.log("Seeding celebrities...");
    console.log("Seeding products...");
    console.log("Seeding storefronts...");
    await runSeed(prisma);

    const [
      mfrCount,
      mfrProfileCount,
      celebCount,
      celebProfileCount,
      productCount,
      imageCount,
      mfrLinkCount,
      storefrontCount,
      featuredCount,
    ] = await Promise.all([
      prisma.manufacturer.count(),
      prisma.manufacturerProfile.count(),
      prisma.celebrity.count(),
      prisma.celebrityProfile.count(),
      prisma.product.count(),
      prisma.productImage.count(),
      prisma.manufacturerProduct.count(),
      prisma.storefront.count(),
      prisma.storefrontFeaturedProduct.count(),
    ]);

    console.log("\n── Record Counts ──────────────────────────────────────");
    console.log(`  Manufacturers         ${mfrCount}   (profiles: ${mfrProfileCount})`);
    console.log(`  Celebrities           ${celebCount}  (profiles: ${celebProfileCount})`);
    console.log(`  Products              ${productCount}`);
    console.log(`  Product Images        ${imageCount}`);
    console.log(`  Manufacturer Links    ${mfrLinkCount}`);
    console.log(`  Storefronts           ${storefrontCount}`);
    console.log(`  Storefront Featured   ${featuredCount}`);
    console.log("────────────────────────────────────────────────────────\n");

    console.log("✓ Seed completed successfully.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
