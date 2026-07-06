import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

export const communityRouter = Router();

// ── In-memory store ─────────────────────────────────────────────────────────

interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  body: string;
  likes: string[];
  createdAt: string;
}

interface CommunityReport {
  id: string;
  userId: string;
  reason: string;
  createdAt: string;
}

interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  caption: string;
  imageUrl: string | null;
  outfitId: string | null;
  outfitName: string | null;
  tags: string[];
  likes: string[];
  comments: CommunityComment[];
  shares: number;
  reports: CommunityReport[];
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  contestEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FanRating {
  id: string;
  userId: string;
  userName: string;
  celebrityId: string;
  rating: number;
  review: string | null;
  createdAt: string;
}

const posts: CommunityPost[] = [];
const fanRatings: FanRating[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPublicPost(post: CommunityPost, requestingUserId?: string) {
  return {
    id: post.id,
    userId: post.userId,
    userName: post.userName,
    userAvatar: post.userAvatar,
    caption: post.caption,
    imageUrl: post.imageUrl,
    outfitId: post.outfitId,
    outfitName: post.outfitName,
    tags: post.tags,
    likeCount: post.likes.length,
    liked: requestingUserId ? post.likes.includes(requestingUserId) : false,
    commentCount: post.comments.length,
    shares: post.shares,
    reportCount: post.reports.length,
    status: post.status,
    contestEntry: post.contestEntry,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function trendingScore(post: CommunityPost): number {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  const decay = Math.max(0.1, 1 - ageHours / (7 * 24));
  return (post.likes.length * 2 + post.comments.length + post.shares) * decay;
}

// ── POST CRUD ────────────────────────────────────────────────────────────────

// POST /api/community/posts — create
communityRouter.post("/posts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caption, imageUrl, outfitId, outfitName, tags, contestEntry } = req.body as {
        caption?: string;
        imageUrl?: string;
        outfitId?: string;
        outfitName?: string;
        tags?: string[];
        contestEntry?: boolean;
      };
      if (!caption?.trim()) {
        return res.status(400).json({ error: "caption is required" });
      }
      const now = new Date().toISOString();
      const post: CommunityPost = {
        id: randomUUID(),
        userId: req.user!.id,
        userName: req.user!.email.split("@")[0],
        userAvatar: null,
        caption: caption.trim(),
        imageUrl: imageUrl ?? null,
        outfitId: outfitId ?? null,
        outfitName: outfitName ?? null,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        likes: [],
        comments: [],
        shares: 0,
        reports: [],
        status: "ACTIVE",
        contestEntry: contestEntry === true,
        createdAt: now,
        updatedAt: now,
      };
      posts.unshift(post);
      return res.status(201).json({ data: toPublicPost(post, req.user!.id) });
    } catch (err) { next(err); }
  }
);

// GET /api/community/posts — feed (paginated)
communityRouter.get("/posts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit)  || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const tag    = req.query.tag as string | undefined;
      const userId = req.query.userId as string | undefined;

      // Try to extract requesting user from Authorization header (optional)
      let requestingUserId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const { verifyAccessToken } = await import("../auth/token.service.js");
          const payload = verifyAccessToken(authHeader.slice(7));
          requestingUserId = (payload as { sub?: string }).sub;
        } catch { /* not authenticated — ok */ }
      }

      let feed = posts.filter((p) => p.status === "ACTIVE");
      if (tag) feed = feed.filter((p) => p.tags.includes(tag));
      if (userId) feed = feed.filter((p) => p.userId === userId);

      const total = feed.length;
      const page  = feed.slice(offset, offset + limit).map((p) => toPublicPost(p, requestingUserId));
      return res.status(200).json({ data: { posts: page, total, offset, limit } });
    } catch (err) { next(err); }
  }
);

