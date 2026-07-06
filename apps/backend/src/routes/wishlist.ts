import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { wishlistService } from "../services/wishlist.service.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
} from "../lib/commerce.errors.js";
import { invalidateUserRecommendationsCache } from "../services/recommendation.service.js";

export const wishlistRouter = Router();

// ── In-memory wishlist privacy settings ──────────────────────────────────────
const wishlistPrivacy: Record<string, boolean> = {}; // userId → isPublic

wishlistRouter.use(authenticate);

function handleError(err: unknown, res: import("express").Response): void {
  if (err instanceof CommerceValidationError) {
    res.status(400).json({ message: err.message });
  } else if (err instanceof CommerceNotFoundError) {
    res.status(404).json({ message: err.message });
  } else if (err instanceof CommerceForbiddenError) {
    res.status(403).json({ message: err.message });
  } else {
    console.error("[Wishlist]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/wishlist
wishlistRouter.get("/", async (req, res) => {
  try {
    const items = await wishlistService.getItems(req.user!.id);
    res.json({ data: items });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/wishlist
wishlistRouter.post("/", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const productId =
      typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      res.status(400).json({ message: "productId is required" });
      return;
    }
    const item = await wishlistService.addItem(req.user!.id, productId);
    invalidateUserRecommendationsCache(req.user!.id);
    res.status(201).json({ data: item });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/wishlist  — clears all items (empty wishlist)
wishlistRouter.delete("/", async (req, res) => {
  try {
    await wishlistService.clearWishlist(req.user!.id);
    invalidateUserRecommendationsCache(req.user!.id);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/wishlist/:id  — removes a single item
wishlistRouter.delete("/:id", async (req, res) => {
  try {
    await wishlistService.removeItem(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/wishlist/privacy — get current privacy setting
wishlistRouter.get("/privacy", async (req, res) => {
  const isPublic = wishlistPrivacy[req.user!.id] ?? false;
  res.json({ data: { isPublic } });
});

// PATCH /api/wishlist/privacy — toggle public/private
wishlistRouter.patch("/privacy", async (req, res) => {
  const { isPublic } = req.body as { isPublic?: boolean };
  if (typeof isPublic !== "boolean") {
    res.status(400).json({ error: "isPublic must be a boolean" });
    return;
  }
  wishlistPrivacy[req.user!.id] = isPublic;
  res.json({ data: { isPublic } });
});

// GET /api/wishlist/public/:userId — view another user's public wishlist (unauthenticated)
wishlistRouter.get("/public/:userId", async (req, res) => {
  const isPublic = wishlistPrivacy[req.params.userId as string] ?? false;
  if (!isPublic) {
    res.status(403).json({ error: "This wishlist is private" });
    return;
  }
  try {
    const items = await wishlistService.getItems(req.params.userId as string);
    res.json({ data: items });
  } catch (err) {
    handleError(err, res);
  }
});
