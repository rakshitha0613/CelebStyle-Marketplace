import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { prisma } from "../lib/prisma.js";
import { DEMO_COMMUNITY_POSTS, toPublicDemoPost } from "../data/demo-content.js";

export const communityRouter = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

const POST_INCLUDE = {
  user: { select: { name: true as const, profile: { select: { avatarUrl: true as const } } } },
  images: { orderBy: { sortOrder: "asc" as const } },
};

type PostWithRelations = Prisma.CommunityPostGetPayload<{
  include: {
    user: { select: { name: true; profile: { select: { avatarUrl: true } } } };
    images: { orderBy: { sortOrder: "asc" } };
  };
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPublicPost(
  post: PostWithRelations,
  requestingUserId?: string,
  liked?: boolean,
  bookmarked?: boolean
) {
  return {
    id: post.id,
    userId: post.userId,
    userName: post.user.name,
    userAvatar: post.user.profile?.avatarUrl ?? null,
    caption: post.caption,
    imageUrl: post.images[0]?.url ?? null,
    images: post.images,
    productId: post.productId,
    outfitId: post.productId,
    tags: post.tags,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    liked: liked ?? false,
    bookmarked: bookmarked ?? false,
    contestEntry: post.tags.includes("contest"),
    status: post.isApproved ? "ACTIVE" : "PENDING",
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function enrichWithInteractions(
  posts: PostWithRelations[],
  requestingUserId?: string
) {
  if (!requestingUserId || posts.length === 0) {
    return posts.map((p) => toPublicPost(p, requestingUserId, false, false));
  }
  const ids = posts.map((p) => p.id);
  const [likes, bookmarks] = await Promise.all([
    prisma.like.findMany({ where: { userId: requestingUserId, postId: { in: ids } }, select: { postId: true } }),
    prisma.bookmark.findMany({ where: { userId: requestingUserId, postId: { in: ids } }, select: { postId: true } }),
  ]);
  const likedSet = new Set(likes.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));
  return posts.map((p) =>
    toPublicPost(p, requestingUserId, likedSet.has(p.id), bookmarkedSet.has(p.id))
  );
}

async function optionalUserId(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  try {
    const { verifyAccessToken } = await import("../auth/token.service.js");
    const payload = await verifyAccessToken(authHeader.slice(7));
    return (payload as { sub?: string }).sub;
  } catch {
    return undefined;
  }
}

// ── POST CRUD ─────────────────────────────────────────────────────────────────

communityRouter.post("/posts", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caption, imageUrl, productId: productIdField, outfitId, tags, contestEntry } = req.body as {
        caption?: string;
        imageUrl?: string;
        productId?: string;
        outfitId?: string;
        tags?: string[];
        contestEntry?: boolean;
      };
      const productId = productIdField ?? outfitId;
      if (!caption?.trim()) return res.status(400).json({ error: "caption is required" });

      const resolvedTags = Array.isArray(tags) ? tags.slice(0, 10) : [];
      if (contestEntry && !resolvedTags.includes("contest")) resolvedTags.push("contest");

      // Resolve slug → cuid if productId provided (frontend sends slugs, DB FK needs cuids)
      let resolvedProductId: string | null = null;
      if (productId?.trim()) {
        const product = await prisma.product.findFirst({
          where: { OR: [{ id: productId.trim() }, { slug: productId.trim() }] },
          select: { id: true },
        });
        resolvedProductId = product?.id ?? null;
      }

      const post = await prisma.communityPost.create({
        data: {
          userId: req.user!.id,
          caption: caption.trim(),
          productId: resolvedProductId,
          tags: resolvedTags,
          isApproved: true,
          images: imageUrl ? { create: [{ url: imageUrl, sortOrder: 0 }] } : undefined,
        },
        include: POST_INCLUDE,
      });
      return res.status(201).json({ data: toPublicPost(post, req.user!.id, false, false) });
    } catch (err) { next(err); }
  }
);

