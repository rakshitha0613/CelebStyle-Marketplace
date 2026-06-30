import { Router } from "express";
import type { Request, Response } from "express";
import { outfitRecords } from "../data/catalogue.js";
import { celebrityStore } from "./celebrities.js";

export type OutfitEntry = {
  id: string;
  celebrityId: string;
  movieName: string;
  occasion: string;
  category: string;
  colorPalette: string;
  price: number;
  imageUrl: string;
  images?: string[];          // multi-angle gallery (Myntra-style)
  description: string;
  year?: number;
  characterName?: string;
  manufacturerIds?: string[];
};

// Mutable in-memory store seeded from catalogue
export const outfitStore: OutfitEntry[] = outfitRecords.map((o) => ({
  ...o,
  manufacturerIds: o.manufacturerIds ?? [],
  images: o.images ?? []
}));

export const outfitsRouter = Router();

// GET all — supports ?celebrityId=&occasion=&category=&search=&year= filters
outfitsRouter.get("/", (req: Request, res: Response) => {
  let results = [...outfitStore];
  const { celebrityId, occasion, category, search, year } = req.query as Record<string, string>;
  if (celebrityId) results = results.filter((o) => o.celebrityId === celebrityId);
  if (occasion) results = results.filter((o) => o.occasion.toLowerCase() === occasion.toLowerCase());
  if (category) results = results.filter((o) => o.category.toLowerCase().includes(category.toLowerCase()));
  if (year) results = results.filter((o) => String(o.year) === year);
  if (search) {
    const q = search.toLowerCase();
    const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
    results = results.filter(
      (o) =>
        o.movieName.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q) ||
        o.occasion.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.colorPalette.toLowerCase().includes(q) ||
        (o.characterName || "").toLowerCase().includes(q) ||
        (celebMap.get(o.celebrityId) || "").toLowerCase().includes(q)
    );
  }
  // Enrich with celebrity name
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  const enriched = results.map((o) => ({ ...o, celebrityName: celebMap.get(o.celebrityId) || o.celebrityId }));
  res.json({ data: enriched });
});

// GET single
outfitsRouter.get("/:id", (req: Request, res: Response) => {
  const item = outfitStore.find((o) => o.id === req.params.id);
  if (!item) { res.status(404).json({ message: "Outfit not found" }); return; }
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.json({ data: { ...item, celebrityName: celebMap.get(item.celebrityId) || item.celebrityId } });
});

// POST create
outfitsRouter.post("/", (req: Request, res: Response) => {
  const { celebrityId, movieName, occasion, category, colorPalette, price, imageUrl, images, description, year, characterName, manufacturerIds } = req.body;
  if (!celebrityId || !movieName || !occasion || !category) {
    res.status(400).json({ message: "celebrityId, movieName, occasion, and category are required" });
    return;
  }
  const newItem: OutfitEntry = {
    id: `look-${celebrityId}-${Date.now()}`,
    celebrityId,
    movieName,
    occasion,
    category,
    colorPalette: colorPalette || "",
    price: Number(price) || 0,
    imageUrl: imageUrl || "",
    images: Array.isArray(images) ? images : [],
    description: description || "",
    year: year ? Number(year) : undefined,
    characterName: characterName || "",
    manufacturerIds: Array.isArray(manufacturerIds) ? manufacturerIds : []
  };
  outfitStore.push(newItem);
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.status(201).json({ data: { ...newItem, celebrityName: celebMap.get(newItem.celebrityId) || newItem.celebrityId } });
});

// PUT update
outfitsRouter.put("/:id", (req: Request, res: Response) => {
  const idx = outfitStore.findIndex((o) => o.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Outfit not found" }); return; }
  outfitStore[idx] = { ...outfitStore[idx], ...req.body, id: req.params.id };
  const celebMap = new Map(celebrityStore.map((c) => [c.id, c.name]));
  res.json({ data: { ...outfitStore[idx], celebrityName: celebMap.get(outfitStore[idx].celebrityId) || outfitStore[idx].celebrityId } });
});

// DELETE
outfitsRouter.delete("/:id", (req: Request, res: Response) => {
  const idx = outfitStore.findIndex((o) => o.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Outfit not found" }); return; }
  outfitStore.splice(idx, 1);
  res.json({ message: "Deleted" });
});
