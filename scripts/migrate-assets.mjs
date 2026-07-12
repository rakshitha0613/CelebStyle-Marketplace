/**
 * Asset Migration Script
 * Moves assets from /assets/catalogue/ into the canonical structure:
 *   /assets/celebrities/<slug>/portrait.jpg  (celeb portrait)
 *   /assets/celebrities/<slug>/banner.jpg    (celeb banner)
 *   /assets/outfits/<slug>/hero.png          (outfit hero — JPEG→PNG)
 *   /assets/outfits/<slug>/detail1.jpg       (outfit gallery)
 *   /assets/outfits/<slug>/detail2.jpg
 *   /assets/outfits/<slug>/fabric.jpg
 *   /assets/outfits/<slug>/thumb.jpg
 *   /assets/outfits/<slug>/garment.png       (transparent garment)
 *
 * Also converts blog/avatar/community SVGs to PNG using sharp.
 *
 * Run: npm run migrate-assets
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "apps", "frontend", "public");

const SRC_CATALOGUE = join(PUBLIC, "assets", "catalogue");
const SRC_CELEB     = join(SRC_CATALOGUE, "celeb");

const DEST_CELEBS   = join(PUBLIC, "assets", "celebrities");
const DEST_OUTFITS  = join(PUBLIC, "assets", "outfits");

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function copy(src, dest) {
  if (!existsSync(src)) return false;
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  return true;
}

async function main() {
  let sharp;
  try {
    const mod = await import("sharp");
    sharp = mod.default;
  } catch {
    console.error("sharp not available — install it first");
    process.exit(1);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Asset Migration");
  console.log("═══════════════════════════════════════════════════\n");

  // ── 1. Celebrity images ───────────────────────────────────────────────────
  console.log("[1/4] Migrating celebrity images…");
  let celebOk = 0, celebSkip = 0;

  const celebDirs = readdirSync(SRC_CELEB);
  for (const slug of celebDirs) {
    const srcDir = join(SRC_CELEB, slug);
    const destDir = join(DEST_CELEBS, slug);
    ensureDir(destDir);

    for (const file of ["portrait.jpg", "banner.jpg"]) {
      const dest = join(destDir, file);
      if (existsSync(dest)) { celebSkip++; continue; }
      copy(join(srcDir, file), dest) ? celebOk++ : null;
    }
  }
  console.log(`  ✓ ${celebOk} copied, ${celebSkip} already present\n`);

  // ── 2. Outfit images (hero JPEG→PNG, rest copy as-is) ────────────────────
  console.log("[2/4] Migrating outfit images (hero → .png)…");
  let outfitOk = 0, outfitSkip = 0;

  const outfitSlugs = readdirSync(SRC_CATALOGUE).filter(d => d !== "celeb");
  for (const slug of outfitSlugs) {
    const srcDir = join(SRC_CATALOGUE, slug);
    const destDir = join(DEST_OUTFITS, slug);
    ensureDir(destDir);

    // hero.jpg → hero.png (convert format)
    const heroSrc  = join(srcDir, "hero.jpg");
    const heroDest = join(destDir, "hero.png");
    if (!existsSync(heroDest) && existsSync(heroSrc)) {
      await sharp(heroSrc).png({ compressionLevel: 6 }).toFile(heroDest);
      outfitOk++;
    } else { outfitSkip++; }

    // Copy remaining files as-is
    for (const file of ["detail1.jpg", "detail2.jpg", "fabric.jpg", "thumb.jpg", "garment.png"]) {
      const dest = join(destDir, file);
      if (existsSync(dest)) { outfitSkip++; continue; }
      copy(join(srcDir, file), dest) ? outfitOk++ : null;
    }
  }
  console.log(`  ✓ ${outfitOk} migrated, ${outfitSkip} already present\n`);

  // ── 3. Blog banners SVG → PNG ─────────────────────────────────────────────
  console.log("[3/4] Converting blog/avatar/community SVGs to PNG…");
  let svgOk = 0, svgSkip = 0;
  const SVG_DIRS = ["blog", "avatars", "community"];

  for (const dir of SVG_DIRS) {
    const svgDir = join(PUBLIC, "assets", dir);
    if (!existsSync(svgDir)) continue;
    const files = readdirSync(svgDir).filter(f => f.endsWith(".svg"));
    for (const f of files) {
      const srcPath  = join(svgDir, f);
      const destPath = join(svgDir, f.replace(".svg", ".png"));
      if (existsSync(destPath)) { svgSkip++; continue; }
      try {
        const [w, h] = dir === "blog" ? [1200, 630] : dir === "community" ? [800, 600] : [128, 128];
        await sharp(readFileSync(srcPath), { density: 150 })
          .resize(w, h, { fit: "cover", background: { r: 232, g: 220, b: 203, alpha: 1 } })
          .png({ compressionLevel: 8 })
          .toFile(destPath);
        svgOk++;
      } catch (e) {
        console.warn(`  ✗ ${f}: ${e.message}`);
      }
    }
  }
  console.log(`  ✓ ${svgOk} converted, ${svgSkip} already present\n`);

  // ── 4. Summary ────────────────────────────────────────────────────────────
  console.log("[4/4] Verification…");
  const celebCount = readdirSync(DEST_CELEBS).filter(d =>
    existsSync(join(DEST_CELEBS, d, "portrait.jpg"))
  ).length;

  const outfitCount = existsSync(DEST_OUTFITS)
    ? readdirSync(DEST_OUTFITS).filter(d =>
        existsSync(join(DEST_OUTFITS, d, "hero.png"))
      ).length
    : 0;

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Migration Complete`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  /assets/celebrities/<slug>/portrait.jpg  → ${celebCount} celebrities`);
  console.log(`  /assets/outfits/<slug>/hero.png          → ${outfitCount} outfits`);
  console.log(`═══════════════════════════════════════════════════\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
