import { prisma } from "../lib/prisma.js";
import type { Occasion, Prisma } from "@prisma/client";

// ── Public type ────────────────────────────────────────────────────────────────
// Mirrors OutfitEntry from outfits.ts exactly — same field names and types —
// so consuming code (orders.ts, storefronts.ts) continues to work unchanged.

export type OutfitEntry = {
  id: string;              // slug  (e.g. "look-shah-rukh-khan-red-carpet")
  celebrityId: string;     // celebrity slug (e.g. "shah-rukh-khan")
  movieName: string;
  occasion: string;        // display string: "Party", "Festival", etc.
  category: string;
  colorPalette: string;
  price: number;           // maps to Product.basePrice (Int)
  imageUrl: string;
  images: string[];        // ordered URLs from ProductImage (sortOrder asc)
  description: string;
  year?: number;
  characterName?: string;
  manufacturerIds: string[]; // manufacturer slugs, ordered by priority
};

// ── Occasion mapping ───────────────────────────────────────────────────────────

const OCCASION_ENUM: Record<string, Occasion> = {
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

// Title-case display strings match the values in catalogue.ts (the original
// seed source) so the API response is byte-for-byte identical to the previous
// in-memory behaviour.
const OCCASION_DISPLAY: Record<string, string> = {
  PARTY:       "Party",
  WEDDING:     "Wedding",
  FESTIVAL:    "Festival",
  CASUAL:      "Casual",
  AWARD:       "Award",
  PREMIERE:    "Premiere",
  ENDORSEMENT: "Endorsement",
  FILM:        "Film",
  CORPORATE:   "Corporate",
  SPORTS:      "Sports",
};

function toOccasionEnum(raw: string): Occasion {
  return OCCASION_ENUM[raw.toLowerCase()] ?? "CASUAL";
}

// ── Prisma include shape ───────────────────────────────────────────────────────

const INCLUDE = {
  celebrity:        { select: { slug: true } },
  images:           true,                                         // all ProductImage scalars
  manufacturerLinks: {
    include: { manufacturer: { select: { slug: true } } },       // ManufacturerProduct + slug
  },
} as const;

// Derive the Row type directly from the include so it stays in sync
// with schema changes automatically.
type Row = Prisma.ProductGetPayload<{
  include: {
    celebrity:         { select: { slug: true } };
    images:            true;
    manufacturerLinks: { include: { manufacturer: { select: { slug: true } } } };
  };
}>;

const ACTIVE     = { isActive: true, deletedAt: null } as const;
const MFR_ACTIVE = { isActive: true, deletedAt: null } as const;

// ── toApi ──────────────────────────────────────────────────────────────────────

function toApi(row: Row): OutfitEntry {
  // images come back unordered from Prisma when using `images: true`
  const sortedImages = [...row.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedLinks  = [...row.manufacturerLinks].sort((a, b) => a.priority - b.priority);

  return {
    id:              row.slug,
    celebrityId:     row.celebrity.slug,
    movieName:       row.movieName,
    occasion:        OCCASION_DISPLAY[row.occasion] ?? String(row.occasion),
    category:        row.category,
    colorPalette:    row.colorPalette,
    price:           row.basePrice,
    imageUrl:        row.imageUrl,
    images:          sortedImages.map((img) => img.url),
    description:     row.description,
    year:            row.year            ?? undefined,
    characterName:   row.characterName   ?? undefined,
    manufacturerIds: sortedLinks.map((link) => link.manufacturer.slug),
  };
}

// ── Image helper ───────────────────────────────────────────────────────────────

function buildImageCreates(imageUrl: string, images: string[]) {
  if (images.length > 0) {
    return images.map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 }));
  }
  if (imageUrl) {
    return [{ url: imageUrl, sortOrder: 0, isPrimary: true }];
  }
  return [];
}

// ── Repository ─────────────────────────────────────────────────────────────────

