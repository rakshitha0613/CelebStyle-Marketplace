import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";
import { authenticate } from "../auth/middleware/authenticate.js";
import { config } from "../env.js";

export const uploadRouter = Router();

// Configure Cloudinary from CLOUDINARY_URL env var (format: cloudinary://api_key:api_secret@cloud_name)
if (config.cloudinary.enabled && config.cloudinary.url) {
  cloudinary.config({ cloudinary_url: config.cloudinary.url });
}

/**
 * POST /api/upload
 *
 * Accepts either:
 *   { url: string }                        — upload from remote URL
 *   { base64: string, filename?: string }  — upload base64 data URI
 *
 * Returns Cloudinary upload result shape:
 *   { data: { secure_url, public_id, width, height, format, resource_type } }
 *
 * When CLOUDINARY_URL is not set, falls back to URL passthrough (no storage).
 */
uploadRouter.post("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, base64, filename } = req.body as {
      url?: string;
      base64?: string;
      filename?: string;
    };

    if (!url && !base64) {
      res.status(400).json({ error: "Either url or base64 is required" });
      return;
    }

    const folder = "celebstyle";
    const publicId = filename
      ? `${folder}/${filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_")}`
      : undefined;

    if (!config.cloudinary.enabled) {
      // Fallback: return the source as-is (no cloud storage)
      const sourceUrl = url ?? base64!;
      const format = url
        ? url.split(".").pop()?.split("?")[0] ?? "jpg"
        : (base64!.match(/^data:image\/(\w+)/)?.[1] ?? "jpg");
      res.json({
        data: {
          secure_url: sourceUrl,
          public_id: publicId ?? `${folder}/${Date.now()}`,
          resource_type: "image",
          format,
          width: null,
          height: null,
        },
      });
      return;
    }

    const source = url ?? base64!;
    const result = await cloudinary.uploader.upload(source, {
      folder,
      ...(publicId ? { public_id: publicId } : {}),
      resource_type: "auto",
      overwrite: false,
    });

    res.json({
      data: {
        secure_url:    result.secure_url,
        public_id:     result.public_id,
        resource_type: result.resource_type,
        format:        result.format,
        width:         result.width,
        height:        result.height,
      },
    });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/upload/:publicId — remove asset from Cloudinary
 */
uploadRouter.delete("/:publicId", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.cloudinary.enabled) {
      res.json({ data: { message: "Deleted (no-op — Cloudinary not configured)" } });
      return;
    }
    const publicId = decodeURIComponent(req.params.publicId as string);
    await cloudinary.uploader.destroy(publicId);
    res.json({ data: { message: "Deleted", publicId } });
  } catch (err) { next(err); }
});
