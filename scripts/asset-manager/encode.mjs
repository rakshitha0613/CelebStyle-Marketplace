/**
 * Shared output encoder — every generated image (any backend, any slot)
 * passes through here so the whole catalogue is uniform: WebP, max width
 * 1536px, quality 90 (alpha preserved for transparent cutouts), metadata
 * stripped, and re-encoded down toward <500KB when the first pass is over
 * budget.
 */
import { mkdirSync } from "fs";
import { dirname } from "path";

export const MAX_WIDTH = 1536;
export const TARGET_QUALITY = 90;
export const TARGET_MAX_BYTES = 500 * 1024;
const QUALITY_FLOOR = 65;
const QUALITY_STEPS = [90, 80, 70, 65];

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    throw new Error("sharp is not installed. Run: npm install --save-dev sharp");
  }
}

/**
 * Encodes an input image buffer to WebP per the shared spec.
 * @param {Buffer} inputBuffer
 * @param {{ alpha?: boolean }} [opts]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, bytes: number, quality: number }>}
 */
export async function encodeToWebp(inputBuffer, opts = {}) {
  const sharp = await loadSharp();
  const alpha = Boolean(opts.alpha);

  let pipeline = sharp(inputBuffer).resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  let lastResult = null;
  for (const quality of QUALITY_STEPS) {
    const webpOptions = alpha
      ? { quality, alphaQuality: quality, lossless: false }
      : { quality };
    // Re-run resize+encode fresh each attempt (sharp pipelines are single-use for output).
    const attemptPipeline = sharp(inputBuffer).resize({ width: MAX_WIDTH, withoutEnlargement: true });
    const buffer = await attemptPipeline.webp(webpOptions).toBuffer();
    const meta = await sharp(buffer).metadata();
    lastResult = { buffer, width: meta.width ?? 0, height: meta.height ?? 0, bytes: buffer.length, quality };
    if (buffer.length <= TARGET_MAX_BYTES || quality === QUALITY_FLOOR) break;
  }

  return lastResult;
}

/** Writes an already-encoded buffer to disk, creating parent dirs as needed. */
export async function writeImage(destPath, buffer) {
  const { writeFileSync } = await import("fs");
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
}

/** Decodes+re-checks an on-disk image (used by verify-all / quality-check). */
export async function readImageMeta(path) {
  const sharp = await loadSharp();
  const { readFileSync, statSync } = await import("fs");
  const buffer = readFileSync(path);
  const meta = await sharp(buffer).metadata();
  const stats = statSync(path);
  return { width: meta.width ?? 0, height: meta.height ?? 0, bytes: stats.size, format: meta.format };
}