// GET /api/community/posts/trending
communityRouter.get("/posts/trending",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const ranked = posts
        .filter((p) => p.status === "ACTIVE")
        .map((p) => ({ post: p, score: trendingScore(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => toPublicPost(r.post));
      return res.status(200).json({ data: ranked });
    } catch (err) { next(err); }
  }
);

// GET /api/community/posts/contest
communityRouter.get("/posts/contest",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const entries = posts
        .filter((p) => p.status === "ACTIVE" && p.contestEntry)
        .sort((a, b) => b.likes.length - a.likes.length)
        .slice(0, limit)
        .map((p) => toPublicPost(p));
      return res.status(200).json({ data: entries });
    } catch (err) { next(err); }
  }
);

// GET /api/community/posts/:id
communityRouter.get("/posts/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "DELETED") {
        return res.status(404).json({ error: "Post not found" });
      }
      return res.status(200).json({ data: toPublicPost(post) });
    } catch (err) { next(err); }
  }
);

// PATCH /api/community/posts/:id — update caption/tags (owner or mod)
communityRouter.patch("/posts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id);
      if (!post || post.status === "DELETED") {
        return res.status(404).json({ error: "Post not found" });
      }
      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (post.userId !== req.user!.id && !isMod) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { caption, tags, status } = req.body as { caption?: string; tags?: string[]; status?: string };
      if (caption?.trim()) post.caption = caption.trim();
      if (Array.isArray(tags)) post.tags = tags.slice(0, 10);
      if (isMod && status && ["ACTIVE", "HIDDEN"].includes(status)) {
        post.status = status as "ACTIVE" | "HIDDEN";
      }
      post.updatedAt = new Date().toISOString();
      return res.status(200).json({ data: toPublicPost(post, req.user!.id) });
    } catch (err) { next(err); }
  }
);

// DELETE /api/community/posts/:id — owner or mod
communityRouter.delete("/posts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (post.userId !== req.user!.id && !isMod) {
        return res.status(403).json({ error: "Forbidden" });
      }
      post.status = "DELETED";
      post.updatedAt = new Date().toISOString();
      return res.status(200).json({ data: { message: "Post deleted" } });
    } catch (err) { next(err); }
  }
);

// ── LIKES ────────────────────────────────────────────────────────────────────

// POST /api/community/posts/:id/like — toggle
communityRouter.post("/posts/:id/like", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id && p.status === "ACTIVE");
      if (!post) return res.status(404).json({ error: "Post not found" });
      const uid = req.user!.id;
      const idx = post.likes.indexOf(uid);
      if (idx >= 0) {
        post.likes.splice(idx, 1);
        return res.status(200).json({ data: { liked: false, likeCount: post.likes.length } });
      }
      post.likes.push(uid);
      return res.status(200).json({ data: { liked: true, likeCount: post.likes.length } });
    } catch (err) { next(err); }
  }
);

// ── COMMENTS ─────────────────────────────────────────────────────────────────

// GET /api/community/posts/:id/comments
communityRouter.get("/posts/:id/comments",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id && p.status !== "DELETED");
      if (!post) return res.status(404).json({ error: "Post not found" });
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const page   = post.comments.slice(offset, offset + limit);
      return res.status(200).json({ data: { comments: page, total: post.comments.length } });
    } catch (err) { next(err); }
  }
);

// POST /api/community/posts/:id/comments
communityRouter.post("/posts/:id/comments", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id && p.status === "ACTIVE");
      if (!post) return res.status(404).json({ error: "Post not found" });
      const { body } = req.body as { body?: string };
      if (!body?.trim()) return res.status(400).json({ error: "body is required" });
      const comment: CommunityComment = {
        id: randomUUID(),
        postId: post.id,
        userId: req.user!.id,
        userName: req.user!.email.split("@")[0],
        body: body.trim(),
        likes: [],
        createdAt: new Date().toISOString(),
      };
      post.comments.push(comment);
      post.updatedAt = new Date().toISOString();
      return res.status(201).json({ data: comment });
    } catch (err) { next(err); }
  }
);

// DELETE /api/community/posts/:postId/comments/:commentId — owner or mod
communityRouter.delete("/posts/:postId/comments/:commentId", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });
      const idx = post.comments.findIndex((c) => c.id === req.params.commentId);
      if (idx < 0) return res.status(404).json({ error: "Comment not found" });
      const comment = post.comments[idx]!;
      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (comment.userId !== req.user!.id && post.userId !== req.user!.id && !isMod) {
        return res.status(403).json({ error: "Forbidden" });
      }
      post.comments.splice(idx, 1);
      return res.status(200).json({ data: { message: "Comment deleted" } });
    } catch (err) { next(err); }
  }
);

