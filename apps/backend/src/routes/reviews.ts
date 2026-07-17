import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { prisma } from "../lib/prisma.js";
import { getDemoReviews } from "../data/demo-content.js";

export const reviewsRouter = Router();

const REVIEW_INCLUDE = {
  user: { select: { name: true as const, profile: { select: { avatarUrl: true as const } } } },
  images: { orderBy: { sortOrder: "asc" as const } },
};

type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: {
    user: { select: { name: true; profile: { select: { avatarUrl: true } } } };
    images: { orderBy: { sortOrder: "asc" } };
  };
}>;

const ADMIN_REVIEW_INCLUDE = {
  user: { select: { id: true as const, name: true as const, email: true as const, profile: { select: { avatarUrl: true as const } } } },
  product: { select: { id: true as const, movieName: true as const, imageUrl: true as const } },
  images: { orderBy: { sortOrder: "asc" as const } },
};

type AdminReviewWithRelations = Prisma.ReviewGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; profile: { select: { avatarUrl: true } } } };
    product: { select: { id: true; movieName: true; imageUrl: true } };
    images: { orderBy: { sortOrder: "asc" } };
  };
}>;

function toAdminPublic(r: AdminReviewWithRelations) {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isApproved: r.isApproved,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt,
    user: { id: r.user.id, name: r.user.name, email: r.user.email },
    product: { id: r.product.id, movieName: r.product.movieName, imageUrl: r.product.imageUrl },
  };
}

function toPublic(r: ReviewWithRelations, helpful = false) {
  return {
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    userAvatar: r.user.profile?.avatarUrl ?? null,
    productId: r.productId,
    orderId: r.orderId,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.isVerifiedPurchase,
    images: r.images,
    helpfulCount: r.helpfulCount,
    helpful,
    status: r.isApproved ? "APPROVED" : "PENDING",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function optionalUserId(req: Request): Promise<string | undefined> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return undefined;
  try {
    const { verifyAccessToken } = await import("../auth/token.service.js");
    const p = await verifyAccessToken(auth.slice(7));
    return (p as { sub?: string }).sub;
  } catch {
    return undefined;
  }
}

// GET /api/reviews/pending — must come before /:id
reviewsRouter.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviews = await prisma.review.findMany({
        where: { deletedAt: null },
        include: ADMIN_REVIEW_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json({ data: reviews.map((r) => toAdminPublic(r as AdminReviewWithRelations)) });
    } catch (err) { next(err); }
  }
);

