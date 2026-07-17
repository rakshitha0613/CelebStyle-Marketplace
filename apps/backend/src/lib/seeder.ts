/**
 * CelebStyle seed functions.
 *
 * All writes use upsert on the stable `slug` key — idempotent and safe to run
 * multiple times. Exported so the integration test suite can call runSeed()
 * directly to verify idempotency without spawning a child process.
 */
import { PrismaClient } from "@prisma/client";
import type { Industry, Occasion } from "@prisma/client";
import { celebrityRecords, outfitRecords } from "../data/catalogue.js";
import { COLLECTION_DEFINITIONS, outfitIdsForCollection } from "../data/collections.js";
import { hashPassword } from "../auth/password.service.js";

// ── Enum mapping ───────────────────────────────────────────────────────────────

const INDUSTRY_MAP: Record<string, Industry> = {
  bollywood:  "BOLLYWOOD",
  tollywood:  "TOLLYWOOD",
  kollywood:  "KOLLYWOOD",
  mollywood:  "MOLLYWOOD",
  hollywood:  "HOLLYWOOD",
  ott:        "OTT",
  music:      "MUSIC",
  sports:     "SPORTS",
  fashion:    "FASHION",
  politics:   "POLITICS",
};

function toIndustry(raw: string): Industry {
  return INDUSTRY_MAP[raw.toLowerCase()] ?? "OTHER";
}

const OCCASION_MAP: Record<string, Occasion> = {
  party:       "PARTY",
  wedding:     "WEDDING",
  festival:    "FESTIVAL",
  casual:      "CASUAL",
  award:       "AWARD",
  premiere:    "PREMIERE",
  endorsement: "ENDORSEMENT",
  film:        "FILM",
  corporate:   "CORPORATE",
  sports:      "SPORTS",
};

function toOccasion(raw: string): Occasion {
  return OCCASION_MAP[raw.toLowerCase()] ?? "CASUAL";
}

// ── Manufacturer data ──────────────────────────────────────────────────────────

export const MANUFACTURER_SEED = [
  {
    id: "mfr-ritu-kumar",
    name: "Ritu Kumar Atelier",
    location: "Delhi, India",
    rating: "4.9",
    contactEmail: "orders@ritukumar.com",
    verified: true,
    specialties: ["Saree", "Lehenga", "Anarkali"],
  },
  {
    id: "mfr-manish-malhotra",
    name: "Manish Malhotra Studio",
    location: "Mumbai, India",
    rating: "4.8",
    contactEmail: "studio@manishmalhotra.in",
    verified: true,
    specialties: ["Gown", "Lehenga", "Sherwani"],
  },
  {
    id: "mfr-sabyasachi",
    name: "Sabyasachi Mukherjee",
    location: "Kolkata, India",
    rating: "5.0",
    contactEmail: "couture@sabyasachi.com",
    verified: true,
    specialties: ["Saree", "Bridal", "Kurta"],
  },
  {
    id: "mfr-tarun-tahiliani",
    name: "Tarun Tahiliani Couture",
    location: "Delhi, India",
    rating: "4.7",
    contactEmail: "info@taruntahiliani.com",
    verified: true,
    specialties: ["Gown", "Suit", "Bandhgala"],
  },
  {
    id: "mfr-rohit-bal",
    name: "Rohit Bal Designs",
    location: "Delhi, India",
    rating: "4.6",
    contactEmail: "design@rohitbal.com",
    verified: true,
    specialties: ["Sherwani", "Kurta Set", "Nehru Jacket Set"],
  },
  {
    id: "mfr-south-silk",
    name: "South Silk House",
    location: "Chennai, India",
    rating: "4.5",
    contactEmail: "contact@southsilkhouse.com",
    verified: true,
    specialties: ["Shirt + Veshti", "Saree", "Kurta"],
  },
] as const;

// ── Individual seed functions ──────────────────────────────────────────────────

