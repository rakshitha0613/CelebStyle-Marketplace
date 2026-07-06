import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../auth/middleware/authenticate.js";
import { profileService } from "../services/profile.service.js";
import { CommerceValidationError } from "../lib/commerce.errors.js";
import { prisma } from "../lib/prisma.js";

export const profileRouter = Router();

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

profileRouter.get("/size", async (req, res) => {
  try {
    const sp = await prisma.sizeProfile.findUnique({ where: { userId: req.user!.id } });
    res.json({ data: sp ?? null });
  } catch (err) {
    console.error("[Profile] GET /size", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

profileRouter.put("/size", async (req, res) => {
  try {
    const body = req.body as {
      height?: number | null;
      weight?: number | null;
      chest?: number | null;
      waist?: number | null;
      hips?: number | null;
      shoulderWidth?: number | null;
      inseam?: number | null;
      bodyType?: string | null;
      sizeChart?: Prisma.InputJsonValue | null;
      notes?: string | null;
    };

    const data = {
      height:        body.height        ?? null,
      weight:        body.weight        ?? null,
      chest:         body.chest         ?? null,
      waist:         body.waist         ?? null,
      hips:          body.hips          ?? null,
      shoulderWidth: body.shoulderWidth ?? null,
      inseam:        body.inseam        ?? null,
      bodyType:      body.bodyType      ?? null,
      sizeChart:     body.sizeChart     ?? undefined,
      lastMeasuredAt: new Date(),
    };

    const sp = await prisma.sizeProfile.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });
    return res.json({ data: sp });
  } catch (err) {
    console.error("[Profile] PUT /size", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Saved Looks ───────────────────────────────────────────────────────────────

profileRouter.get("/saved-looks", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const [list, total] = await Promise.all([
      prisma.savedLook.findMany({
        where: { userId: req.user!.id },
        orderBy: { savedAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.savedLook.count({ where: { userId: req.user!.id } }),
    ]);
    res.json({ data: { looks: list, total, offset, limit } });
  } catch (err) {
    console.error("[Profile] GET /saved-looks", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

profileRouter.post("/saved-looks", async (req, res) => {
  try {
    const { outfitId, outfitName, imageUrl, screenshotUrl, notes } = req.body as {
      outfitId?: string;
      outfitName?: string;
      imageUrl?: string;
      screenshotUrl?: string;
      notes?: string;
    };
    if (!outfitName?.trim()) return res.status(400).json({ error: "outfitName is required" });
    const look = await prisma.savedLook.create({
      data: {
        userId:        req.user!.id,
        productId:     outfitId?.trim() ?? null,
        outfitName:    outfitName.trim(),
        imageUrl:      imageUrl      ?? null,
        screenshotUrl: screenshotUrl ?? null,
        notes:         notes         ?? null,
      },
    });
    return res.status(201).json({ data: look });
  } catch (err) {
    console.error("[Profile] POST /saved-looks", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

profileRouter.delete("/saved-looks/:id", async (req, res) => {
  try {
    const look = await prisma.savedLook.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!look) return res.status(404).json({ error: "Not found" });
    await prisma.savedLook.delete({ where: { id: req.params.id } });
    return res.json({ data: { message: "Deleted" } });
  } catch (err) {
    console.error("[Profile] DELETE /saved-looks/:id", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
