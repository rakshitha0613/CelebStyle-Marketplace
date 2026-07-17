/**
 * Orchestrates the Wikimedia Commons celebrity-photo import: for every
 * celebrity in celebs-seed.json, look up their Wikipedia lead image,
 * verify it carries a reusable license, download + convert to WebP, and
 * record provenance (source URL, license, attribution) in the manifest.
 *
 * Celebrities with no findable/verifiable-license image are left untouched
 * (whatever asset already exists at their path stays — AI-generated or
 * otherwise) and are listed in the report instead, so nothing ever ends up
 * pointing at a broken path.
 */
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { loadCelebrities } from "./slots.mjs";
import { lookupCelebrityImage, downloadImage } from "./backends/wikimedia.mjs";
import { writeImage } from "./encode.mjs";
import { updateSlot, getSlot, PUBLIC_DIR } from "./manifest.mjs";

const MAX_WIDTH = 1536;
const BANNER_ASPECT = { width: 1536, height: 586 }; // ~21:8, matches existing celebrity banner usage
// Politeness delay between celebrities — each one issues several Wikipedia/
// Commons API calls; running all 101 back-to-back with no gap tripped 429s
// during testing even with per-request retry/backoff in place.
const INTER_CELEBRITY_DELAY_MS = 600;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadSharp() {
  return (await import("sharp")).default;
}

async function toPortraitWebp(buffer) {
  const sharp = await loadSharp();
  const buf = await sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  const meta = await sharp(buf).metadata();
  return { buffer: buf, width: meta.width, height: meta.height };
}

/**
 * Builds the wide banner as a blurred-background composite rather than a
 * hard crop. Source photos vary wildly in composition (tight headshot vs.
 * wider event photo) and sharp has no real face detection — both a fixed
 * "top" anchor and the built-in entropy-based "attention" strategy were
 * tried and both cropped faces out unpredictably (attention once picked a
 * necktie pattern over the face). Compositing the full, uncropped photo
 * over a blurred fill of itself guarantees the face is always fully
 * visible, at the cost of blurred padding on the sides for non-wide sources.
 */
async function toBannerWebp(buffer) {
  const sharp = await loadSharp();
  const { width: bw, height: bh } = BANNER_ASPECT;

  const background = await sharp(buffer)
    .resize({ width: bw, height: bh, fit: "cover" })
    .blur(35)
    .modulate({ brightness: 0.65 })
    .toBuffer();

  const foreground = await sharp(buffer).resize({ height: bh, fit: "inside" }).toBuffer();
  const fgMeta = await sharp(foreground).metadata();
  const left = Math.max(0, Math.round((bw - fgMeta.width) / 2));

  const buf = await sharp(background)
    .composite([{ input: foreground, left, top: 0 }])
    .webp({ quality: 90 })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  return { buffer: buf, width: meta.width, height: meta.height };
}

/**
 * @param {{ dryRun?: boolean, onlyCelebrityId?: string, onlyCelebrityIds?: string[] }} [opts]
 */
