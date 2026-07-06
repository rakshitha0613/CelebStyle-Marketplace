import { Router } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";
import { profileService } from "../services/profile.service.js";
import { CommerceValidationError } from "../lib/commerce.errors.js";

export const profileRouter = Router();

// ── In-memory size profiles & saved looks ────────────────────────────────────

interface SizeProfile {
  id: string;
  userId: string;
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  inseam: number | null;
  shoulder: number | null;
  topSize: string | null;
  bottomSize: string | null;
  dressSize: string | null;
  shoeSize: string | null;
  fitPreference: "SLIM" | "REGULAR" | "RELAXED" | null;
  notes: string | null;
  updatedAt: string;
}

interface SavedLook {
  id: string;
  userId: string;
  outfitId: string;
  outfitName: string;
  imageUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
  savedAt: string;
}

const sizeProfiles: SizeProfile[] = [];
const savedLooks: SavedLook[] = [];

profileRouter.use(authenticate);

// GET /api/profile
profileRouter.get("/", async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user!.id);
    res.json({ data: profile });
  } catch (err) {
    console.error("[Profile] GET", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/profile
profileRouter.put("/", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const profile = await profileService.updateProfile(req.user!.id, {
      ...(body.name      !== undefined && { name:      typeof body.name      === "string" ? body.name      : undefined }),
      ...(body.phone     !== undefined && { phone:     typeof body.phone     === "string" ? body.phone     : null      }),
      ...(body.avatarUrl !== undefined && { avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null      }),
    });
    res.json({ data: profile });
  } catch (err) {
    if (err instanceof CommerceValidationError) {
      res.status(400).json({ message: err.message });
      return;
    }
    console.error("[Profile] PUT", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Size Profile ──────────────────────────────────────────────────────────────

// GET /api/profile/size
profileRouter.get("/size", async (req, res) => {
  try {
    const sp = sizeProfiles.find((p) => p.userId === req.user!.id);
    res.json({ data: sp ?? null });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/profile/size — upsert
profileRouter.put("/size", async (req, res) => {
  try {
    const body = req.body as Partial<Omit<SizeProfile, "id" | "userId" | "updatedAt">>;
    const existing = sizeProfiles.find((p) => p.userId === req.user!.id);
    if (existing) {
      Object.assign(existing, body, { updatedAt: new Date().toISOString() });
      return res.json({ data: existing });
    }
    const sp: SizeProfile = {
      id: randomUUID(),
      userId: req.user!.id,
      height: body.height ?? null,
      weight: body.weight ?? null,
      chest: body.chest ?? null,
      waist: body.waist ?? null,
      hips: body.hips ?? null,
      inseam: body.inseam ?? null,
      shoulder: body.shoulder ?? null,
      topSize: body.topSize ?? null,
      bottomSize: body.bottomSize ?? null,
      dressSize: body.dressSize ?? null,
      shoeSize: body.shoeSize ?? null,
      fitPreference: body.fitPreference ?? null,
      notes: body.notes ?? null,
      updatedAt: new Date().toISOString(),
    };
    sizeProfiles.push(sp);
    return res.json({ data: sp });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Saved Looks ───────────────────────────────────────────────────────────────

// GET /api/profile/saved-looks
profileRouter.get("/saved-looks", async (req, res) => {
  try {
    const list = savedLooks.filter((l) => l.userId === req.user!.id);
    list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/profile/saved-looks
profileRouter.post("/saved-looks", async (req, res) => {
  try {
    const { outfitId, outfitName, imageUrl, screenshotUrl, notes } = req.body as {
      outfitId?: string;
      outfitName?: string;
      imageUrl?: string;
      screenshotUrl?: string;
      notes?: string;
    };
    if (!outfitId?.trim()) return res.status(400).json({ error: "outfitId is required" });
    const look: SavedLook = {
      id: randomUUID(),
      userId: req.user!.id,
      outfitId: outfitId.trim(),
      outfitName: outfitName ?? outfitId,
      imageUrl: imageUrl ?? null,
      screenshotUrl: screenshotUrl ?? null,
      notes: notes ?? null,
      savedAt: new Date().toISOString(),
    };
    savedLooks.unshift(look);
    return res.status(201).json({ data: look });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/profile/saved-looks/:id
profileRouter.delete("/saved-looks/:id", async (req, res) => {
  try {
    const idx = savedLooks.findIndex((l) => l.id === req.params.id && l.userId === req.user!.id);
    if (idx < 0) return res.status(404).json({ error: "Not found" });
    savedLooks.splice(idx, 1);
    return res.json({ data: { message: "Deleted" } });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});
