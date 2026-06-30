import { Router } from "express";
import type { Request, Response } from "express";
import { celebrityRecords } from "../data/catalogue.js";

// Mutable in-memory store seeded from catalogue
export const celebrityStore = [...celebrityRecords];

export const celebritiesRouter = Router();

// GET all — supports ?industry=&search= filters
celebritiesRouter.get("/", (req: Request, res: Response) => {
  let results = [...celebrityStore];
  const { industry, search } = req.query as Record<string, string>;
  if (industry) {
    results = results.filter((c) => c.industry.toLowerCase() === industry.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (c) => c.name.toLowerCase().includes(q) || c.bio.toLowerCase().includes(q) || c.styleTags.some((t) => t.toLowerCase().includes(q))
    );
  }
  res.json({ data: results });
});

// GET single
celebritiesRouter.get("/:id", (req: Request, res: Response) => {
  const item = celebrityStore.find((c) => c.id === req.params.id);
  if (!item) { res.status(404).json({ message: "Celebrity not found" }); return; }
  res.json({ data: item });
});

// POST create
celebritiesRouter.post("/", (req: Request, res: Response) => {
  const { name, industry, bio, profileImage, bannerImage, styleTags } = req.body;
  if (!name || !industry) {
    res.status(400).json({ message: "name and industry are required" });
    return;
  }
  const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (celebrityStore.find((c) => c.id === id)) {
    res.status(409).json({ message: "Celebrity with this name already exists" });
    return;
  }
  const newItem = {
    id,
    name,
    industry,
    bio: bio || "",
    profileImage: profileImage || "",
    bannerImage: bannerImage || profileImage || "",
    styleTags: Array.isArray(styleTags) ? styleTags : (styleTags ? String(styleTags).split(",").map((t: string) => t.trim()) : [])
  };
  celebrityStore.push(newItem);
  res.status(201).json({ data: newItem });
});

// PUT update
celebritiesRouter.put("/:id", (req: Request, res: Response) => {
  const idx = celebrityStore.findIndex((c) => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Celebrity not found" }); return; }
  const updated = { ...celebrityStore[idx], ...req.body, id: req.params.id };
  if (req.body.styleTags && !Array.isArray(req.body.styleTags)) {
    updated.styleTags = String(req.body.styleTags).split(",").map((t: string) => t.trim());
  }
  celebrityStore[idx] = updated;
  res.json({ data: updated });
});

// DELETE
celebritiesRouter.delete("/:id", (req: Request, res: Response) => {
  const idx = celebrityStore.findIndex((c) => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ message: "Celebrity not found" }); return; }
  celebrityStore.splice(idx, 1);
  res.json({ message: "Deleted" });
});