communityRouter.get("/posts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit)  || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const tag    = typeof req.query.tag    === "string" ? req.query.tag    : undefined;
      const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
      const requestingUserId = await optionalUserId(req);

      let enriched: unknown[] = [];
      let total = 0;

      try {
        const where: Prisma.CommunityPostWhereInput = {
          isApproved: true,
          deletedAt: null,
          ...(tag    ? { tags: { has: tag } } : {}),
          ...(userId ? { userId }             : {}),
        };
        const [posts, dbTotal] = await Promise.all([
          prisma.communityPost.findMany({ where, include: POST_INCLUDE, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
          prisma.communityPost.count({ where }),
        ]);
        enriched = await enrichWithInteractions(posts as PostWithRelations[], requestingUserId);
        total = dbTotal;
      } catch { /* DB unavailable */ }

      // Fallback to demo posts
      if (enriched.length === 0) {
        let filtered = DEMO_COMMUNITY_POSTS.filter((p) => {
          if (tag && !p.tags.includes(tag)) return false;
          if (userId && p.userId !== userId) return false;
          return true;
        });
        total = filtered.length;
        filtered = filtered.slice(offset, offset + limit);
        enriched = filtered.map(toPublicDemoPost);
      }

      return res.status(200).json({ data: { posts: enriched, total, offset, limit } });
    } catch (err) { next(err); }
  }
);

communityRouter.get("/posts/trending",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      let enriched: unknown[] = [];
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const posts = await prisma.communityPost.findMany({
          where: { isApproved: true, deletedAt: null, createdAt: { gte: since } },
          include: POST_INCLUDE,
          orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }],
          take: limit,
        });
        enriched = await enrichWithInteractions(posts as PostWithRelations[]);
      } catch { /* DB unavailable */ }
      if (enriched.length === 0) {
        enriched = [...DEMO_COMMUNITY_POSTS]
          .sort((a, b) => b.likeCount - a.likeCount)
          .slice(0, limit)
          .map(toPublicDemoPost);
      }
      return res.status(200).json({ data: enriched });
    } catch (err) { next(err); }
  }
);

communityRouter.get("/posts/contest",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      let enriched: unknown[] = [];
      try {
        const posts = await prisma.communityPost.findMany({
          where: { isApproved: true, deletedAt: null, tags: { has: "contest" } },
          include: POST_INCLUDE,
          orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }],
          take: limit,
        });
        enriched = await enrichWithInteractions(posts as PostWithRelations[]);
      } catch { /* DB unavailable */ }
      if (enriched.length === 0) {
        enriched = DEMO_COMMUNITY_POSTS
          .filter((p) => p.tags.includes("contest"))
          .slice(0, limit)
          .map(toPublicDemoPost);
      }
      return res.status(200).json({ data: enriched });
    } catch (err) { next(err); }
  }
);

communityRouter.get("/posts/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.communityPost.findFirst({
        where: { id: req.params.id as string, deletedAt: null },
        include: POST_INCLUDE,
      });
      if (!post) return res.status(404).json({ error: "Post not found" });
      const requestingUserId = await optionalUserId(req);
      const [enriched] = await enrichWithInteractions([post as PostWithRelations], requestingUserId);
      return res.status(200).json({ data: enriched });
    } catch (err) { next(err); }
  }
);

communityRouter.patch("/posts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
      if (!existing) return res.status(404).json({ error: "Post not found" });

      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (existing.userId !== req.user!.id && !isMod) return res.status(403).json({ error: "Forbidden" });

      const { caption, tags, isApproved } = req.body as { caption?: string; tags?: string[]; isApproved?: boolean };
      const post = await prisma.communityPost.update({
        where: { id: req.params.id as string },
        data: {
          ...(caption?.trim() ? { caption: caption.trim() } : {}),
          ...(Array.isArray(tags) ? { tags: tags.slice(0, 10) } : {}),
          ...(isMod && typeof isApproved === "boolean" ? { isApproved } : {}),
        },
        include: POST_INCLUDE,
      });
      return res.status(200).json({ data: toPublicPost(post as PostWithRelations, req.user!.id) });
    } catch (err) { next(err); }
  }
);

