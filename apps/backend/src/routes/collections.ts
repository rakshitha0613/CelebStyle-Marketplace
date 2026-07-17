import { Router } from "express";
import type { Request, Response } from "express";
import { collectionRepository } from "../repositories/collection.repository.js";

export type { CollectionEntry } from "../repositories/collection.repository.js";

export const collectionsRouter = Router();

collectionsRouter.get("/", async (_req: Request, res: Response) => {
  const collections = await collectionRepository.findAll();
  res.json({ data: collections });
});

collectionsRouter.get("/:slug", async (req: Request, res: Response) => {
  const item = await collectionRepository.findBySlug(req.params.slug as string);
  if (!item) {
    res.status(404).json({ message: "Collection not found" });
    return;
  }
  res.json({ data: item });
});
