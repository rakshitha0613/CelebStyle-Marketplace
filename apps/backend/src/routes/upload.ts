import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../auth/middleware/authenticate.js";

export const uploadRouter = Router();

/**
 * POST /api/upload
 *
 * Cloudinary simulation layer. Accepts:
 *   - { url: string }   — external URL to "upload" (returns same URL as secure_url)
 *   - { base64: string, filename?: string } — base64 data URI
 *
 * In production, replace this handler body with actual Cloudinary SDK upload.
 * The response shape matches Cloudinary's upload API:
 *   { data: { secure_url, public_id, width, height, format, resource_type } }
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

    const publicId = `celebstyle/${Date.now()}_${(filename ?? "upload").replace(/[^a-z0-9._-]/gi, "_")}`;

    if (url) {
      // Passthrough — pretend URL was uploaded to Cloudinary
      res.json({
        data: {
          secure_url: url,
          public_id: publicId,
          resource_type: "image",
          format: url.split(".").pop()?.split("?")[0] ?? "jpg",
          simulated: true,
        },
      });
      return;
    }

    // base64 path — validate it's a data URI
    const dataUriMatch = (base64 as string).match(/^data:(image\/\w+);base64,(.+)$/);
    if (!dataUriMatch) {
      res.status(400).json({ error: "base64 must be a valid data URI (data:image/...;base64,...)" });
      return;
    }

    const mimeType = dataUriMatch[1];
    const format = mimeType.split("/")[1];

    // In sim mode: return the data URI itself as the secure_url.
    // A real Cloudinary integration would upload and return a CDN URL.
    res.json({
      data: {
        secure_url: base64 as string,
        public_id: publicId,
        resource_type: "image",
        format,
        simulated: true,
      },
    });
  } catch (err) { next(err); }
});
