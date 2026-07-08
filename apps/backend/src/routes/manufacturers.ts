import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { manufacturerRepository } from "../repositories/manufacturer.repository.js";
import { MANUFACTURER_SEED } from "../lib/seeder.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { logger } from "../lib/logger.js";

// Re-export type for any consumers that import Manufacturer from this module
export type { Manufacturer } from "../repositories/manufacturer.repository.js";

// In-memory fallback — mirrors the seed data so cold-start / DB errors
// never return HTTP 500 to the client.
const FALLBACK = MANUFACTURER_SEED.map((m) => ({
  id:           m.id,
  name:         m.name,
  location:     m.location,
  rating:       Number(m.rating),
  contactEmail: m.contactEmail,
  verified:     m.verified,
  specialties:  [...m.specialties],
}));

// ── Router ─────────────────────────────────────────────────────────────────────
export const manufacturersRouter = Router();

manufacturersRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await manufacturerRepository.findAll();
    res.json({ data: data.length > 0 ? data : FALLBACK });
  } catch (err) {
    // Log the real Prisma / DB error — do not swallow it silently.
    logger.error({ err }, "[manufacturers] DB query failed — serving in-memory fallback");
    res.json({ data: FALLBACK });
  }
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