export async function seedManufacturers(
  client: PrismaClient
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const mfr of MANUFACTURER_SEED) {
    const record = await client.manufacturer.upsert({
      where: { slug: mfr.id },
      update: {
        name: mfr.name,
        location: mfr.location,
        rating: mfr.rating,
        contactEmail: mfr.contactEmail,
        verified: mfr.verified,
      },
      create: {
        slug: mfr.id,
        name: mfr.name,
        location: mfr.location,
        rating: mfr.rating,
        contactEmail: mfr.contactEmail,
        verified: mfr.verified,
        isActive: true,
      },
    });

    await client.manufacturerProfile.upsert({
      where: { manufacturerId: record.id },
      update: { specialties: [...mfr.specialties] },
      create: { manufacturerId: record.id, specialties: [...mfr.specialties] },
    });

    slugToId.set(mfr.id, record.id);
  }

  return slugToId;
}

export async function seedCelebrities(
  client: PrismaClient
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const celeb of celebrityRecords) {
    const record = await client.celebrity.upsert({
      where: { slug: celeb.id },
      update: {
        name: celeb.name,
        industry: toIndustry(celeb.industry),
      },
      create: {
        slug: celeb.id,
        name: celeb.name,
        industry: toIndustry(celeb.industry),
        isActive: true,
      },
    });

    await client.celebrityProfile.upsert({
      where: { celebrityId: record.id },
      update: {
        bio: celeb.bio,
        profileImage: celeb.profileImage,
        bannerImage: celeb.bannerImage,
        styleTags: celeb.styleTags,
      },
      create: {
        celebrityId: record.id,
        bio: celeb.bio,
        profileImage: celeb.profileImage,
        bannerImage: celeb.bannerImage,
        styleTags: celeb.styleTags,
      },
    });

    slugToId.set(celeb.id, record.id);
  }

  return slugToId;
}

export async function seedProducts(
  client: PrismaClient,
  celebMap: Map<string, string>,
  mfrMap: Map<string, string>
): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();
  let skipped = 0;

  for (const outfit of outfitRecords) {
    const celebrityId = celebMap.get(outfit.celebrityId);
    if (!celebrityId) {
      console.warn(
        `  ! Skipping product "${outfit.id}" — celebrity "${outfit.celebrityId}" not seeded`
      );
      skipped++;
      continue;
    }

    const product = await client.product.upsert({
      where: { slug: outfit.id },
      update: {
        movieName:     outfit.movieName,
        occasion:      toOccasion(outfit.occasion),
        category:      outfit.category,
        colorPalette:  outfit.colorPalette,
        basePrice:     outfit.price,
        imageUrl:      outfit.imageUrl,
        description:   outfit.description,
        year:          outfit.year ?? null,
        characterName: outfit.characterName ?? null,
        isActive:      true,
        isPublished:   true,
      },
      create: {
        slug:          outfit.id,
        celebrityId,
        movieName:     outfit.movieName,
        occasion:      toOccasion(outfit.occasion),
        category:      outfit.category,
        colorPalette:  outfit.colorPalette,
        basePrice:     outfit.price,
        imageUrl:      outfit.imageUrl,
        description:   outfit.description,
        year:          outfit.year ?? null,
        characterName: outfit.characterName ?? null,
        isActive:      true,
        isPublished:   true,
      },
    });

    slugToId.set(outfit.id, product.id);

    // Images: delete then recreate — order matters, idempotency guaranteed
    await client.productImage.deleteMany({ where: { productId: product.id } });
    const images =
      outfit.images && outfit.images.length > 0
        ? outfit.images
        : [outfit.imageUrl];
    await client.productImage.createMany({
      data: images.map((url, idx) => ({
        productId: product.id,
        url,
        sortOrder: idx,
        isPrimary: idx === 0,
      })),
    });

    // Manufacturer links: upsert on composite unique key [productId, manufacturerId]
    const mfrIds = outfit.manufacturerIds ?? [];
    for (let i = 0; i < mfrIds.length; i++) {
      const manufacturerId = mfrMap.get(mfrIds[i]);
      if (!manufacturerId) {
        console.warn(
          `  ! Manufacturer "${mfrIds[i]}" not found for product "${outfit.id}"`
        );
        continue;
      }
      await client.manufacturerProduct.upsert({
        where: {
          productId_manufacturerId: { productId: product.id, manufacturerId },
        },
        update: { priority: i, isPrimary: i === 0 },
        create: {
          productId: product.id,
          manufacturerId,
          priority: i,
          isPrimary: i === 0,
        },
      });
    }
  }

  if (skipped > 0) {
    console.warn(`  ! ${skipped} product(s) skipped`);
  }

  return slugToId;
}

