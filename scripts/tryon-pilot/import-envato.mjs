/**
 * Phase 4/5 — `node scripts/asset-manager.mjs import-envato-tryon-pilot`
 *
 * Reads envato-import/tryon-pilot/, matches each file to one of the 10
 * TRYON_PILOT_OUTFITS by filename, validates it (Phase 5), and — only if it
 * passes every check — converts it to WebP and writes it to the EXISTING
 * asset convention (apps/frontend/public/assets/outfits/<slug>/garment.webp),
 * then marks the slot tryOnReady in scripts/asset-manifest.json.
 *
 * Never touches any outfit outside TRYON_PILOT_OUTFITS. Never marks
 * tryOnReady=true without every Phase 5 check passing.
 */
import { existsSync, readdirSync, readFileSync, createReadStream } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import sharp from "sharp";
import { TRYON_PILOT_OUTFITS, filenameFor, findPilotOutfitByFilename } from "./pilot-outfits.mjs";
import { ENVATO_PROMPTS } from "./envato-prompts.mjs";
import { loadManifest, saveManifest, getSlot, PUBLIC_DIR, ROOT } from "../asset-manager/manifest.mjs";
import { encodeToWebp, writeImage } from "../asset-manager/encode.mjs";

const INBOX_DIR = join(ROOT, "envato-import", "tryon-pilot");
const MIN_DIMENSION = 512;
const STDDEV_FLAT_THRESHOLD = 8;
const MIN_BYTES = 3 * 1024; // near-empty guard

