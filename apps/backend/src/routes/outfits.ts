import { Router } from "express";
import type { Request, Response } from "express";
import { productRepository } from "../repositories/product.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { prisma } from "../lib/prisma.js";
import {
  invalidateGlobalRecommendationsCache,
  invalidateProductRecommendationsCache,
} from "../services/recommendation.service.js";

// ── Public type re-export ──────────────────────────────────────────────────────
export type { OutfitEntry } from "../repositories/product.repository.js";
import type { OutfitEntry } from "../repositories/product.repository.js";

// ── Celebrity name lookup ──────────────────────────────────────────────────────
// Fetches a slug→name map from Postgres. Used to enrich outfit responses.

async function buildCelebMap(): Promise<Map<string, string>> {
  const rows = await prisma.celebrity.findMany({
    where: { isActive: true, deletedAt: null },
    select: { slug: true, name: true },
  });
  return new Map(rows.map((c) => [c.slug, c.name]));
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
    const celebMap = await buildCelebMap();
    const q = search.toLowerCase();
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

  const celebMap = await buildCelebMap();
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
  const celebMap = await buildCelebMap();
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

  invalidateGlobalRecommendationsCache();

  const celebMap = await buildCelebMap();
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

  invalidateGlobalRecommendationsCache();
  invalidateProductRecommendationsCache(updated.id);

  const celebMap = await buildCelebMap();
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
  invalidateGlobalRecommendationsCache();
  invalidateProductRecommendationsCache(id);
  res.json({ message: "Deleted" });
});
