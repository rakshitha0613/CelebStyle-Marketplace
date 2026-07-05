import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { wishlistService } from "../services/wishlist.service.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
} from "../lib/commerce.errors.js";

export const wishlistRouter = Router();

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
    res.status(201).json({ data: item });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/wishlist  — clears all items (empty wishlist)
wishlistRouter.delete("/", async (req, res) => {
  try {
    await wishlistService.clearWishlist(req.user!.id);
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
