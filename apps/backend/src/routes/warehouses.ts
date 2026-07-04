import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { warehouseService } from "../services/warehouse.service.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";

export const warehousesRouter = Router();

function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CommerceNotFoundError)   { res.status(404).json({ error: err.message }); return; }
  if (err instanceof CommerceValidationError) { res.status(400).json({ error: err.message }); return; }
  next(err);
}

// GET /api/warehouses — list all active warehouses (public)
warehousesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const warehouses = await warehouseService.list(includeInactive);
    return res.status(200).json({ data: warehouses });
  } catch (err) { return next(err); }
});

// GET /api/warehouses/:id — get single warehouse (public)
warehousesRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wh = await warehouseService.get(req.params.id as string);
    return res.status(200).json({ data: wh });
  } catch (err) { handleError(err, res, next); }
});

// POST /api/warehouses — create warehouse (ADMIN)
warehousesRouter.post(
  "/",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wh = await warehouseService.create(req.body);
      return res.status(201).json({ data: wh });
    } catch (err) { handleError(err, res, next); }
  }
);

// PATCH /api/warehouses/:id — update warehouse (ADMIN)
warehousesRouter.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wh = await warehouseService.update(req.params.id as string, req.body);
      return res.status(200).json({ data: wh });
    } catch (err) { handleError(err, res, next); }
  }
);
