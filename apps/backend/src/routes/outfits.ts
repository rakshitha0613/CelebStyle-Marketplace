import { Router } from "express";
import type { Request, Response } from "express";
import { outfitRecords } from "../data/catalogue.js";
import { celebrityStore } from "./celebrities.js";
import { productRepository } from "../repositories/product.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

// ── Public type re-export ──────────────────────────────────────────────────────
// OutfitEntry now lives in the repository. Re-export so any existing import of
// the type from this module continues to resolve without modification.
export type { OutfitEntry } from "../repositories/product.repository.js";
import type { OutfitEntry } from "../repositories/product.repository.js";

// ── Compatibility store ────────────────────────────────────────────────────────
// orders.ts and storefronts.ts import `outfitStore` synchronously and use it
// for id→data lookups at order-creation and storefront-seeding time. We keep
// this array initialised from the catalogue and in sync with every Prisma write
// so those lookups remain accurate for the lifetime of the process.
// Phase B.4 (orders) and B.5 (storefronts) will remove these dependencies.

export const outfitStore: OutfitEntry[] = outfitRecords.map((o) => ({
  id:              o.id,
  celebrityId:     o.celebrityId,
  movieName:       o.movieName,
  occasion:        o.occasion,
  category:        o.category,
  colorPalette:    o.colorPalette,
  price:           o.price,
  imageUrl:        o.imageUrl,
  images:          o.images          ?? [],
  description:     o.description,
  year:            o.year,
  characterName:   o.characterName,
  manufacturerIds: o.manufacturerIds ?? [],
}));

function syncToStore(updated: OutfitEntry) {
  const idx = outfitStore.findIndex((o) => o.id === updated.id);
  if (idx === -1) {
    outfitStore.push(updated);
  } else {
    outfitStore[idx] = updated;
  }
}

function removeFromStore(id: string) {
  const idx = outfitStore.findIndex((o) => o.id === id);
  if (idx !== -1) outfitStore.splice(idx, 1);
}

// ── Router ─────────────────────────────────────────────────────────────────────

export const outfitsRouter = Router();

// GET all — supports ?celebrityId=&occasion=&category=&search=&year= filters
outfitsRouter.get("/", async (req: Request, res: Response) => {
  let results = await productRepository.findAll();

  const { celebrityId, occasion, category, search, year } = req.query as Record<string, string>;
  if (celebrityId) results = results.filter((o) => o.celebrityId === celebrityId);
  if (occasion)   results = results.filter((o) => o.occasion.toLowerCase() === occasion.toLowerCase());
  if (category)   results = results.filter((o) => o.category.toLowerCase().includes(category.toLowerCase()));
  if (year)       results = results.filter((o) => String(o.year) === year);
  if (search) {
    const q = search.toLowerCase();
    const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
    results = results.filter(
      (o) =>
        o.movieName.toLowerCase().includes(q)        ||
        o.category.toLowerCase().includes(q)         ||
        o.occasion.toLowerCase().includes(q)         ||
        o.description.toLowerCase().includes(q)      ||
        o.colorPalette.toLowerCase().includes(q)     ||
        (o.characterName || "").toLowerCase().includes(q) ||
        (celebMap.get(o.celebrityId) || "").toLowerCase().includes(q)
    );
  }

  // Enrich with celebrity name
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  const enriched = results.map((o) => ({
    ...o,
    celebrityName: celebMap.get(o.celebrityId) || o.celebrityId,
  }));
  res.json({ data: enriched });
});

// GET single
outfitsRouter.get("/:id", async (req: Request, res: Response) => {
  const item = await productRepository.findBySlug(req.params.id as string);
  if (!item) {
    res.status(404).json({ message: "Outfit not found" });
    return;
  }
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.json({ data: { ...item, celebrityName: celebMap.get(item.celebrityId) || item.celebrityId } });
});

// POST create
outfitsRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const {
    celebrityId, movieName, occasion, category,
    colorPalette, price, imageUrl, images,
    description, year, characterName, manufacturerIds,
  } = req.body;

  if (!celebrityId || !movieName || !occasion || !category) {
    res.status(400).json({ message: "celebrityId, movieName, occasion, and category are required" });
    return;
  }

  const newItem = await productRepository.create({
    id:              `look-${celebrityId as string}-${Date.now()}`,
    celebrityId:     celebrityId as string,
    movieName:       movieName as string,
    occasion:        occasion as string,
    category:        category as string,
    colorPalette:    (colorPalette as string)  || "",
    price:           Number(price)             || 0,
    imageUrl:        (imageUrl as string)      || "",
    images:          Array.isArray(images)     ? (images as string[]) : [],
    description:     (description as string)   || "",
    year:            year                      ? Number(year) : undefined,
    characterName:   (characterName as string) || "",
    manufacturerIds: Array.isArray(manufacturerIds) ? (manufacturerIds as string[]) : [],
  });

  syncToStore(newItem);

  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.status(201).json({
    data: { ...newItem, celebrityName: celebMap.get(newItem.celebrityId) || newItem.celebrityId },
  });
});

// PUT update
outfitsRouter.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const updated = await productRepository.update(req.params.id as string, {
    ...(body.celebrityId    !== undefined && { celebrityId:    body.celebrityId    as string }),
    ...(body.movieName      !== undefined && { movieName:      body.movieName      as string }),
    ...(body.occasion       !== undefined && { occasion:       body.occasion       as string }),
    ...(body.category       !== undefined && { category:       body.category       as string }),
    ...(body.colorPalette   !== undefined && { colorPalette:   body.colorPalette   as string }),
    ...(body.imageUrl       !== undefined && { imageUrl:       body.imageUrl       as string }),
    ...(body.description    !== undefined && { description:    body.description    as string }),
    ...(body.characterName  !== undefined && { characterName:  body.characterName  as string }),
    ...(body.price          !== undefined && { price:          Number(body.price) }),
    ...(body.year           !== undefined && { year:           Number(body.year) }),
    ...(body.images         !== undefined && {
      images: Array.isArray(body.images) ? (body.images as string[]) : [],
    }),
    ...(body.manufacturerIds !== undefined && {
      manufacturerIds: Array.isArray(body.manufacturerIds)
        ? (body.manufacturerIds as string[])
        : [],
    }),
  });

  if (!updated) {
    res.status(404).json({ message: "Outfit not found" });
    return;
  }

  syncToStore(updated);

  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.json({ data: { ...updated, celebrityName: celebMap.get(updated.celebrityId) || updated.celebrityId } });
});

// DELETE
outfitsRouter.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await productRepository.delete(id);
  if (!deleted) {
    res.status(404).json({ message: "Outfit not found" });
    return;
  }
  removeFromStore(id);
  res.json({ message: "Deleted" });
});