// GET /api/reviews/outfit/:outfitId
reviewsRouter.get("/outfit/:outfitId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const requestingUserId = await optionalUserId(req);
      const productId = req.params.outfitId as string;

      const where: Prisma.ReviewWhereInput = { productId, isApproved: true, deletedAt: null };

      let reviews: unknown[] = [];
      let total = 0;
      let avgRating: number | null = null;

      try {
        const [dbReviews, dbTotal, aggregate] = await Promise.all([
          prisma.review.findMany({
            where,
            include: REVIEW_INCLUDE,
            orderBy: { createdAt: "desc" },
            skip: offset,
            take: limit,
          }),
          prisma.review.count({ where }),
          prisma.review.aggregate({ where, _avg: { rating: true } }),
        ]);

        let helpfulSet = new Set<string>();
        if (requestingUserId && dbReviews.length > 0) {
          const ids = dbReviews.map((r) => r.id);
          const votes = await prisma.reviewHelpful.findMany({
            where: { userId: requestingUserId, reviewId: { in: ids } },
            select: { reviewId: true },
          });
          helpfulSet = new Set(votes.map((v) => v.reviewId));
        }

        reviews = dbReviews.map((r) => toPublic(r as ReviewWithRelations, helpfulSet.has(r.id)));
        total = dbTotal;
        avgRating = aggregate._avg?.rating ?? null;
      } catch { /* DB unavailable */ }

      // Fallback to demo reviews when DB is empty or unavailable
      if (reviews.length === 0) {
        const demo = getDemoReviews(productId);
        total = demo.length;
        avgRating = demo.reduce((s, r) => s + r.rating, 0) / (demo.length || 1);
        reviews = demo.slice(offset, offset + limit);
      }

      return res.status(200).json({
        data: { reviews, total, average: avgRating, offset, limit },
      });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews
reviewsRouter.post("/", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { outfitId, orderId, rating, title, body, images } = req.body as {
        outfitId?: string;
        orderId?: string;
        rating?: number;
        title?: string;
        body?: string;
        images?: string[];
      };
      if (!outfitId?.trim()) return res.status(400).json({ error: "outfitId is required" });
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be 1–5" });
      if (!body?.trim()) return res.status(400).json({ error: "body is required" });

      // Resolve slug → cuid: the frontend sends outfit slugs, DB FK needs the cuid primary key
      const product = await prisma.product.findFirst({
        where: { OR: [{ id: outfitId.trim() }, { slug: outfitId.trim() }] },
        select: { id: true },
      });
      if (!product) return res.status(404).json({ error: "Product not found" });
      const resolvedProductId = product.id;

      const existing = await prisma.review.findUnique({
        where: { userId_productId: { userId: req.user!.id, productId: resolvedProductId } },
      });
      if (existing) return res.status(409).json({ error: "You have already reviewed this product" });

      const imageList = Array.isArray(images) ? images.slice(0, 5) : [];
      const review = await prisma.review.create({
        data: {
          userId: req.user!.id,
          productId: resolvedProductId,
          orderId: orderId ?? null,
          rating: Math.round(rating),
          title: title?.trim() ?? null,
          body: body.trim(),
          isVerifiedPurchase: !!orderId,
          isApproved: true,
          images: imageList.length > 0
            ? { create: imageList.map((url, i) => ({ url, sortOrder: i })) }
            : undefined,
        },
        include: REVIEW_INCLUDE,
      });
      return res.status(201).json({ data: toPublic(review as ReviewWithRelations, false) });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews/:id/helpful — toggle
reviewsRouter.post("/:id/helpful", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await prisma.review.findFirst({
        where: { id: req.params.id as string, isApproved: true, deletedAt: null },
      });
      if (!review) return res.status(404).json({ error: "Review not found" });

      const existing = await prisma.reviewHelpful.findUnique({
        where: { reviewId_userId: { reviewId: review.id, userId: req.user!.id } },
      });
      if (existing) {
        await prisma.$transaction([
          prisma.reviewHelpful.delete({ where: { reviewId_userId: { reviewId: review.id, userId: req.user!.id } } }),
          prisma.review.update({ where: { id: review.id }, data: { helpfulCount: { decrement: 1 } } }),
        ]);
        return res.status(200).json({ data: { helpful: false, helpfulCount: Math.max(0, review.helpfulCount - 1) } });
      }
      await prisma.$transaction([
        prisma.reviewHelpful.create({ data: { reviewId: review.id, userId: req.user!.id } }),
        prisma.review.update({ where: { id: review.id }, data: { helpfulCount: { increment: 1 } } }),
      ]);
      return res.status(200).json({ data: { helpful: true, helpfulCount: review.helpfulCount + 1 } });
    } catch (err) { next(err); }
  }
);

// DELETE /api/reviews/:id
reviewsRouter.delete("/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = await prisma.review.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
      if (!review) return res.status(404).json({ error: "Review not found" });

      const isAdmin = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (review.userId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });

      await prisma.review.update({ where: { id: review.id }, data: { deletedAt: new Date() } });
      return res.status(200).json({ data: { message: "Review deleted" } });
    } catch (err) { next(err); }
  }
);

// PATCH /api/reviews/:id/status — ADMIN
reviewsRouter.patch("/:id/status", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body as { status?: string };
      if (!["APPROVED", "REJECTED"].includes(status ?? "")) {
        return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
      }
      const review = await prisma.review.update({
        where: { id: req.params.id as string },
        data: {
          isApproved: status === "APPROVED",
          ...(status === "APPROVED" ? { approvedAt: new Date(), approvedById: req.user!.id } : {}),
        },
        include: REVIEW_INCLUDE,
      });
      return res.status(200).json({ data: toPublic(review as ReviewWithRelations) });
    } catch (err) { next(err); }
  }
);
