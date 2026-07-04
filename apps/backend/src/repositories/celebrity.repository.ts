import { prisma } from "../lib/prisma.js";
import type { Industry } from "@prisma/client";

// ── Public type ────────────────────────────────────────────────────────────────
// Matches CelebrityRecord from catalogue.ts exactly — same field names/types —
// so consuming code (outfits, orders, storefronts) continues to work unchanged.

export type Celebrity = {
  id: string;           // slug (e.g. "shah-rukh-khan")
  name: string;
  industry: string;     // display string: "Bollywood", "Tollywood", etc.
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

// ── Industry mapping ───────────────────────────────────────────────────────────

const INDUSTRY_ENUM: Record<string, Industry> = {
  bollywood: "BOLLYWOOD",
  tollywood: "TOLLYWOOD",
  kollywood: "KOLLYWOOD",
  mollywood: "MOLLYWOOD",
  hollywood: "HOLLYWOOD",
  ott:       "OTT",
  music:     "MUSIC",
  sports:    "SPORTS",
  fashion:   "FASHION",
  politics:  "POLITICS",
};

const INDUSTRY_DISPLAY: Record<string, string> = {
  BOLLYWOOD: "Bollywood",
  TOLLYWOOD: "Tollywood",
  KOLLYWOOD: "Kollywood",
  MOLLYWOOD: "Mollywood",
  HOLLYWOOD: "Hollywood",
  OTT:       "OTT",
  MUSIC:     "Music",
  SPORTS:    "Sports",
  FASHION:   "Fashion",
  POLITICS:  "Politics",
  OTHER:     "Other",
};

function toIndustryEnum(raw: string): Industry {
  return INDUSTRY_ENUM[raw.toLowerCase()] ?? "OTHER";
}

// ── Internal row type ──────────────────────────────────────────────────────────

type Row = {
  slug:     string;
  name:     string;
  industry: Industry;
  profile: {
    bio:          string;
    profileImage: string;
    bannerImage:  string;
    styleTags:    string[];
  } | null;
};

function toApi(row: Row): Celebrity {
  return {
    id:           row.slug,
    name:         row.name,
    industry:     INDUSTRY_DISPLAY[row.industry] ?? String(row.industry),
    bio:          row.profile?.bio          ?? "",
    profileImage: row.profile?.profileImage ?? "",
    bannerImage:  row.profile?.bannerImage  ?? "",
    styleTags:    row.profile?.styleTags    ?? [],
  };
}

const INCLUDE = {
  profile: { select: { bio: true, profileImage: true, bannerImage: true, styleTags: true } },
} as const;

const ACTIVE = { isActive: true, deletedAt: null } as const;

// ── Repository ─────────────────────────────────────────────────────────────────

export const celebrityRepository = {

  async findAll(): Promise<Celebrity[]> {
    const rows = await prisma.celebrity.findMany({
      where:   ACTIVE,
      include: INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toApi);
  },

  async findBySlug(slug: string): Promise<Celebrity | null> {
    const row = await prisma.celebrity.findFirst({
      where:   { slug, ...ACTIVE },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },

  async create(data: {
    slug:         string;
    name:         string;
    industry:     string;
    bio:          string;
    profileImage: string;
    bannerImage:  string;
    styleTags:    string[];
  }): Promise<Celebrity> {
    const row = await prisma.celebrity.create({
      data: {
        slug:     data.slug,
        name:     data.name,
        industry: toIndustryEnum(data.industry),
        isActive: true,
        profile: {
          create: {
            bio:          data.bio,
            profileImage: data.profileImage,
            bannerImage:  data.bannerImage,
            styleTags:    data.styleTags,
          },
        },
      },
      include: INCLUDE,
    });
    return toApi(row);
  },

  async update(
    slug: string,
    data: Partial<{
      name:         string;
      industry:     string;
      bio:          string;
      profileImage: string;
      bannerImage:  string;
      styleTags:    string[];
    }>
  ): Promise<Celebrity | null> {
    const existing = await prisma.celebrity.findFirst({ where: { slug, ...ACTIVE } });
    if (!existing) return null;

    const { bio, profileImage, bannerImage, styleTags, industry, ...scalars } = data;
    const hasProfileUpdate =
      bio !== undefined || profileImage !== undefined ||
      bannerImage !== undefined || styleTags !== undefined;

    const row = await prisma.celebrity.update({
      where: { id: existing.id },
      data: {
        ...scalars,
        ...(industry !== undefined && { industry: toIndustryEnum(industry) }),
        ...(hasProfileUpdate && {
          profile: {
            upsert: {
              create: {
                bio:          bio          ?? "",
                profileImage: profileImage ?? "",
                bannerImage:  bannerImage  ?? "",
                styleTags:    styleTags    ?? [],
              },
              update: {
                ...(bio          !== undefined && { bio }),
                ...(profileImage !== undefined && { profileImage }),
                ...(bannerImage  !== undefined && { bannerImage }),
                ...(styleTags    !== undefined && { styleTags }),
              },
            },
          },
        }),
      },
      include: INCLUDE,
    });
    return toApi(row);
  },

  // Soft-delete — Product.celebrity has onDelete: Restrict, so hard-delete
  // would fail for any celebrity that already has DB products linked to them.
  async delete(slug: string): Promise<boolean> {
    const existing = await prisma.celebrity.findFirst({ where: { slug, ...ACTIVE } });
    if (!existing) return false;
    await prisma.celebrity.update({
      where: { id: existing.id },
      data:  { isActive: false, deletedAt: new Date() },
    });
    return true;
  },
};
