import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

// ── Public API types (byte-for-byte match of existing route contract) ──────────
export type StorefrontEntry = {
  celebrityId: string;         // celebrity SLUG (e.g. "shah-rukh-khan")
  displayName: string;
  bannerImage: string;
  featuredOutfitIds: string[]; // product slugs, ordered by sortOrder asc
  message: string;
  verified: boolean;
};

export type CommissionSummary = {
  orders: number;
  gross: number;
  platformFee: number;
  celebrityCommission: number;
  manufacturerShare: number;
  paid: number;
};

// ── Include / Row type ─────────────────────────────────────────────────────────
const INCLUDE = {
  celebrity: { select: { slug: true } },
  featuredProducts: {
    include: { product: { select: { slug: true } } },
  },
} as const;

type Row = Prisma.StorefrontGetPayload<{
  include: {
    celebrity: { select: { slug: true } };
    featuredProducts: { include: { product: { select: { slug: true } } } };
  };
}>;

// ── Converter ──────────────────────────────────────────────────────────────────
function toApi(row: Row): StorefrontEntry {
  // Sort in JS to avoid TypeScript complications with orderBy inside include
  const sorted = [...row.featuredProducts].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    celebrityId: row.celebrity.slug,
    displayName: row.displayName,
    bannerImage: row.bannerImage,
    featuredOutfitIds: sorted.map((fp) => fp.product.slug),
    message: row.message,
    verified: row.verified,
  };
}

// ── Repository ─────────────────────────────────────────────────────────────────
export const storefrontRepository = {
  async findAll(): Promise<StorefrontEntry[]> {
    const rows = await prisma.storefront.findMany({
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toApi);
  },

  async findByCelebritySlug(slug: string): Promise<StorefrontEntry | null> {
    const row = await prisma.storefront.findFirst({
      where: { celebrity: { slug } },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },

  // Upsert: creates on first call for a celebrity, updates on subsequent calls.
  // Returns null if the celebrity slug does not exist.
  // `created` distinguishes 201 Created from 200 OK in the route handler.
  async upsert(data: {
    celebrityId: string; // celebrity SLUG
    displayName: string;
    bannerImage?: string;
    featuredOutfitIds?: string[];
    message?: string;
    verified?: boolean;
  }): Promise<{ entry: StorefrontEntry; created: boolean } | null> {
    // Resolve celebrity slug → internal cuid
    const celebrity = await prisma.celebrity.findFirst({
      where: { slug: data.celebrityId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!celebrity) return null;

    const featuredSlugs = data.featuredOutfitIds ?? [];

    // Pre-fetch product cuids from slugs — avoids N+1 inside featured-product loop
    const products =
      featuredSlugs.length > 0
        ? await prisma.product.findMany({
            where: { slug: { in: featuredSlugs }, isActive: true, deletedAt: null },
            select: { id: true, slug: true },
          })
        : ([] as Array<{ id: string; slug: string }>);
    const productMap = new Map(products.map((p) => [p.slug, p.id]));

    // Determine create vs update for correct HTTP status code
    const existing = await prisma.storefront.findUnique({
      where: { celebrityId: celebrity.id },
      select: { id: true },
    });
    const created = !existing;

    // Upsert Storefront record (isPublished defaults true on create)
    const storefront = await prisma.storefront.upsert({
      where: { celebrityId: celebrity.id },
      update: {
        displayName: data.displayName,
        bannerImage: data.bannerImage ?? "",
        message: data.message ?? "",
        verified: data.verified ?? false,
      },
      create: {
        celebrityId: celebrity.id,
        displayName: data.displayName,
        bannerImage: data.bannerImage ?? "",
        message: data.message ?? "",
        verified: data.verified ?? false,
        isPublished: true,
      },
      select: { id: true },
    });

    // Replace featured products: delete all then re-create in order
    await prisma.storefrontFeaturedProduct.deleteMany({
      where: { storefrontId: storefront.id },
    });

    const featuredData = featuredSlugs
      .filter((slug) => productMap.has(slug))
      .map((slug, i) => ({
        storefrontId: storefront.id,
        productId: productMap.get(slug)!,
        sortOrder: i,
      }));

    if (featuredData.length > 0) {
      await prisma.storefrontFeaturedProduct.createMany({ data: featuredData });
    }

    // Re-fetch with full includes for toApi conversion
    const row = await prisma.storefront.findUniqueOrThrow({
      where: { id: storefront.id },
      include: INCLUDE,
    });

    return { entry: toApi(row), created };
  },

  // Commission metrics aggregated from all persisted orders — survives restarts.
  async commission(): Promise<CommissionSummary> {
    const [orderCount, commissionAgg, grossAgg, paidAgg] = await Promise.all([
      prisma.order.count(),
      prisma.orderCommission.aggregate({
        _sum: {
          platformFee: true,
          celebrityCommission: true,
          manufacturerShare: true,
        },
      }),
      prisma.order.aggregate({ _sum: { subtotal: true } }),
      prisma.order.aggregate({
        where: { paymentStatus: "CAPTURED" },
        _sum: { total: true },
      }),
    ]);

    return {
      orders: orderCount,
      gross: grossAgg._sum.subtotal ?? 0,
      platformFee: commissionAgg._sum.platformFee ?? 0,
      celebrityCommission: commissionAgg._sum.celebrityCommission ?? 0,
      manufacturerShare: commissionAgg._sum.manufacturerShare ?? 0,
      paid: paidAgg._sum.total ?? 0,
    };
  },
};
