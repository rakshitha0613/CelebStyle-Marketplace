import { Router } from "express";
import type { Request, Response } from "express";
import { manufacturerRepository } from "../repositories/manufacturer.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

// Re-export type for any consumers that import Manufacturer from this module
export type { Manufacturer } from "../repositories/manufacturer.repository.js";

// ── Router ─────────────────────────────────────────────────────────────────────
export const manufacturersRouter = Router();

manufacturersRouter.get("/", async (_req: Request, res: Response) => {
  const data = await manufacturerRepository.findAll();
  res.json({ data });
});

manufacturersRouter.get("/:id", async (req: Request, res: Response) => {
  const item = await manufacturerRepository.findBySlug(req.params.id as string);
  if (!item) {
    res.status(404).json({ message: "Manufacturer not found" });
    return;
  }
  res.json({ data: item });
});

manufacturersRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const { name, location, rating, contactEmail, verified, specialties } = req.body;
  if (!name || !location || !contactEmail) {
    res.status(400).json({ message: "name, location, and contactEmail are required" });
    return;
  }
  const newItem = await manufacturerRepository.create({
    name,
    location,
    rating:      Number(rating) || 4.0,
    contactEmail,
    verified:    Boolean(verified),
    specialties: Array.isArray(specialties) ? specialties : [],
  });
  res.status(201).json({ data: newItem });
});

manufacturersRouter.put("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const { name, location, rating, contactEmail, verified, specialties } = req.body;
  const updated = await manufacturerRepository.update(req.params.id as string, {
    ...(name         !== undefined && { name }),
    ...(location     !== undefined && { location }),
    ...(rating       !== undefined && { rating: Number(rating) }),
    ...(contactEmail !== undefined && { contactEmail }),
    ...(verified     !== undefined && { verified: Boolean(verified) }),
    ...(specialties  !== undefined && { specialties: Array.isArray(specialties) ? specialties : [] }),
  });
  if (!updated) {
    res.status(404).json({ message: "Manufacturer not found" });
    return;
  }
  res.json({ data: updated });
});

manufacturersRouter.delete("/:id", authenticate, authorize("SUPER_ADMIN"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await manufacturerRepository.delete(id);
  if (!deleted) {
    res.status(404).json({ message: "Manufacturer not found" });
    return;
  }
  res.json({ message: "Deleted" });
});
