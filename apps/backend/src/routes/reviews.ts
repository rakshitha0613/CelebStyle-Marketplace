import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

export const reviewsRouter = Router();

// ── In-memory store ──────────────────────────────────────────────────────────

interface Review {
  id: string;
  userId: string;
  userName: string;
  outfitId: string;
  orderId: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  images: string[];
  helpfulVotes: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}

const reviews: Review[] = [];

function toPublic(r: Review, requestingUserId?: string) {
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    outfitId: r.outfitId,
    orderId: r.orderId,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    images: r.images,
    helpfulCount: r.helpfulVotes.length,
    helpful: requestingUserId ? r.helpfulVotes.includes(requestingUserId) : false,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// GET /api/reviews/outfit/:outfitId
reviewsRouter.get("/outfit/:outfitId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      let requestingUserId: string | undefined;
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        try {
          const { verifyAccessToken } = await import("../auth/token.service.js");
          const p = verifyAccessToken(auth.slice(7));
          requestingUserId = (p as { sub?: string }).sub;
        } catch { /* ok */ }
      }

      const list = reviews
        .filter((r) => r.outfitId === req.params.outfitId && r.status === "APPROVED");
      const total  = list.length;
      const avg    = total ? list.reduce((s, r) => s + r.rating, 0) / total : null;
      const page   = list.slice(offset, offset + limit).map((r) => toPublic(r, requestingUserId));
      return res.status(200).json({ data: { reviews: page, total, average: avg, offset, limit } });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews — submit review (auth)
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

      // One review per user per outfit
      const existing = reviews.find((r) => r.outfitId === outfitId && r.userId === req.user!.id);
      if (existing) return res.status(409).json({ error: "You have already reviewed this product" });

      const now = new Date().toISOString();
      const review: Review = {
        id: randomUUID(),
        userId: req.user!.id,
        userName: req.user!.email.split("@")[0],
        outfitId: outfitId.trim(),
        orderId: orderId ?? null,
        rating: Math.round(rating),
        title: title?.trim() ?? "",
        body: body.trim(),
        verified: !!orderId,
        images: Array.isArray(images) ? images.slice(0, 5) : [],
        helpfulVotes: [],
        status: "APPROVED",
        createdAt: now,
        updatedAt: now,
      };
      reviews.push(review);
      return res.status(201).json({ data: toPublic(review, req.user!.id) });
    } catch (err) { next(err); }
  }
);

// POST /api/reviews/:id/helpful — toggle helpful vote
reviewsRouter.post("/:id/helpful", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = reviews.find((r) => r.id === req.params.id);
      if (!review || review.status !== "APPROVED") {
        return res.status(404).json({ error: "Review not found" });
      }
      const uid = req.user!.id;
      const idx = review.helpfulVotes.indexOf(uid);
      if (idx >= 0) {
        review.helpfulVotes.splice(idx, 1);
        return res.status(200).json({ data: { helpful: false, helpfulCount: review.helpfulVotes.length } });
      }
      review.helpfulVotes.push(uid);
      return res.status(200).json({ data: { helpful: true, helpfulCount: review.helpfulVotes.length } });
    } catch (err) { next(err); }
  }
);

// DELETE /api/reviews/:id — owner or ADMIN
reviewsRouter.delete("/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idx = reviews.findIndex((r) => r.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: "Review not found" });
      const review = reviews[idx]!;
      const isAdmin = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (review.userId !== req.user!.id && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      reviews.splice(idx, 1);
      return res.status(200).json({ data: { message: "Review deleted" } });
    } catch (err) { next(err); }
  }
);

// GET /api/reviews/pending — ADMIN: moderation queue
reviewsRouter.get("/pending", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pending = reviews.filter((r) => r.status === "PENDING").map((r) => toPublic(r));
      return res.status(200).json({ data: pending });
    } catch (err) { next(err); }
  }
);

// PATCH /api/reviews/:id/status — ADMIN
reviewsRouter.patch("/:id/status", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const review = reviews.find((r) => r.id === req.params.id);
      if (!review) return res.status(404).json({ error: "Review not found" });
      const { status } = req.body as { status?: string };
      if (!["APPROVED", "REJECTED"].includes(status ?? "")) {
        return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
      }
      review.status = status as "APPROVED" | "REJECTED";
      review.updatedAt = new Date().toISOString();
      return res.status(200).json({ data: toPublic(review) });
    } catch (err) { next(err); }
  }
);
