import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

export const blogRouter = Router();

// ── In-memory store ──────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  slug: string;
  authorId: string;
  authorName: string;
  celebrityId: string | null;
  title: string;
  summary: string;
  body: string;
  coverImage: string | null;
  tags: string[];
  outfitIds: string[];
  published: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

const blogPosts: BlogPost[] = [];

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toPublic(post: BlogPost) {
  return {
    id: post.id,
    slug: post.slug,
    authorId: post.authorId,
    authorName: post.authorName,
    celebrityId: post.celebrityId,
    title: post.title,
    summary: post.summary,
    body: post.body,
    coverImage: post.coverImage,
    tags: post.tags,
    outfitIds: post.outfitIds,
    published: post.published,
    views: post.views,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

// GET /api/blog — list published posts
blogRouter.get("/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit       = Math.min(Number(req.query.limit) || 10, 50);
      const offset      = Number(req.query.offset) || 0;
      const tag         = req.query.tag as string | undefined;
      const celebrityId = req.query.celebrityId as string | undefined;
      const search      = (req.query.search as string | undefined)?.toLowerCase();

      let list = blogPosts.filter((p) => p.published);
      if (tag) list = list.filter((p) => p.tags.includes(tag));
      if (celebrityId) list = list.filter((p) => p.celebrityId === celebrityId);
      if (search) list = list.filter((p) =>
        p.title.toLowerCase().includes(search) || p.summary.toLowerCase().includes(search)
      );

      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const total = list.length;
      const page  = list.slice(offset, offset + limit).map(toPublic);
      return res.status(200).json({ data: { posts: page, total, offset, limit } });
    } catch (err) { next(err); }
  }
);

// GET /api/blog/:slug
blogRouter.get("/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = blogPosts.find(
        (p) => (p.slug === req.params.slug || p.id === req.params.slug) && p.published
      );
      if (!post) return res.status(404).json({ error: "Post not found" });
      post.views++;
      return res.status(200).json({ data: toPublic(post) });
    } catch (err) { next(err); }
  }
);

// POST /api/blog — create (ADMIN or CELEBRITY)
blogRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, summary, body, coverImage, tags, outfitIds, celebrityId, published } = req.body as {
        title?: string;
        summary?: string;
        body?: string;
        coverImage?: string;
        tags?: string[];
        outfitIds?: string[];
        celebrityId?: string;
        published?: boolean;
      };
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ error: "title and body are required" });
      }
      const now  = new Date().toISOString();
      const slug = `${toSlug(title)}-${randomUUID().slice(0, 6)}`;
      const post: BlogPost = {
        id: randomUUID(),
        slug,
        authorId: req.user!.id,
        authorName: req.user!.email.split("@")[0],
        celebrityId: celebrityId ?? null,
        title: title.trim(),
        summary: summary?.trim() ?? title.trim(),
        body: body.trim(),
        coverImage: coverImage ?? null,
        tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
        outfitIds: Array.isArray(outfitIds) ? outfitIds : [],
        published: published === true,
        views: 0,
        createdAt: now,
        updatedAt: now,
      };
      blogPosts.unshift(post);
      return res.status(201).json({ data: toPublic(post) });
    } catch (err) { next(err); }
  }
);

// PATCH /api/blog/:id — update
blogRouter.patch("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = blogPosts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (post.authorId !== req.user!.id && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { title, summary, body, coverImage, tags, outfitIds, published } = req.body as {
        title?: string;
        summary?: string;
        body?: string;
        coverImage?: string;
        tags?: string[];
        outfitIds?: string[];
        published?: boolean;
      };
      if (title?.trim()) { post.title = title.trim(); post.slug = `${toSlug(title)}-${post.id.slice(0, 6)}`; }
      if (summary?.trim()) post.summary = summary.trim();
      if (body?.trim()) post.body = body.trim();
      if (coverImage !== undefined) post.coverImage = coverImage;
      if (Array.isArray(tags)) post.tags = tags.slice(0, 10);
      if (Array.isArray(outfitIds)) post.outfitIds = outfitIds;
      if (published !== undefined) post.published = published;
      post.updatedAt = new Date().toISOString();
      return res.status(200).json({ data: toPublic(post) });
    } catch (err) { next(err); }
  }
);

// DELETE /api/blog/:id — ADMIN or author
blogRouter.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idx = blogPosts.findIndex((p) => p.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: "Post not found" });
      const post = blogPosts[idx]!;
      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (post.authorId !== req.user!.id && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      blogPosts.splice(idx, 1);
      return res.status(200).json({ data: { message: "Post deleted" } });
    } catch (err) { next(err); }
  }
);
