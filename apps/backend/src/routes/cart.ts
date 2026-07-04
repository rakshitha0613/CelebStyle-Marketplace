import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { cartService } from "../services/cart.service.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
  InsufficientStockError,
} from "../lib/commerce.errors.js";

export const cartRouter = Router();

// All cart routes require authentication
cartRouter.use(authenticate);

function handleError(err: unknown, res: import("express").Response): void {
  if (err instanceof CommerceValidationError) {
    res.status(400).json({ message: err.message });
  } else if (err instanceof CommerceNotFoundError) {
    res.status(404).json({ message: err.message });
  } else if (err instanceof CommerceForbiddenError) {
    res.status(403).json({ message: err.message });
  } else if (err instanceof InsufficientStockError) {
    res.status(409).json({ message: err.message, available: err.available });
  } else {
    console.error("[Cart]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/cart
cartRouter.get("/", async (req, res) => {
  try {
    const cart = await cartService.getCart(req.user!.id);
    res.json({ data: cart });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/cart  (clear entire cart)
cartRouter.delete("/", async (req, res) => {
  try {
    await cartService.clearCart(req.user!.id, req.ip);
    res.status(204).send();
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/cart/items
cartRouter.post("/items", async (req, res) => {
  try {
    const { productSlug, size, color, quantity } = req.body as {
      productSlug?: unknown;
      size?: unknown;
      color?: unknown;
      quantity?: unknown;
    };

    if (typeof productSlug !== "string" || !productSlug) {
      res.status(400).json({ message: "productSlug is required" });
      return;
    }
    if (typeof size !== "string" || !size) {
      res.status(400).json({ message: "size is required" });
      return;
    }
    const qty = typeof quantity === "number" ? quantity : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400).json({ message: "quantity must be a positive integer" });
      return;
    }

    const cart = await cartService.addItem(
      req.user!.id,
      {
        productSlug,
        size,
        color:    typeof color === "string" ? color : undefined,
        quantity: qty,
      },
      req.ip
    );
    res.status(201).json({ data: cart });
  } catch (err) {
    handleError(err, res);
  }
});

// PATCH /api/cart/items/:id
cartRouter.patch("/items/:id", async (req, res) => {
  try {
    const { quantity } = req.body as { quantity?: unknown };
    const qty = typeof quantity === "number" ? quantity : Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      res.status(400).json({ message: "quantity must be a non-negative integer" });
      return;
    }

    const cart = await cartService.updateItem(
      req.user!.id,
      req.params.id as string,
      qty,
      req.ip
    );
    res.json({ data: cart });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/cart/items/:id
cartRouter.delete("/items/:id", async (req, res) => {
  try {
    const cart = await cartService.removeItem(
      req.user!.id,
      req.params.id as string,
      req.ip
    );
    res.json({ data: cart });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/cart/merge
cartRouter.post("/merge", async (req, res) => {
  try {
    const { items } = req.body as { items?: unknown };

    if (!Array.isArray(items)) {
      res.status(400).json({ message: "items must be an array" });
      return;
    }

    const parsed: Array<{ productSlug: string; size: string; color?: string; quantity: number }> = [];
    for (const item of items) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as Record<string, unknown>).productSlug !== "string" ||
        typeof (item as Record<string, unknown>).size !== "string"
      ) {
        res.status(400).json({ message: "Each item must have productSlug (string) and size (string)" });
        return;
      }
      const raw = item as Record<string, unknown>;
      const qty = typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity ?? 1);
      parsed.push({
        productSlug: raw.productSlug as string,
        size:        raw.size as string,
        color:       typeof raw.color === "string" ? raw.color : undefined,
        quantity:    Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
      });
    }

    const result = await cartService.mergeCart(req.user!.id, parsed, req.ip);
    res.json({ data: result });
  } catch (err) {
    handleError(err, res);
  }
});