export const productRepository = {

  async findAll(): Promise<OutfitEntry[]> {
    const rows = await prisma.product.findMany({
      where:   ACTIVE,
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toApi);
  },

  // Accepts either the human-readable slug (used throughout the frontend,
  // e.g. "look-shah-rukh-khan-red-carpet") or the internal Prisma cuid
  // (e.g. returned by CommunityPost.outfitId) — callers may have either.
  async findBySlug(idOrSlug: string): Promise<OutfitEntry | null> {
    const row = await prisma.product.findFirst({
      where:   { OR: [{ slug: idOrSlug }, { id: idOrSlug }], ...ACTIVE },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },

  async create(data: {
    id:              string;
    celebrityId:     string;
    movieName:       string;
    occasion:        string;
    category:        string;
    colorPalette?:   string;
    price:           number;
    imageUrl?:       string;
    images?:         string[];
    description?:    string;
    year?:           number;
    characterName?:  string;
    manufacturerIds?: string[];
  }): Promise<OutfitEntry> {
    // Resolve celebrity slug → internal cuid
    const celebrity = await prisma.celebrity.findFirst({
      where:  { slug: data.celebrityId, ...ACTIVE },
      select: { id: true },
    });
    if (!celebrity) throw new Error(`Celebrity not found: ${data.celebrityId}`);

    // Resolve manufacturer slugs → internal cuids (preserve order → priority)
    const mfrSlugs = data.manufacturerIds ?? [];
    const manufacturers = await Promise.all(
      mfrSlugs.map((slug) =>
        prisma.manufacturer.findFirst({
          where:  { slug, ...MFR_ACTIVE },
          select: { id: true },
        })
      )
    );

    const imageUrl = data.imageUrl ?? "";
    const images   = data.images   ?? [];

    const row = await prisma.product.create({
      data: {
        slug:          data.id,
        celebrityId:   celebrity.id,
        movieName:     data.movieName,
        occasion:      toOccasionEnum(data.occasion),
        category:      data.category,
        colorPalette:  data.colorPalette ?? "",
        basePrice:     Math.round(data.price),
        imageUrl,
        description:   data.description  ?? "",
        year:          data.year          ?? null,
        characterName: data.characterName ?? null,
        isPublished:   true,
        isActive:      true,
        images: {
          create: buildImageCreates(imageUrl, images),
        },
        manufacturerLinks: {
          create: manufacturers
            .map((mfr, i) =>
              mfr ? { manufacturerId: mfr.id, isPrimary: i === 0, priority: i } : null
            )
            .filter((x): x is NonNullable<typeof x> => x !== null),
        },
      },
      include: INCLUDE,
    });

    return toApi(row);
  },

  async update(
    slug: string,
    data: Partial<{
      celebrityId:     string;
      movieName:       string;
      occasion:        string;
      category:        string;
      colorPalette:    string;
      price:           number;
      imageUrl:        string;
      images:          string[];
      description:     string;
      year:            number;
      characterName:   string;
      manufacturerIds: string[];
    }>
  ): Promise<OutfitEntry | null> {
    const existing = await prisma.product.findFirst({
      where:  { slug, ...ACTIVE },
      select: { id: true },
    });
    if (!existing) return null;

    // Destructure fields that need async resolution or special handling
    const { images, manufacturerIds, price, occasion, celebrityId, ...scalars } = data;

    // Resolve new celebrity if provided
    let newCelebrityId: string | undefined;
    if (celebrityId !== undefined) {
      const celeb = await prisma.celebrity.findFirst({
        where:  { slug: celebrityId, ...ACTIVE },
        select: { id: true },
      });
      if (!celeb) throw new Error(`Celebrity not found: ${celebrityId}`);
      newCelebrityId = celeb.id;
    }

    // Resolve manufacturer slugs if provided
    let resolvedMfrs: Array<{ id: string } | null> | undefined;
    if (manufacturerIds !== undefined) {
      resolvedMfrs = await Promise.all(
        manufacturerIds.map((mSlug) =>
          prisma.manufacturer.findFirst({
            where:  { slug: mSlug, ...MFR_ACTIVE },
            select: { id: true },
          })
        )
      );
    }

    const row = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...(newCelebrityId          !== undefined && { celebrityId:   newCelebrityId }),
        ...(scalars.movieName       !== undefined && { movieName:     scalars.movieName }),
        ...(scalars.category        !== undefined && { category:      scalars.category }),
        ...(scalars.colorPalette    !== undefined && { colorPalette:  scalars.colorPalette }),
        ...(scalars.imageUrl        !== undefined && { imageUrl:      scalars.imageUrl }),
        ...(scalars.description     !== undefined && { description:   scalars.description }),
        ...(scalars.year            !== undefined && { year:          scalars.year }),
        ...(scalars.characterName   !== undefined && { characterName: scalars.characterName }),
        ...(price                   !== undefined && { basePrice:     Math.round(price) }),
        ...(occasion                !== undefined && { occasion:      toOccasionEnum(occasion) }),
        ...(resolvedMfrs            !== undefined && {
          manufacturerLinks: {
            deleteMany: {},
            create: resolvedMfrs
              .map((mfr, i) =>
                mfr ? { manufacturerId: mfr.id, isPrimary: i === 0, priority: i } : null
              )
              .filter((x): x is NonNullable<typeof x> => x !== null),
          },
        }),
        ...(images !== undefined && {
          images: {
            deleteMany: {},
            create: buildImageCreates(scalars.imageUrl ?? images[0] ?? "", images),
          },
        }),
      },
      include: INCLUDE,
    });

    return toApi(row);
  },

  // Soft-delete: OrderItem, CartItem, WishlistItem all reference Product with
  // onDelete: Restrict — a hard-delete would fail for products already ordered.
  async delete(slug: string): Promise<boolean> {
    const existing = await prisma.product.findFirst({
      where:  { slug, ...ACTIVE },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.product.update({
      where: { id: existing.id },
      data:  { isActive: false, deletedAt: new Date() },
    });
    return true;
  },
};