export async function runWikimediaImport(manifest, opts = {}) {
  const celebrities = loadCelebrities();
  const idFilter = opts.onlyCelebrityIds ?? (opts.onlyCelebrityId ? [opts.onlyCelebrityId] : null);
  const targets = idFilter ? celebrities.filter((c) => idFilter.includes(c.id)) : celebrities;

  const report = { downloaded: [], missing: [], licenseInfo: [], attributionRequirements: [] };

  for (const celeb of targets) {
    console.log(`  ${celeb.id} — looking up "${celeb.name}"...`);
    let lookup;
    try {
      lookup = await lookupCelebrityImage(celeb.name, celeb.industry);
    } catch (err) {
      lookup = { found: false, reason: `Lookup error: ${err.message}` };
    }

    if (!lookup.found) {
      console.log(`    ✗ skipped — ${lookup.reason}`);
      report.missing.push({ id: celeb.id, name: celeb.name, reason: lookup.reason });
      continue;
    }

    if (opts.dryRun) {
      console.log(`    ✓ would download — ${lookup.commonsFileTitle} (${lookup.license})`);
      report.downloaded.push({ id: celeb.id, name: celeb.name, ...lookup, dryRun: true });
      report.licenseInfo.push({ id: celeb.id, license: lookup.license, licenseUrl: lookup.licenseUrl });
      if (lookup.license && !/^cc0|public domain|pd/i.test(lookup.license)) {
        report.attributionRequirements.push({ id: celeb.id, attribution: lookup.attribution, license: lookup.license, sourceUrl: lookup.commonsPageUrl });
      }
      continue;
    }

    try {
      const rawBuffer = await downloadImage(lookup.imageUrl);
      const portrait = await toPortraitWebp(rawBuffer);
      const banner = await toBannerWebp(rawBuffer);

      const portraitPath = `assets/celebrities/${celeb.id}/portrait.webp`;
      const bannerPath = `assets/celebrities/${celeb.id}/banner.webp`;

      await writeImage(join(PUBLIC_DIR, ...portraitPath.split("/")), portrait.buffer);
      await writeImage(join(PUBLIC_DIR, ...bannerPath.split("/")), banner.buffer);

      const now = new Date().toISOString();
      const provenance = {
        backend: "wikimedia",
        model: null,
        prompt: null,
        promptHash: null,
        seed: null,
        status: "generated",
        needsPaidUpgrade: false,
        qualityFlag: lookup.personalityRightsNote ? "personality-rights-tagged" : null,
        error: null,
        generatedAt: now,
        lastVerified: now,
        sourceUrl: lookup.commonsPageUrl ?? lookup.imageUrl,
        license: lookup.license,
        attribution: lookup.attribution,
      };

      updateSlot(manifest, portraitPath, { ...provenance, width: portrait.width, height: portrait.height, attempts: 1 });
      updateSlot(manifest, bannerPath, { ...provenance, width: banner.width, height: banner.height, attempts: 1 });

      console.log(`    ✓ downloaded — ${lookup.license}, attribution: ${lookup.attribution}`);
      report.downloaded.push({ id: celeb.id, name: celeb.name, ...lookup });
      report.licenseInfo.push({ id: celeb.id, license: lookup.license, licenseUrl: lookup.licenseUrl });
      if (lookup.license && !/^cc0|public domain|pd/i.test(lookup.license)) {
        report.attributionRequirements.push({ id: celeb.id, attribution: lookup.attribution, license: lookup.license, sourceUrl: lookup.commonsPageUrl });
      }
    } catch (err) {
      console.log(`    ✗ download/convert failed — ${err.message}`);
      report.missing.push({ id: celeb.id, name: celeb.name, reason: `Download/convert failed: ${err.message}` });
    }

    if (!opts.dryRun) await sleep(INTER_CELEBRITY_DELAY_MS);
  }

  return report;
}

/**
 * Regenerates banner.webp for every already-downloaded Wikimedia celebrity
 * photo directly from the local portrait.webp — no network calls. Used when
 * the banner-compositing logic changes and existing banners need to catch
 * up without re-fetching from Wikimedia.
 */
export async function refreshWikimediaBanners(manifest) {
  const celebrities = loadCelebrities();
  let refreshed = 0, skipped = 0;

  for (const celeb of celebrities) {
    const portraitPath = `assets/celebrities/${celeb.id}/portrait.webp`;
    const bannerPath = `assets/celebrities/${celeb.id}/banner.webp`;
    const slot = getSlot(manifest, portraitPath);
    if (slot.backend !== "wikimedia") { skipped++; continue; }

    const localPortraitFile = join(PUBLIC_DIR, ...portraitPath.split("/"));
    if (!existsSync(localPortraitFile)) { skipped++; continue; }

    const portraitBuffer = readFileSync(localPortraitFile);
    const banner = await toBannerWebp(portraitBuffer);
    await writeImage(join(PUBLIC_DIR, ...bannerPath.split("/")), banner.buffer);

    const now = new Date().toISOString();
    updateSlot(manifest, bannerPath, { width: banner.width, height: banner.height, lastVerified: now });
    console.log(`  ✓ refreshed banner — ${celeb.id}`);
    refreshed++;
  }

  return { refreshed, skipped };
}
