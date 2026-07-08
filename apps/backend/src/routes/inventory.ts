import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { inventoryService } from "../services/inventory.service.js";
import { stockMovementService } from "../services/stock-movement.service.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";

export const inventoryRouter = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)   { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceValidationError) { res.status(400).json({ error: err.message }); return; }
  next(err);
}

// GET /api/inventory/admin — all inventory for admin panel
inventoryRouter.get(
  "/admin",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { prisma } = await import("../lib/prisma.js");
      const items = await prisma.inventory.findMany({
        orderBy: [{ product: { movieName: "asc" } }, { variant: { size: "asc" } }],
        select: {
          id: true,
          quantity: true,
          lowStockThreshold: true,
          reservedQuantity: true,
          product: { select: { id: true, movieName: true, imageUrl: true, basePrice: true } },
          variant: { select: { id: true, size: true, color: true, sku: true } },
          warehouse: { select: { id: true, name: true, city: true } },
        },
      });
      return res.status(200).json({ data: items });
    } catch (err) { return next(err); }
  }
);

// GET /api/inventory/product/:productId — inventory levels by product (public)
inventoryRouter.get(
  "/product/:productId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await inventoryService.getForProduct(req.params.productId as string);
      return res.status(200).json({ data });
    } catch (err) { return next(err); }
  }
);

// GET /api/inventory/variant/:variantId/available — available count (public)
inventoryRouter.get(
  "/variant/:variantId/available",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const available = await inventoryService.getAvailableForVariant(req.params.variantId as string);
      return res.status(200).json({ data: { variantId: req.params.variantId, available } });
    } catch (err) { return next(err); }
  }
);

// POST /api/inventory/adjust — manual stock adjustment (ADMIN)
inventoryRouter.post(
  "/adjust",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, variantId, delta, notes } = req.body as {
        warehouseId?: string;
        variantId?:   string;
        delta?:       number;
        notes?:       string;
      };
      if (!warehouseId || !variantId || delta === undefined) {
        return res.status(400).json({ error: "warehouseId, variantId, and delta are required" });
      }
      const updated = await inventoryService.adjust(
        warehouseId, variantId, delta, notes, req.user!.id
      );
      return res.status(200).json({ data: updated });
    } catch (err) { handleError(err, res, next); }
  }
);

// POST /api/inventory/restock — inbound restock (ADMIN)
inventoryRouter.post(
  "/restock",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, variantId, productId, quantity, notes } = req.body as {
        warehouseId?: string;
        variantId?:   string;
        productId?:   string;
        quantity?:    number;
        notes?:       string;
      };
      if (!warehouseId || !variantId || !productId || !quantity) {
        return res.status(400).json({ error: "warehouseId, variantId, productId, and quantity are required" });
      }
      const updated = await inventoryService.restock(
        warehouseId, variantId, productId, quantity, notes, req.user!.id
      );
      return res.status(200).json({ data: updated });
    } catch (err) { handleError(err, res, next); }
  }
);

// GET /api/inventory/movements/:inventoryId — movement history (ADMIN)
inventoryRouter.get(
  "/movements/:inventoryId",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const movements = await stockMovementService.getForInventory(req.params.inventoryId as string, limit);
      return res.status(200).json({ data: movements });
    } catch (err) { return next(err); }
  }
);

// GET /api/inventory/order/:orderId/movements — movements for an order (auth)
inventoryRouter.get(
  "/order/:orderId/movements",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const movements = await stockMovementService.getForOrder(req.params.orderId as string);
      return res.status(200).json({ data: movements });
    } catch (err) { return next(err); }
  }
);