export async function seedStorefronts(
  client: PrismaClient,
  celebMap: Map<string, string>,
  productMap: Map<string, string>
): Promise<void> {
  // Mirror original lazy-seed logic: first 4 celebrities in the records array
  for (const celeb of celebrityRecords.slice(0, 4)) {
    const celebrityId = celebMap.get(celeb.id);
    if (!celebrityId) continue;

    const storefront = await client.storefront.upsert({
      where: { celebrityId },
      update: {
        displayName: celeb.name,
        bannerImage:  celeb.bannerImage,
        message:      `${celeb.name} curated luxury replica looks for fans.`,
        verified:     true,
        isPublished:  true,
      },
      create: {
        celebrityId,
        displayName: celeb.name,
        bannerImage:  celeb.bannerImage,
        message:      `${celeb.name} curated luxury replica looks for fans.`,
        verified:     true,
        isPublished:  true,
      },
    });

    // Up to 3 products for this celebrity
    const featured = outfitRecords
      .filter((o) => o.celebrityId === celeb.id)
      .slice(0, 3);

    for (let i = 0; i < featured.length; i++) {
      const productId = productMap.get(featured[i].id);
      if (!productId) continue;
      await client.storefrontFeaturedProduct.upsert({
        where: {
          storefrontId_productId: { storefrontId: storefront.id, productId },
        },
        update: { sortOrder: i },
        create: { storefrontId: storefront.id, productId, sortOrder: i },
      });
    }
  }
}

export async function seedCollections(
  client: PrismaClient,
  productMap: Map<string, string>
): Promise<void> {
  for (let i = 0; i < COLLECTION_DEFINITIONS.length; i++) {
    const def = COLLECTION_DEFINITIONS[i];
    const outfitIds = outfitIdsForCollection(def);

    const collection = await client.collection.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        description: def.description,
        coverImageUrl: def.coverImageUrl,
        isPublished: true,
        sortOrder: i,
      },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        coverImageUrl: def.coverImageUrl,
        isPublished: true,
        sortOrder: i,
      },
    });

    // Membership: delete then recreate — order matters, idempotency guaranteed
    await client.collectionProduct.deleteMany({ where: { collectionId: collection.id } });
    const productIds = outfitIds
      .map((id) => productMap.get(id))
      .filter((id): id is string => Boolean(id));
    if (productIds.length > 0) {
      await client.collectionProduct.createMany({
        data: productIds.map((productId, idx) => ({
          collectionId: collection.id,
          productId,
          sortOrder: idx,
        })),
      });
    }
  }
}

// ── Admin user seed ────────────────────────────────────────────────────────────

export async function seedAdminUser(client: PrismaClient): Promise<void> {
  const adminEmail = "admin@celebstyle.com";
  const existing = await client.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      await client.user.update({ where: { email: adminEmail }, data: { role: "SUPER_ADMIN" } });
      console.log("  Admin user role upgraded to SUPER_ADMIN");
    }
    return;
  }
  const passwordHash = await hashPassword("Admin@123");
  await client.user.create({
    data: {
      email: adminEmail,
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      emailVerified: true,
      isActive: true,
    },
  });
  console.log("  Admin user created: admin@celebstyle.com / Admin@123");
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export async function runSeed(client: PrismaClient): Promise<void> {
  const mfrMap  = await seedManufacturers(client);
  const celebMap = await seedCelebrities(client);
  const productMap = await seedProducts(client, celebMap, mfrMap);
  await seedStorefronts(client, celebMap, productMap);
  await seedCollections(client, productMap);
  await seedAdminUser(client);
}
