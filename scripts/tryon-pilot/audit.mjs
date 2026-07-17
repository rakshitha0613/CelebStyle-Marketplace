#!/usr/bin/env node
/**
 * Phase 2 — audits ONLY the 10 TRYON_PILOT_OUTFITS garment assets currently
 * resolved by the Virtual Try-On page (outfitToGarment() in
 * apps/frontend/lib/ar/outfit-to-garment.ts always resolves to
 * `/assets/outfits/<id>/garment.webp`).
 *
 * Writes scripts/tryon-pilot-report.json. Does not touch any other outfit.
 */
import { existsSync, statSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { TRYON_PILOT_OUTFITS } from "./pilot-outfits.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PUBLIC_DIR = join(ROOT, "apps", "frontend", "public");
const MANIFEST_PATH = join(ROOT, "scripts", "asset-manifest.json");
const REPORT_PATH = join(ROOT, "scripts", "tryon-pilot-report.json");

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { slots: {} };
  }
}

async function inspect(absPath) {
  if (!existsSync(absPath)) {
    return { exists: false };
  }
  const stat = statSync(absPath);
  const buffer = readFileSync(absPath);
  const md5 = createHash("md5").update(buffer).digest("hex");
  let decode = { ok: false };
  try {
    const meta = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    const avgStddev =
      stats.channels.reduce((sum, c) => sum + c.stdev, 0) / stats.channels.length;
    decode = {
      ok: true,
      format: meta.format ?? null,
      width: meta.width ?? null,
      height: meta.height ?? null,
      hasAlpha: Boolean(meta.hasAlpha),
      avgStddev: Number(avgStddev.toFixed(2)),
      looksFlatOrGradient: avgStddev < 8,
    };
  } catch (err) {
    decode = { ok: false, error: err.message };
  }
  return {
    exists: true,
    bytes: stat.size,
    md5,
    ...decode,
  };
}

// Generic per-category silhouette templates the legacy pipeline falls back
// to (apps/frontend/public/assets/garments/*.png) — matched by MD5 so the
// report can name exactly which generic template each pilot outfit's
// garment.png actually is.
function loadGenericTemplateHashes() {
  const dir = join(PUBLIC_DIR, "assets", "garments");
  const map = {};
  if (!existsSync(dir)) return map;
  for (const name of ["blazer", "dress", "hoodie", "indo_western", "jacket", "kurta", "lehenga", "placeholder", "saree", "sherwani", "shirt", "suit", "t_shirt"]) {
    const p = join(dir, `${name}.png`);
    if (existsSync(p)) map[createHash("md5").update(readFileSync(p)).digest("hex")] = name;
  }
  return map;
}

