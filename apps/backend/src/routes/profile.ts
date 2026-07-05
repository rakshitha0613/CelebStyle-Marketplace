import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { profileService } from "../services/profile.service.js";
import { CommerceValidationError } from "../lib/commerce.errors.js";

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
