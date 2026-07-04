import { Router } from "express";
import type { Request, Response } from "express";
import { celebrityRecords } from "../data/catalogue.js";
import { celebrityRepository } from "../repositories/celebrity.repository.js";
import type { Celebrity } from "../repositories/celebrity.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

// ── Compatibility store ────────────────────────────────────────────────────────
// outfits.ts and orders.ts import `celebrityStore` for celebrity id→name lookups
// when enriching outfit and cart-item responses. We keep this array seeded from
// the catalogue and in sync with every Prisma write so those lookups remain
// accurate for the lifetime of the process.

export const celebrityStore: Celebrity[] = [...(celebrityRecords as Celebrity[])];

// ── Helpers ────────────────────────────────────────────────────────────────────

function syncToStore(updated: Celebrity) {
  const idx = celebrityStore.findIndex((c) => c.id === updated.id);
  if (idx === -1) {
    celebrityStore.push(updated);
  } else {
    celebrityStore[idx] = updated;
  }
}

function removeFromStore(id: string) {
  const idx = celebrityStore.findIndex((c) => c.id === id);
  if (idx !== -1) celebrityStore.splice(idx, 1);
}

// ── Router ─────────────────────────────────────────────────────────────────────

export const celebritiesRouter = Router();

// GET all — supports ?industry= and ?search= filters (applied in JS to match
// original case-insensitive behaviour, including substring match on styleTags)
celebritiesRouter.get("/", async (req: Request, res: Response) => {
  let results = await celebrityRepository.findAll();
  const { industry, search } = req.query as Record<string, string>;

  if (industry) {
    results = results.filter(
      (c) => c.industry.toLowerCase() === industry.toLowerCase()
    );
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.bio.toLowerCase().includes(q) ||
        c.styleTags.some((t) => t.toLowerCase().includes(q))
    );
  }

  res.json({ data: results });
});

// GET single
celebritiesRouter.get("/:id", async (req: Request, res: Response) => {
  const item = await celebrityRepository.findBySlug(req.params.id as string);
  if (!item) {
    res.status(404).json({ message: "Celebrity not found" });
    return;
  }
  res.json({ data: item });
});

// POST create
celebritiesRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const { name, industry, bio, profileImage, bannerImage, styleTags } = req.body;
  if (!name || !industry) {
    res.status(400).json({ message: "name and industry are required" });
    return;
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  // 409 if a celebrity with this derived slug already exists
  const duplicate = await celebrityRepository.findBySlug(slug);
  if (duplicate) {
    res.status(409).json({ message: "Celebrity with this name already exists" });
    return;
  }

  const normalizedTags: string[] = Array.isArray(styleTags)
    ? styleTags
    : styleTags
      ? String(styleTags).split(",").map((t: string) => t.trim())
      : [];

  const newItem = await celebrityRepository.create({
    slug,
    name,
    industry,
    bio:          bio          || "",
    profileImage: profileImage || "",
    bannerImage:  bannerImage  || profileImage || "",
    styleTags:    normalizedTags,
  });
  syncToStore(newItem);
  res.status(201).json({ data: newItem });
});

// PUT update
celebritiesRouter.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const { name, industry, bio, profileImage, bannerImage, styleTags: rawTags } = req.body;

  const normalizedTags: string[] | undefined =
    rawTags !== undefined
      ? Array.isArray(rawTags)
        ? rawTags
        : String(rawTags).split(",").map((t: string) => t.trim())
      : undefined;

  const updated = await celebrityRepository.update(req.params.id as string, {
    ...(name         !== undefined && { name }),
    ...(industry     !== undefined && { industry }),
    ...(bio          !== undefined && { bio }),
    ...(profileImage !== undefined && { profileImage }),
    ...(bannerImage  !== undefined && { bannerImage }),
    ...(normalizedTags !== undefined && { styleTags: normalizedTags }),
  });

  if (!updated) {
    res.status(404).json({ message: "Celebrity not found" });
    return;
  }
  syncToStore(updated);
  res.json({ data: updated });
});

// DELETE
celebritiesRouter.delete("/:id", authenticate, authorize("SUPER_ADMIN"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await celebrityRepository.delete(id);
  if (!deleted) {
    res.status(404).json({ message: "Celebrity not found" });
    return;
  }
  removeFromStore(id);
  res.json({ message: "Deleted" });
});