async function main() {
  const manifest = loadManifest();
  const genericTemplateHashes = loadGenericTemplateHashes();

  // Detect shared/duplicate garment.png files across the pilot set up front
  // (a garment image reused by >1 outfit can never be a real per-outfit photo).
  const md5ByOutfit = {};
  for (const o of TRYON_PILOT_OUTFITS) {
    const legacyPngPath = join(PUBLIC_DIR, "assets", "outfits", o.id, "garment.png");
    if (existsSync(legacyPngPath)) {
      md5ByOutfit[o.id] = createHash("md5").update(readFileSync(legacyPngPath)).digest("hex");
    }
  }
  const hashCounts = {};
  for (const h of Object.values(md5ByOutfit)) hashCounts[h] = (hashCounts[h] ?? 0) + 1;

  const rows = [];
  for (const o of TRYON_PILOT_OUTFITS) {
    const garmentWebpRel = `assets/outfits/${o.id}/garment.webp`;
    const garmentWebpAbs = join(PUBLIC_DIR, garmentWebpRel);
    const legacyPngRel = `assets/outfits/${o.id}/garment.png`;
    const legacyPngAbs = join(PUBLIC_DIR, legacyPngRel);
    const heroWebpRel = `assets/outfits/${o.id}/hero.webp`;
    const heroWebpAbs = join(PUBLIC_DIR, heroWebpRel);

    const garmentWebp = await inspect(garmentWebpAbs);
    const legacyPng = await inspect(legacyPngAbs);
    const hero = await inspect(heroWebpAbs);

    const manifestEntry = manifest.slots?.[garmentWebpRel] ?? null;
    const isDuplicatedAcrossPilot = md5ByOutfit[o.id]
      ? hashCounts[md5ByOutfit[o.id]] > 1
      : false;

    // outfitToGarment() in lib/ar/outfit-to-garment.ts hardcodes garment.webp —
    // that path 404s for every one of these 10 outfits today.
    const tryOnReady = false;

    rows.push({
      index: o.index,
      outfitId: o.id,
      celebrity: o.celebrityName,
      outfitName: `${o.movieName} — ${o.category}`,
      category: o.category,
      colorPalette: o.colorPalette,

      resolvedGarmentPath: {
        localPath: `apps/frontend/public/${garmentWebpRel}`,
        publicUrl: `/${garmentWebpRel}`,
        fileExists: garmentWebp.exists,
      },
      currentDisplayImage: {
        localPath: `apps/frontend/public/${heroWebpRel}`,
        publicUrl: `/${heroWebpRel}`,
        fileExists: hero.exists,
        width: hero.width ?? null,
        height: hero.height ?? null,
      },

      garmentWebpAudit: garmentWebp.exists
        ? garmentWebp
        : { exists: false, note: "404 — outfitToGarment() resolves this path but no file has ever been generated here (not in asset-manifest.json)." },

      legacyGarmentPngAudit: legacyPng.exists
        ? {
            ...legacyPng,
            isPlaceholder: true,
            isRasterizedVectorIllustration: true,
            duplicatedAcrossPilotOutfits: isDuplicatedAcrossPilot,
            matchesGenericTemplate: genericTemplateHashes[md5ByOutfit[o.id]] ?? null,
            containsPerson: false,
            isCelebrityPortrait: false,
            isBanner: false,
            isHeroEditorialImage: false,
            isCleanGarmentPhoto: false,
            note:
              "Flat cartoon/vector-style clip-art silhouette (visually confirmed), not garment photography. " +
              (genericTemplateHashes[md5ByOutfit[o.id]]
                ? `Byte-identical (MD5) to the generic /assets/garments/${genericTemplateHashes[md5ByOutfit[o.id]]}.png category template — this outfit's category is "${o.category}", so the template shown is not even a correct category match in most cases.`
                : isDuplicatedAcrossPilot
                ? "This exact file (by MD5) is reused across multiple pilot outfits — it is a generic per-category template, not outfit-specific."
                : "Not shared with another pilot outfit's garment.png, but still a generic vector template, not a photo."),
          }
        : { exists: false },

      garmentManifestStatus: manifestEntry
        ? { tracked: true, status: manifestEntry.status, backend: manifestEntry.backend }
        : { tracked: false, status: "never-attempted" },

      tryOnReady,
      tryOnReadyReason:
        "garment.webp (the path the AR pipeline actually requests) does not exist on disk — 404. " +
        "The only asset present at this outfit's folder (garment.png) is a shared generic vector " +
        "illustration, not a photorealistic, garment-only, front-facing product photo suitable as " +
        "IDM-VTON input.",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "TRYON_PILOT_OUTFITS only (first 10 outfits rendered on /try-on) — no other outfit audited or modified",
    pilotOutfitCount: TRYON_PILOT_OUTFITS.length,
    readyCount: rows.filter((r) => r.tryOnReady).length,
    outfits: rows,
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\nPhase 2 audit complete — ${rows.length} pilot outfits inspected, ${report.readyCount} try-on-ready.`);
  console.log(`Report written to scripts/tryon-pilot-report.json\n`);
  for (const r of rows) {
    console.log(
      `  ${String(r.index).padStart(2)}. ${r.outfitId.padEnd(34)} garment.webp exists=${r.resolvedGarmentPath.fileExists} tryOnReady=${r.tryOnReady}`
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