// ── SHARES ────────────────────────────────────────────────────────────────────

// POST /api/community/posts/:id/share
communityRouter.post("/posts/:id/share", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id && p.status === "ACTIVE");
      if (!post) return res.status(404).json({ error: "Post not found" });
      post.shares++;
      return res.status(200).json({ data: { shares: post.shares } });
    } catch (err) { next(err); }
  }
);

// ── REPORTS ───────────────────────────────────────────────────────────────────

// POST /api/community/posts/:id/report
communityRouter.post("/posts/:id/report", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id && p.status === "ACTIVE");
      if (!post) return res.status(404).json({ error: "Post not found" });
      const { reason } = req.body as { reason?: string };
      if (!reason?.trim()) return res.status(400).json({ error: "reason is required" });
      const alreadyReported = post.reports.some((r) => r.userId === req.user!.id);
      if (alreadyReported) return res.status(409).json({ error: "Already reported" });
      post.reports.push({ id: randomUUID(), userId: req.user!.id, reason: reason.trim(), createdAt: new Date().toISOString() });
      // Auto-hide if 5+ unique reports
      if (post.reports.length >= 5) post.status = "HIDDEN";
      return res.status(200).json({ data: { message: "Report submitted" } });
    } catch (err) { next(err); }
  }
);

// ── MODERATION ────────────────────────────────────────────────────────────────

// GET /api/community/moderation — ADMIN/MOD: list reported/hidden posts
communityRouter.get("/moderation", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flagged = posts
        .filter((p) => p.status === "HIDDEN" || p.reports.length > 0)
        .map((p) => ({
          ...toPublicPost(p),
          reports: p.reports,
        }));
      return res.status(200).json({ data: flagged });
    } catch (err) { next(err); }
  }
);

// PATCH /api/community/moderation/:id — approve (un-hide) or remove
communityRouter.patch("/moderation/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      const { action } = req.body as { action?: "approve" | "remove" };
      if (action === "approve") {
        post.status = "ACTIVE";
        post.reports = [];
      } else if (action === "remove") {
        post.status = "DELETED";
      } else {
        return res.status(400).json({ error: "action must be 'approve' or 'remove'" });
      }
      post.updatedAt = new Date().toISOString();
      return res.status(200).json({ data: { message: `Post ${action}d`, post: toPublicPost(post) } });
    } catch (err) { next(err); }
  }
);

// ── FAN RATINGS ───────────────────────────────────────────────────────────────

// GET /api/community/fan-ratings/:celebrityId
communityRouter.get("/fan-ratings/:celebrityId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ratings = fanRatings.filter((r) => r.celebrityId === req.params.celebrityId);
      const avg = ratings.length
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : null;
      return res.status(200).json({ data: { ratings, average: avg, count: ratings.length } });
    } catch (err) { next(err); }
  }
);

// POST /api/community/fan-ratings/:celebrityId — upsert rating
communityRouter.post("/fan-ratings/:celebrityId", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rating, review } = req.body as { rating?: number; review?: string };
      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "rating must be between 1 and 5" });
      }
      const existing = fanRatings.find(
        (r) => r.celebrityId === req.params.celebrityId && r.userId === req.user!.id
      );
      if (existing) {
        existing.rating = Math.round(rating);
        existing.review = review?.trim() ?? existing.review;
        return res.status(200).json({ data: existing });
      }
      const entry: FanRating = {
        id: randomUUID(),
        userId: req.user!.id,
        userName: req.user!.email.split("@")[0],
        celebrityId: req.params.celebrityId as string,
        rating: Math.round(rating),
        review: review?.trim() ?? null,
        createdAt: new Date().toISOString(),
      };
      fanRatings.push(entry);
      return res.status(201).json({ data: entry });
    } catch (err) { next(err); }
  }
);