function md5File(path) {
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

/** Known non-garment assets an accidental drop must never be mistaken for. */
function loadKnownBadHashes() {
  const bad = new Map(); // hash -> label
  const genericDir = join(PUBLIC_DIR, "assets", "garments");
  if (existsSync(genericDir)) {
    for (const name of readdirSync(genericDir)) {
      if (!name.endsWith(".png") && !name.endsWith(".webp")) continue;
      bad.set(md5File(join(genericDir, name)), `generic garment template (${name})`);
    }
  }
  for (const o of TRYON_PILOT_OUTFITS) {
    const legacyPng = join(PUBLIC_DIR, "assets", "outfits", o.id, "garment.png");
    if (existsSync(legacyPng)) bad.set(md5File(legacyPng), `legacy placeholder garment.png for ${o.id}`);
    for (const kind of ["hero.webp", "hero.png"]) {
      const p = join(PUBLIC_DIR, "assets", "outfits", o.id, kind);
      if (existsSync(p)) bad.set(md5File(p), `${o.id} ${kind} (hero/editorial image, not a garment cutout)`);
    }
    const portrait = join(PUBLIC_DIR, "assets", "celebrities", o.celebrityId, "portrait.webp");
    if (existsSync(portrait)) bad.set(md5File(portrait), `${o.celebrityId} celebrity portrait`);
    const banner = join(PUBLIC_DIR, "assets", "celebrities", o.celebrityId, "banner.webp");
    if (existsSync(banner)) bad.set(md5File(banner), `${o.celebrityId} celebrity banner`);
  }
  return bad;
}

async function validateImage(absPath) {
  const buffer = readFileSync(absPath);
  const bytes = buffer.length;
  if (bytes < MIN_BYTES) {
    return { ok: false, reason: `file is only ${bytes} bytes — likely empty/corrupt` };
  }

  let meta, stats;
  try {
    meta = await sharp(buffer).metadata();
    stats = await sharp(buffer).stats();
  } catch (err) {
    return { ok: false, reason: `image failed to decode: ${err.message}` };
  }

  if (!["png", "jpeg", "jpg", "webp"].includes(meta.format ?? "")) {
    return { ok: false, reason: `unsupported format "${meta.format}" — must be PNG, JPEG, or WebP` };
  }
  if ((meta.width ?? 0) < MIN_DIMENSION || (meta.height ?? 0) < MIN_DIMENSION) {
    return { ok: false, reason: `resolution ${meta.width}x${meta.height} is below the ${MIN_DIMENSION}x${MIN_DIMENSION} minimum` };
  }

  const avgStddev = stats.channels.reduce((sum, c) => sum + c.stdev, 0) / stats.channels.length;
  if (avgStddev < STDDEV_FLAT_THRESHOLD) {
    return { ok: false, reason: `image is near-flat/near-empty (avg channel stddev ${avgStddev.toFixed(2)} < ${STDDEV_FLAT_THRESHOLD}) — looks like a blank or placeholder image, not a real garment photo` };
  }

  return { ok: true, meta, buffer };
}

export async function importEnvatoTryonPilot() {
  const manifest = loadManifest();
  const result = { imported: [], rejected: [], missing: [], failed: [], alreadyImported: [] };

  if (!existsSync(INBOX_DIR)) {
    return { ...result, error: `Inbox folder not found: envato-import/tryon-pilot/. Run "node scripts/asset-manager.mjs" once to see setup instructions, or create it and drop the 10 files described in the README.` };
  }

  const knownBadHashes = loadKnownBadHashes();
  const files = readdirSync(INBOX_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

  const matchedOutfitIds = new Set();

  for (const filename of files) {
    const absPath = join(INBOX_DIR, filename);
    const outfit = findPilotOutfitByFilename(filename);

    if (!outfit) {
      result.rejected.push({ filename, reason: "unknown filename — does not match any of the 10 TRYON_PILOT_OUTFITS. See envato-import/tryon-pilot/README.md for the required filenames." });
      continue;
    }

    if (matchedOutfitIds.has(outfit.id)) {
      result.rejected.push({ filename, outfitId: outfit.id, reason: `duplicate outfit mapping — another file in this inbox already mapped to ${outfit.id} in this run` });
      continue;
    }

    try {
      const hash = md5File(absPath);
      if (knownBadHashes.has(hash)) {
        result.rejected.push({ filename, outfitId: outfit.id, reason: `file is byte-identical to a known non-garment asset: ${knownBadHashes.get(hash)}` });
        continue;
      }

      const validation = await validateImage(absPath);
      if (!validation.ok) {
        result.rejected.push({ filename, outfitId: outfit.id, reason: validation.reason });
        continue;
      }

      matchedOutfitIds.add(outfit.id);

      // Auto-orient per EXIF, then encode to WebP via the shared encoder
      // (resizes to max 1536px width without stretching, strips metadata).
      const oriented = await sharp(validation.buffer).rotate().toBuffer();
      const encoded = await encodeToWebp(oriented, { alpha: false });

      const slotRelPath = `assets/outfits/${outfit.id}/garment.webp`;
      const destAbsPath = join(PUBLIC_DIR, ...slotRelPath.split("/"));
      await writeImage(destAbsPath, encoded.buffer);

      const now = new Date().toISOString();
      manifest.slots[slotRelPath] = {
        ...getSlot(manifest, slotRelPath),
        prompt: ENVATO_PROMPTS[outfit.id] ?? null,
        backend: "manual-upload",
        source: "envato",
        purpose: "virtual-try-on",
        model: null,
        seed: null,
        generatedAt: now,
        width: encoded.width,
        height: encoded.height,
        status: "generated",
        tryOnReady: true,
        needsPaidUpgrade: false,
        qualityFlag: null,
        lastVerified: now,
        error: null,
        attempts: (getSlot(manifest, slotRelPath).attempts ?? 0) + 1,
        envatoFilename: filename,
      };
      saveManifest(manifest);

      result.imported.push({
        filename,
        outfitId: outfit.id,
        destPath: `apps/frontend/public/${slotRelPath}`,
        width: encoded.width,
        height: encoded.height,
        bytes: encoded.bytes,
      });
    } catch (err) {
      result.failed.push({ filename, outfitId: outfit.id, reason: err.message });
    }
  }

  // Anything not matched this run: either already imported previously, or still missing.
  for (const outfit of TRYON_PILOT_OUTFITS) {
    if (matchedOutfitIds.has(outfit.id)) continue;
    const slotRelPath = `assets/outfits/${outfit.id}/garment.webp`;
    const entry = manifest.slots[slotRelPath];
    if (entry && entry.status === "generated" && entry.tryOnReady === true) {
      result.alreadyImported.push({ outfitId: outfit.id, destPath: `apps/frontend/public/${slotRelPath}`, envatoFilename: entry.envatoFilename ?? null });
    } else {
      result.missing.push({ outfitId: outfit.id, expectedFilename: filenameFor(outfit) });
    }
  }

  return result;
}

export function printImportSummary(result) {
  if (result.error) {
    console.error(`\n${result.error}\n`);
    return;
  }
  console.log(`\n─── Envato Try-On Pilot Import Summary ───`);
  console.log(`  imported:        ${result.imported.length}`);
  console.log(`  already imported: ${result.alreadyImported.length}`);
  console.log(`  rejected:        ${result.rejected.length}`);
  console.log(`  missing:         ${result.missing.length}`);
  console.log(`  failed:          ${result.failed.length}\n`);

  if (result.imported.length) {
    console.log("  Imported:");
    for (const r of result.imported) console.log(`    ✓ ${r.outfitId}  (${r.width}x${r.height}, ${(r.bytes / 1024).toFixed(0)}KB)  ← ${r.filename}`);
  }
  if (result.rejected.length) {
    console.log("\n  Rejected:");
    for (const r of result.rejected) console.log(`    ✗ ${r.filename} — ${r.reason}`);
  }
  if (result.failed.length) {
    console.log("\n  Failed:");
    for (const r of result.failed) console.log(`    ! ${r.filename} (${r.outfitId}) — ${r.reason}`);
  }
  if (result.missing.length) {
    console.log("\n  Missing (no file dropped yet):");
    for (const r of result.missing) console.log(`    - ${r.outfitId}  (expected ${r.expectedFilename})`);
  }
  console.log("");
}