communityRouter.delete("/posts/:id", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
      if (!existing) return res.status(404).json({ error: "Post not found" });

      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      if (existing.userId !== req.user!.id && !isMod) return res.status(403).json({ error: "Forbidden" });

      await prisma.communityPost.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
      return res.status(200).json({ data: { message: "Post deleted" } });
    } catch (err) { next(err); }
  }
);

// ── LIKES ─────────────────────────────────────────────────────────────────────

communityRouter.post("/posts/:id/like", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null, isApproved: true } });
      if (!post) return res.status(404).json({ error: "Post not found" });

      const existing = await prisma.like.findUnique({ where: { userId_postId: { userId: req.user!.id, postId: post.id } } });
      if (existing) {
        await prisma.$transaction([
          prisma.like.delete({ where: { userId_postId: { userId: req.user!.id, postId: post.id } } }),
          prisma.communityPost.update({ where: { id: post.id }, data: { likeCount: { decrement: 1 } } }),
        ]);
        return res.status(200).json({ data: { liked: false, likeCount: Math.max(0, post.likeCount - 1) } });
      }
      await prisma.$transaction([
        prisma.like.create({ data: { userId: req.user!.id, postId: post.id } }),
        prisma.communityPost.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } }),
      ]);
      return res.status(200).json({ data: { liked: true, likeCount: post.likeCount + 1 } });
    } catch (err) { next(err); }
  }
);

// ── BOOKMARKS ─────────────────────────────────────────────────────────────────

communityRouter.post("/posts/:id/bookmark", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
      if (!post) return res.status(404).json({ error: "Post not found" });

      const existing = await prisma.bookmark.findUnique({ where: { userId_postId: { userId: req.user!.id, postId: post.id } } });
      if (existing) {
        await prisma.$transaction([
          prisma.bookmark.delete({ where: { userId_postId: { userId: req.user!.id, postId: post.id } } }),
          prisma.communityPost.update({ where: { id: post.id }, data: { bookmarkCount: { decrement: 1 } } }),
        ]);
        return res.status(200).json({ data: { bookmarked: false } });
      }
      await prisma.$transaction([
        prisma.bookmark.create({ data: { userId: req.user!.id, postId: post.id } }),
        prisma.communityPost.update({ where: { id: post.id }, data: { bookmarkCount: { increment: 1 } } }),
      ]);
      return res.status(200).json({ data: { bookmarked: true } });
    } catch (err) { next(err); }
  }
);

// ── COMMENTS ──────────────────────────────────────────────────────────────────

communityRouter.get("/posts/:id/comments",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null } });
      if (!post) return res.status(404).json({ error: "Post not found" });

      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where: { postId: post.id, deletedAt: null, parentId: null },
          include: {
            user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
            replies: {
              where: { deletedAt: null },
              include: { user: { select: { name: true, profile: { select: { avatarUrl: true } } } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
        }),
        prisma.comment.count({ where: { postId: post.id, deletedAt: null, parentId: null } }),
      ]);
      return res.status(200).json({ data: { comments, total } });
    } catch (err) { next(err); }
  }
);

communityRouter.post("/posts/:id/comments", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await prisma.communityPost.findFirst({ where: { id: req.params.id as string, deletedAt: null, isApproved: true } });
      if (!post) return res.status(404).json({ error: "Post not found" });

      const { body, parentId } = req.body as { body?: string; parentId?: string };
      if (!body?.trim()) return res.status(400).json({ error: "body is required" });

      const comment = await prisma.$transaction(async (tx) => {
        const c = await tx.comment.create({
          data: { postId: post.id, userId: req.user!.id, body: body.trim(), parentId: parentId ?? null },
          include: { user: { select: { name: true, profile: { select: { avatarUrl: true } } } } },
        });
        await tx.communityPost.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
        return c;
      });
      return res.status(201).json({ data: comment });
    } catch (err) { next(err); }
  }
);

