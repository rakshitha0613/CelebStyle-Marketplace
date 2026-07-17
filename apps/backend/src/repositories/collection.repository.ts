import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";

// ── Public API type ──────────────────────────────────────────────────────────────
// Deliberately thin — outfit IDs only, not nested outfit objects — the
// frontend resolves these against an already-fetched outfits list, same
// convention as trending/new-arrivals sections on the homepage.
export type CollectionEntry = {
  id: string; // slug
  name: string;
  description: string;
  coverImageUrl: string;
  outfitIds: string[]; // product slugs, ordered by sortOrder asc
};

// ── Prisma include shape ───────────────────────────────────────────────────────
const INCLUDE = {
  products: {
    include: { product: { select: { slug: true } } },
  },
} as const;

type Row = Prisma.CollectionGetPayload<{
  include: {
    products: { include: { product: { select: { slug: true } } } };
  };
}>;

function toApi(row: Row): CollectionEntry {
  const sorted = [...row.products].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: row.slug,
    name: row.name,
    description: row.description ?? "",
    coverImageUrl: row.coverImageUrl ?? "",
    outfitIds: sorted.map((cp) => cp.product.slug),
  };
}

export const collectionRepository = {
  async findAll(): Promise<CollectionEntry[]> {
    const rows = await prisma.collection.findMany({
      where: { isPublished: true },
      include: INCLUDE,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(toApi);
  },

  async findBySlug(slug: string): Promise<CollectionEntry | null> {
    const row = await prisma.collection.findFirst({
      where: { slug, isPublished: true },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },
};
