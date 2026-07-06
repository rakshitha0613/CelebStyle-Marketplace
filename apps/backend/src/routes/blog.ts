import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { prisma } from "../lib/prisma.js";

export const blogRouter = Router();

function toSlug(title: string, suffix: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${suffix}`;
}

const BLOG_INCLUDE = {
  author: { select: { name: true as const, profile: { select: { avatarUrl: true as const } } } },
};

// GET /api/blog
blogRouter.get("/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit       = Math.min(Number(req.query.limit) || 10, 50);
      const offset      = Number(req.query.offset) || 0;
      const tag         = typeof req.query.tag         === "string" ? req.query.tag         : undefined;
      const celebrityId = typeof req.query.celebrityId === "string" ? req.query.celebrityId : undefined;
      const search      = typeof req.query.search      === "string" ? req.query.search      : undefined;

      const where: Prisma.BlogPostWhereInput = {
        isPublished: true,
        ...(tag         ? { tags: { has: tag } }             : {}),
        ...(celebrityId ? { celebrityId }                    : {}),
        ...(search      ? {
          OR: [
            { title:   { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      };

      const [posts, total] = await Promise.all([
        prisma.blogPost.findMany({ where, include: BLOG_INCLUDE, orderBy: { publishedAt: "desc" }, skip: offset, take: limit }),
        prisma.blogPost.count({ where }),
      ]);

      return res.status(200).json({ data: { posts, total, offset, limit } });
    } catch (err) { next(err); }
  }
);

// GET /api/blog/:slug
blogRouter.get("/:slug",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params.slug as string;
      const post = await prisma.blogPost.findFirst({
        where: { OR: [{ slug }, { id: slug }], isPublished: true },
        include: BLOG_INCLUDE,
      });
      if (!post) return res.status(404).json({ error: "Post not found" });

      await prisma.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
      return res.status(200).json({ data: { ...post, viewCount: post.viewCount + 1 } });
    } catch (err) { next(err); }
  }
);

// POST /api/blog
blogRouter.post("/", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, summary, body, coverImage, tags, productIds, celebrityId, isPublished } = req.body as {
        title?: string;
        summary?: string;
        body?: string;
        coverImage?: string;
        tags?: string[];
        productIds?: string[];
        celebrityId?: string;
        isPublished?: boolean;
      };
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ error: "title and body are required" });
      }

      const slug = toSlug(title.trim(), req.user!.id.slice(-6));
      const post = await prisma.blogPost.create({
        data: {
          slug,
          authorId:    req.user!.id,
          celebrityId: celebrityId ?? null,
          title:       title.trim(),
          summary:     summary?.trim() ?? title.trim(),
          body:        body.trim(),
          coverImage:  coverImage ?? null,
          tags:        Array.isArray(tags)       ? tags.slice(0, 10) : [],
          productIds:  Array.isArray(productIds) ? productIds        : [],
          isPublished: isPublished === true,
          publishedAt: isPublished === true ? new Date() : null,
        },
        include: BLOG_INCLUDE,
      });
      return res.status(201).json({ data: post });
    } catch (err) { next(err); }
  }
);

// PATCH /api/blog/:id
blogRouter.patch("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.blogPost.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Post not found" });

      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (existing.authorId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });

      const { title, summary, body, coverImage, tags, productIds, isPublished } = req.body as {
        title?: string;
        summary?: string;
        body?: string;
        coverImage?: string;
        tags?: string[];
        productIds?: string[];
        isPublished?: boolean;
      };

      const nowPublishing = isPublished === true && !existing.isPublished;

      const post = await prisma.blogPost.update({
        where: { id },
        data: {
          ...(title?.trim()   ? { title: title.trim(), slug: toSlug(title.trim(), existing.id.slice(-6)) } : {}),
          ...(summary?.trim() ? { summary: summary.trim() } : {}),
          ...(body?.trim()    ? { body: body.trim() }       : {}),
          ...(coverImage !== undefined            ? { coverImage }                   : {}),
          ...(Array.isArray(tags)                 ? { tags: tags.slice(0, 10) }     : {}),
          ...(Array.isArray(productIds)           ? { productIds }                  : {}),
          ...(isPublished !== undefined           ? { isPublished }                 : {}),
          ...(nowPublishing                       ? { publishedAt: new Date() }     : {}),
        },
        include: BLOG_INCLUDE,
      });
      return res.status(200).json({ data: post });
    } catch (err) { next(err); }
  }
);

// DELETE /api/blog/:id
blogRouter.delete("/:id", authenticate, authorize("ADMIN", "SUPER_ADMIN", "CELEBRITY", "CELEBRITY_MANAGER"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.blogPost.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Post not found" });

      const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user!.role);
      if (existing.authorId !== req.user!.id && !isAdmin) return res.status(403).json({ error: "Forbidden" });

      await prisma.blogPost.delete({ where: { id } });
      return res.status(200).json({ data: { message: "Post deleted" } });
    } catch (err) { next(err); }
  }
);