communityRouter.delete("/posts/:postId/comments/:commentId", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const comment = await prisma.comment.findFirst({
        where: { id: req.params.commentId as string, postId: req.params.postId as string, deletedAt: null },
      });
      if (!comment) return res.status(404).json({ error: "Comment not found" });

      const isMod = ["ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"].includes(req.user!.role);
      const post = await prisma.communityPost.findUnique({ where: { id: req.params.postId as string } });
      if (comment.userId !== req.user!.id && post?.userId !== req.user!.id && !isMod) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await prisma.$transaction([
        prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } }),
        prisma.communityPost.update({ where: { id: req.params.postId as string }, data: { commentCount: { decrement: 1 } } }),
      ]);
      return res.status(200).json({ data: { message: "Comment deleted" } });
    } catch (err) { next(err); }
  }
);

// ── MODERATION ────────────────────────────────────────────────────────────────

communityRouter.get("/moderation", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const posts = await prisma.communityPost.findMany({
        where: { isApproved: false, deletedAt: null },
        include: POST_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      return res.status(200).json({
        data: posts.map((p) => ({ ...toPublicPost(p as PostWithRelations), reports: [] })),
      });
    } catch (err) { next(err); }
  }
);

communityRouter.patch("/moderation/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CONTENT_MODERATOR"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action } = req.body as { action?: "approve" | "remove" };
      if (action !== "approve" && action !== "remove") {
        return res.status(400).json({ error: "action must be 'approve' or 'remove'" });
      }
      if (action === "remove") {
        await prisma.communityPost.update({ where: { id: req.params.id as string }, data: { deletedAt: new Date() } });
        return res.status(200).json({ data: { message: "Post removed" } });
      }
      const post = await prisma.communityPost.update({
        where: { id: req.params.id as string },
        data: { isApproved: true, approvedAt: new Date(), approvedById: req.user!.id },
        include: POST_INCLUDE,
      });
      return res.status(200).json({ data: { message: "Post approved", post: toPublicPost(post as PostWithRelations) } });
    } catch (err) { next(err); }
  }
);

// ── FAN RATINGS ───────────────────────────────────────────────────────────────

communityRouter.get("/fan-ratings/:celebrityId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;
      const [ratings, total] = await Promise.all([
        prisma.celebrityRating.findMany({
          where: { celebrityId: req.params.celebrityId as string },
          include: { user: { select: { name: true, profile: { select: { avatarUrl: true } } } } },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.celebrityRating.count({ where: { celebrityId: req.params.celebrityId as string } }),
      ]);
      const aggregate = await prisma.celebrityRating.aggregate({
        where: { celebrityId: req.params.celebrityId as string },
        _avg: { rating: true },
      });
      return res.status(200).json({ data: { ratings, average: aggregate._avg.rating, count: total, offset, limit } });
    } catch (err) { next(err); }
  }
);

communityRouter.post("/fan-ratings/:celebrityId", authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rating, review } = req.body as { rating?: number; review?: string };
      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "rating must be between 1 and 5" });
      }
      const entry = await prisma.celebrityRating.upsert({
        where: { userId_celebrityId: { userId: req.user!.id, celebrityId: req.params.celebrityId as string } },
        update: { rating: Math.round(rating), review: review?.trim() ?? null },
        create: {
          userId: req.user!.id,
          celebrityId: req.params.celebrityId as string,
          rating: Math.round(rating),
          review: review?.trim() ?? null,
        },
        include: { user: { select: { name: true } } },
      });
      return res.status(200).json({ data: entry });
    } catch (err) { next(err); }
  }
);
