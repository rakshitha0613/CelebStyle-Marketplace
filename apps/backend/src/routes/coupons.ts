import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

export const couponsRouter = Router();

// All coupon admin routes require ADMIN or SUPER_ADMIN
couponsRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// GET /api/coupons — list all coupons
couponsRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });
    res.json({ data: coupons });
  } catch (err) { next(err); }
});

// GET /api/coupons/:id
couponsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { usages: true } } },
    });
    if (!coupon) { res.status(404).json({ message: "Coupon not found" }); return; }
    res.json({ data: coupon });
  } catch (err) { next(err); }
});

// POST /api/coupons — create coupon
couponsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const {
      code, type, value, minOrderAmount, maxDiscountAmount,
      usageLimit, usageLimitPerUser, startsAt, expiresAt, isActive,
    } = body;

    if (!code || !type || value === undefined) {
      res.status(400).json({ message: "code, type, and value are required" });
      return;
    }

    const coupon = await prisma.coupon.create({
      data: {
        code:               String(code).trim().toUpperCase(),
        type:               String(type) as Prisma.CouponCreateInput["type"],
        value:              Number(value),
        minOrderAmount:     minOrderAmount     !== undefined ? Number(minOrderAmount)     : 0,
        maxDiscountAmount:  maxDiscountAmount  !== undefined ? Number(maxDiscountAmount)  : null,
        usageLimit:         usageLimit         !== undefined ? Number(usageLimit)         : null,
        usageLimitPerUser:  usageLimitPerUser  !== undefined ? Number(usageLimitPerUser)  : 1,
        startsAt:           startsAt           ? new Date(String(startsAt))               : new Date(),
        expiresAt:          expiresAt          ? new Date(String(expiresAt))               : null,
        isActive:           isActive           !== undefined ? Boolean(isActive)           : true,
      },
    });
    res.status(201).json({ data: coupon });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") {
      res.status(409).json({ message: "A coupon with this code already exists" });
      return;
    }
    next(err);
  }
});

// PATCH /api/coupons/:id — update coupon
couponsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Prisma.CouponUpdateInput = {};

    if (body.code             !== undefined) data.code             = String(body.code).trim().toUpperCase();
    if (body.type             !== undefined) data.type             = String(body.type) as Prisma.CouponUpdateInput["type"];
    if (body.value            !== undefined) data.value            = Number(body.value);
    if (body.minOrderAmount   !== undefined) data.minOrderAmount   = Number(body.minOrderAmount);
    if (body.maxDiscountAmount !== undefined) data.maxDiscountAmount = body.maxDiscountAmount !== null ? Number(body.maxDiscountAmount) : null;
    if (body.usageLimit       !== undefined) data.usageLimit       = body.usageLimit !== null ? Number(body.usageLimit) : null;
    if (body.usageLimitPerUser !== undefined) data.usageLimitPerUser = Number(body.usageLimitPerUser);
    if (body.startsAt         !== undefined) data.startsAt         = new Date(String(body.startsAt));
    if (body.expiresAt        !== undefined) data.expiresAt        = body.expiresAt !== null ? new Date(String(body.expiresAt)) : null;
    if (body.isActive         !== undefined) data.isActive         = Boolean(body.isActive);

    const coupon = await prisma.coupon.update({
      where: { id: req.params.id as string },
      data,
    });
    res.json({ data: coupon });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2025") { res.status(404).json({ message: "Coupon not found" }); return; }
    next(err);
  }
});

// DELETE /api/coupons/:id — deactivate (soft delete by setting isActive=false)
couponsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.coupon.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });
    res.json({ message: "Coupon deactivated" });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2025") { res.status(404).json({ message: "Coupon not found" }); return; }
    next(err);
  }
});
