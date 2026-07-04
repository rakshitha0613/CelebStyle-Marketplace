import { Router } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { checkoutService } from "../services/checkout.service.js";
import { shippingService } from "../services/shipping.service.js";
import { couponService } from "../services/coupon.service.js";
import { taxService } from "../services/tax.service.js";
import { cartService } from "../services/cart.service.js";
import {
  CheckoutError,
  CommerceNotFoundError,
  CommerceForbiddenError,
  InsufficientStockError,
} from "../lib/commerce.errors.js";

export const checkoutRouter = Router();

checkoutRouter.use(authenticate);

function handleError(err: unknown, res: import("express").Response): void {
  if (err instanceof CheckoutError) {
    res.status(422).json({ message: err.message, code: err.code });
  } else if (err instanceof CommerceNotFoundError) {
    res.status(404).json({ message: err.message });
  } else if (err instanceof CommerceForbiddenError) {
    res.status(403).json({ message: err.message });
  } else if (err instanceof InsufficientStockError) {
    res.status(409).json({ message: err.message, available: err.available });
  } else {
    console.error("[Checkout]", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// GET /api/checkout/shipping
checkoutRouter.get("/shipping", async (req, res) => {
  try {
    const cart = await cartService.getCart(req.user!.id);
    const pincode = typeof req.query.pincode === "string" ? req.query.pincode : undefined;
    const quote   = await shippingService.calculate(cart.subtotalPaise, pincode);
    res.json({ data: quote });
  } catch (err) {
    handleError(err, res);
  }
});

// GET /api/checkout/tax
checkoutRouter.get("/tax", async (req, res) => {
  try {
    const cart = await cartService.getCart(req.user!.id);
    if (cart.items.length === 0) {
      res.status(422).json({ message: "Cart is empty", code: "CART_EMPTY" });
      return;
    }
    const avgUnitPrice = Math.round(cart.subtotalPaise / cart.itemCount);
    const buyerState   = typeof req.query.state === "string" ? req.query.state : undefined;
    const breakdown    = taxService.calculate(cart.subtotalPaise, buyerState, avgUnitPrice);
    res.json({ data: breakdown });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/checkout/coupon/apply
checkoutRouter.post("/coupon/apply", async (req, res) => {
  try {
    const body = req.body as { code?: unknown };
    if (typeof body.code !== "string" || !body.code.trim()) {
      res.status(400).json({ message: "code is required" });
      return;
    }
    const cart   = await cartService.getCart(req.user!.id);
    const quote  = await shippingService.calculate(cart.subtotalPaise);
    const result = await couponService.validate(
      body.code,
      req.user!.id,
      cart.subtotalPaise,
      quote.ratePaise,
      cart.items.map((i) => ({ productId: i.productSlug, quantity: i.quantity, totalPricePaise: i.totalPricePaise }))
    );
    res.json({ data: result });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/checkout/preview
checkoutRouter.post("/preview", async (req, res) => {
  try {
    const body    = req.body as { couponCode?: unknown; addressId?: unknown };
    const preview = await checkoutService.preview(req.user!.id, {
      couponCode: typeof body.couponCode === "string" ? body.couponCode : undefined,
      addressId:  typeof body.addressId  === "string" ? body.addressId  : undefined,
    });
    res.json({ data: preview });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/checkout/confirm
checkoutRouter.post("/confirm", async (req, res) => {
  try {
    const body = req.body as { addressId?: unknown; couponCode?: unknown; idempotencyKey?: unknown };

    if (typeof body.addressId !== "string" || !body.addressId.trim()) {
      res.status(400).json({ message: "addressId is required" });
      return;
    }

    // Accept idempotency key from body or header
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : typeof req.headers["x-idempotency-key"] === "string"
          ? req.headers["x-idempotency-key"]
          : undefined;

    const result = await checkoutService.confirm(
      req.user!.id,
      req.user!.email,
      {
        addressId:      body.addressId.trim(),
        couponCode:     typeof body.couponCode === "string" ? body.couponCode : undefined,
        idempotencyKey,
      },
      req.ip
    );

    res.status(result.isIdempotentRepeat ? 200 : 201).json({ data: result });
  } catch (err) {
    handleError(err, res);
  }
});
