import { prisma } from "../lib/prisma.js";

// ── Public type ────────────────────────────────────────────────────────────────
// This is the shape all API responses expose. The Prisma cuid is internal;
// `id` here is the human-readable slug (e.g. "mfr-sabyasachi").

export type Manufacturer = {
  id: string;
  name: string;
  location: string;
  rating: number;
  contactEmail: string;
  verified: boolean;
  specialties: string[];
};

// ── Internal helpers ───────────────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof prisma.manufacturer.findFirstOrThrow>> & {
  profile: { specialties: string[] } | null;
};

function toApi(row: Row): Manufacturer {
  return {
    id:           row.slug,
    name:         row.name,
    location:     row.location,
    rating:       Number(row.rating),         // Prisma Decimal → JS number
    contactEmail: row.contactEmail,
    verified:     row.verified,
    specialties:  row.profile?.specialties ?? [],
  };
}

const INCLUDE = { profile: { select: { specialties: true } } } as const;
const ACTIVE  = { isActive: true, deletedAt: null } as const;

// ── Repository ─────────────────────────────────────────────────────────────────

export const manufacturerRepository = {

  async findAll(): Promise<Manufacturer[]> {
    const rows = await prisma.manufacturer.findMany({
      where:   ACTIVE,
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toApi);
  },

  async findBySlug(slug: string): Promise<Manufacturer | null> {
    const row = await prisma.manufacturer.findFirst({
      where:   { slug, ...ACTIVE },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },

  async create(data: {
    name:         string;
    location:     string;
    rating:       number;
    contactEmail: string;
    verified:     boolean;
    specialties:  string[];
  }): Promise<Manufacturer> {
    const slug = `mfr-${Date.now()}`;
    const row = await prisma.manufacturer.create({
      data: {
        slug,
        name:         data.name,
        location:     data.location,
        rating:       data.rating,
        contactEmail: data.contactEmail,
        verified:     data.verified,
        isActive:     true,
        profile: { create: { specialties: data.specialties } },
      },
      include: INCLUDE,
    });
    return toApi(row);
  },

  async update(
    slug: string,
    data: Partial<{
      name:         string;
      location:     string;
      rating:       number;
      contactEmail: string;
      verified:     boolean;
      specialties:  string[];
    }>
  ): Promise<Manufacturer | null> {
    const existing = await prisma.manufacturer.findFirst({
      where: { slug, ...ACTIVE },
    });
    if (!existing) return null;

    const { specialties, ...scalars } = data;

    const row = await prisma.manufacturer.update({
      where: { id: existing.id },
      data: {
        ...scalars,
        ...(specialties !== undefined
          ? {
              profile: {
                upsert: {
                  create: { specialties },
                  update: { specialties },
                },
              },
            }
          : {}),
      },
      include: INCLUDE,
    });
    return toApi(row);
  },

  // Soft-delete: sets isActive=false and deletedAt=now.
  // ManufacturerProduct uses onDelete: Restrict so a hard-delete would fail if
  // products are linked. Soft-delete avoids that constraint.
  async delete(slug: string): Promise<boolean> {
    const existing = await prisma.manufacturer.findFirst({
      where: { slug, ...ACTIVE },
    });
    if (!existing) return false;
    await prisma.manufacturer.update({
      where: { id: existing.id },
      data:  { isActive: false, deletedAt: new Date() },
    });
    return true;
  },
};
