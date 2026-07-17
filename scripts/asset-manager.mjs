#!/usr/bin/env node
/**
 * CelebStyle asset-manager — unified local AI asset pipeline.
 *
 * node scripts/asset-manager.mjs status
 * node scripts/asset-manager.mjs generate --batch=1                       # 30-image review batch
 * node scripts/asset-manager.mjs generate [--only=celebrities|outfits|garments|collections|banners|stylist|wardrobe|tryon]
 *                                          [--tier=hero|bulk] [--force] [--dry-run] [--paths=a,b,c]
 * node scripts/asset-manager.mjs retry-failed
 * node scripts/asset-manager.mjs verify-all
 * node scripts/asset-manager.mjs report [--format=md|json] [--out=path]
 * node scripts/asset-manager.mjs wikimedia-import [--dry-run] [--celebrity=<id>]
 * node scripts/asset-manager.mjs import-envato-tryon-pilot                # Virtual Try-On pilot (10 outfits) — see envato-import/tryon-pilot/README.md
 *
 * See scripts/asset-manager/ for the individual modules this composes.
 */
import { join } from "path";
import { writeFileSync, readFileSync } from "fs";
import {
  loadManifest,
  saveManifest,
  getSlot,
  updateSlot,
  isGenerated,
  setFashionDNA,
  PUBLIC_DIR,
  ROOT,
} from "./asset-manager/manifest.mjs";
import { buildAllSlots, buildBatch1Slots, buildCelebrityDNAMap } from "./asset-manager/slots.mjs";
import { encodeToWebp, writeImage, readImageMeta } from "./asset-manager/encode.mjs";
import { extractTransparency } from "./asset-manager/chroma-key.mjs";
import { checkQuality } from "./asset-manager/quality-check.mjs";
import * as pollinations from "./asset-manager/backends/pollinations.mjs";
import * as replicate from "./asset-manager/backends/replicate.mjs";
import { buildReport, printReport, writeReportFile } from "./asset-manager/report.mjs";
import { runWikimediaImport, refreshWikimediaBanners } from "./asset-manager/wikimedia-import.mjs";
import { importEnvatoTryonPilot, printImportSummary } from "./tryon-pilot/import-envato.mjs";

// Both free/unpaid-tier backends rate-limit hard on burst traffic
// (Replicate: 6/min, burst 1, until a payment method is on file;
// Pollinations: aggressive anonymous throttling) — keep concurrency low.
const HERO_CONCURRENCY = 1;
const BULK_CONCURRENCY = 2;

// ── Arg parsing ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (const arg of rest) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] ?? true;
  }
  return { command, flags };
}

function promptHash(prompt) {
  let hash = 0;
  for (const ch of prompt) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

// ── Slot selection ────────────────────────────────────────────────────────────────

const ONLY_TO_KIND_PREFIX = {
  celebrities: ["celebrity-"],
  outfits: ["outfit-"],
  garments: ["outfit-garment", "generic-garment"],
  collections: ["collection-"],
  banners: ["banner"],
  stylist: ["stylist-"],
  wardrobe: ["wardrobe-"],
  tryon: ["tryon-"],
};

function selectSlots(flags) {
  if (flags.batch === "1" || flags.batch === 1) return buildBatch1Slots();

  let slots = buildAllSlots();

  if (flags.only) {
    const prefixes = ONLY_TO_KIND_PREFIX[flags.only] ?? [];
    slots = slots.filter((s) => prefixes.some((p) => s.kind.startsWith(p)));
  }
  if (flags.tier) {
    slots = slots.filter((s) => s.tier === flags.tier);
  }
  if (flags.paths) {
    const wanted = new Set(String(flags.paths).split(",").map((p) => p.trim()));
    slots = slots.filter((s) => wanted.has(s.path));
  }
  return slots;
}

// ── Concurrency pool ───────────────────────────────────────────────────────────────

async function runPool(tasks, concurrency) {
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      await task();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}

// ── Per-slot generation ────────────────────────────────────────────────────────────

async function generateSlot(manifest, slot, runState) {
  const existing = getSlot(manifest, slot.path);
  const attempts = (existing.attempts ?? 0) + 1;
  let backendUsed = slot.tier === "hero" ? "replicate" : "pollinations";
  let modelUsed = slot.tier === "hero" ? replicate.MODEL_NAME : pollinations.MODEL_NAME;
  let needsPaidUpgrade = false;

  try {
    let rawBuffer;

    if (slot.tier === "hero" && !runState.replicateOutOfCredit) {
      try {
        rawBuffer = await replicate.generate(slot.prompt, slot.seed);
      } catch (err) {
        if (err.name === "OutOfCreditError") {
          runState.replicateOutOfCredit = true;
        } else {
          throw err;
        }
      }
    }

    if (!rawBuffer) {
      // Bulk tier, or hero tier falling back because Replicate has no credit.
      backendUsed = "pollinations";
      modelUsed = pollinations.MODEL_NAME;
      if (slot.tier === "hero") needsPaidUpgrade = true;
      rawBuffer = await pollinations.generate(slot.prompt, slot.seed);
    }

    let qualityFlag = null;

    if (slot.transparent) {
      const extracted = await extractTransparency(rawBuffer, slot.chromaColor);
      if (extracted.failed) {
        qualityFlag = "chroma-key-failed";
        needsPaidUpgrade = true;
      }
      rawBuffer = extracted.buffer;
    } else if (backendUsed === "pollinations") {
      const quality = await checkQuality(rawBuffer);
      if (quality.flagged) {
        qualityFlag = quality.reason;
        needsPaidUpgrade = true;
      }
    }

    const encoded = await encodeToWebp(rawBuffer, { alpha: Boolean(slot.transparent) });
    const destPath = join(PUBLIC_DIR, ...slot.path.split("/"));
    await writeImage(destPath, encoded.buffer);

    const now = new Date().toISOString();
    updateSlot(manifest, slot.path, {
      prompt: slot.prompt,
      backend: backendUsed,
      model: modelUsed,
      seed: slot.seed,
      generatedAt: now,
      width: encoded.width,
      height: encoded.height,
      status: "generated",
      needsPaidUpgrade,
      qualityFlag,
      lastVerified: now,
      error: null,
      attempts,
      promptHash: promptHash(slot.prompt),
    });
    console.log(`  ✓ [${slot.tier}/${backendUsed}] ${slot.path}${qualityFlag ? ` (flagged: ${qualityFlag})` : ""}`);
  } catch (err) {
    updateSlot(manifest, slot.path, {
      status: "failed",
      error: err.message,
      attempts,
    });
    console.warn(`  ✗ ${slot.path} — ${err.message}`);
  }
}

// ── Fashion DNA sync ──────────────────────────────────────────────────────────────
// Recomputes every celebrity's Fashion DNA (outfit-data-only, no name-based
// inference) and persists it into the manifest so it's available for the
// admin UI / future regenerations without recomputing. Cheap, no network
// calls — safe to run before every status/generate invocation.

function syncCelebrityDNA(manifest) {
  const dnaMap = buildCelebrityDNAMap();
  for (const [celebId, dna] of Object.entries(dnaMap)) {
    setFashionDNA(manifest, celebId, dna);
  }
  return Object.keys(dnaMap).length;
}

// ── Commands ────────────────────────────────────────────────────────────────────────

function cmdStatus() {
  const manifest = loadManifest();
  syncCelebrityDNA(manifest);
  const all = buildAllSlots();
  const report = buildReport(manifest, all);
  console.log(`\nAsset manifest status — ${all.length} required slots total`);
  printReport(report);
}

function cmdSyncDna() {
  const manifest = loadManifest();
  const count = syncCelebrityDNA(manifest);
  console.log(`\nFashion DNA synced for ${count} celebrities into scripts/asset-manifest.json ("fashionDNA" key).\n`);
}

async function cmdGenerate(flags) {
  const manifest = loadManifest();
  syncCelebrityDNA(manifest);
  let slots = selectSlots(flags);

  if (!flags.force) {
    slots = slots.filter((s) => !isGenerated(manifest, s.path));
  }

  if (flags["dry-run"]) {
    console.log(`\nDRY RUN — would generate ${slots.length} slot(s), no network calls made.\n`);
    const byTier = { hero: 0, bulk: 0 };
    for (const s of slots) byTier[s.tier]++;
    console.log(`  hero (Replicate): ${byTier.hero}`);
    console.log(`  bulk (Pollinations): ${byTier.bulk}`);
    for (const s of slots.slice(0, 20)) {
      console.log(`    [${s.tier}] ${s.path}`);
    }
    if (slots.length > 20) console.log(`    ... and ${slots.length - 20} more`);
    console.log("");
    return;
  }

  if (slots.length === 0) {
    console.log("\nNothing to generate — all selected slots already have status \"generated\". Use --force to regenerate.\n");
    return;
  }

  console.log(`\nGenerating ${slots.length} slot(s)...\n`);
  const runState = { replicateOutOfCredit: false };
  const heroTasks = slots.filter((s) => s.tier === "hero").map((s) => () => generateSlot(manifest, s, runState));
  const bulkTasks = slots.filter((s) => s.tier === "bulk").map((s) => () => generateSlot(manifest, s, runState));

  await Promise.all([runPool(heroTasks, HERO_CONCURRENCY), runPool(bulkTasks, BULK_CONCURRENCY)]);

  const report = buildReport(manifest, slots);
  printReport(report);
  if (runState.replicateOutOfCredit) {
    console.log("  Note: Replicate returned 402 (no credit) during this run — hero-tier slots were");
    console.log("  filled via the Pollinations fallback and flagged needsPaidUpgrade: true.\n");
  }
}

async function cmdRetryFailed() {
  const manifest = loadManifest();
  const all = buildAllSlots();
  const bySlotPath = new Map(all.map((s) => [s.path, s]));
  const failedPaths = Object.entries(manifest.slots)
    .filter(([, entry]) => entry.status === "failed")
    .map(([path]) => path);

  const slots = failedPaths.map((p) => bySlotPath.get(p)).filter(Boolean);
  if (slots.length === 0) {
    console.log("\nNo failed slots to retry.\n");
    return;
  }
  console.log(`\nRetrying ${slots.length} failed slot(s)...\n`);
  const runState = { replicateOutOfCredit: false };
  const heroTasks = slots.filter((s) => s.tier === "hero").map((s) => () => generateSlot(manifest, s, runState));
  const bulkTasks = slots.filter((s) => s.tier === "bulk").map((s) => () => generateSlot(manifest, s, runState));
  await Promise.all([runPool(heroTasks, HERO_CONCURRENCY), runPool(bulkTasks, BULK_CONCURRENCY)]);
  printReport(buildReport(manifest, slots));
}

async function cmdVerifyAll() {
  const manifest = loadManifest();
  const all = buildAllSlots();
  console.log(`\nVerifying ${all.length} slot(s) against disk...\n`);

  for (const slot of all) {
    const entry = getSlot(manifest, slot.path);
    if (entry.status !== "generated") continue;
    const destPath = join(PUBLIC_DIR, ...slot.path.split("/"));
    try {
      const meta = await readImageMeta(destPath);
      updateSlot(manifest, slot.path, { lastVerified: new Date().toISOString(), width: meta.width, height: meta.height });
    } catch {
      updateSlot(manifest, slot.path, { status: "broken" });
      console.warn(`  ✗ broken: ${slot.path}`);
    }
  }

  const report = buildReport(manifest, all);
  printReport(report);
}

function cmdReport(flags) {
  const manifest = loadManifest();
  const all = buildAllSlots();
  const report = buildReport(manifest, all);
  printReport(report);
  if (flags.out) {
    writeReportFile(report, flags.format ?? "md", flags.out);
    console.log(`  Report written to ${flags.out}\n`);
  }
}

const ASSET_REPORT_PATH = join(ROOT, "scripts", "asset-report.json");

async function cmdWikimediaImport(flags) {
  const manifest = loadManifest();
  console.log(`\nWikimedia Commons import — ${flags["dry-run"] ? "DRY RUN, no downloads" : "downloading verified-license images"}\n`);

  const report = await runWikimediaImport(manifest, {
    dryRun: Boolean(flags["dry-run"]),
    onlyCelebrityId: flags.celebrity,
    onlyCelebrityIds: flags.celebrities ? String(flags.celebrities).split(",") : undefined,
  });

  // Merge into any existing report from a prior run rather than clobbering it,
  // so a targeted retry pass doesn't erase the previous run's findings.
  let existing = { downloaded: [], missing: [], licenseInfo: [], attributionRequirements: [] };
  try {
    existing = JSON.parse(readFileSync(ASSET_REPORT_PATH, "utf8"));
  } catch { /* no prior report — start fresh */ }
  const retriedIds = new Set([...report.downloaded, ...report.missing].map((e) => e.id));
  const merged = {
    downloaded: [...existing.downloaded.filter((e) => !retriedIds.has(e.id)), ...report.downloaded],
    missing: [...existing.missing.filter((e) => !retriedIds.has(e.id)), ...report.missing],
    licenseInfo: [...existing.licenseInfo.filter((e) => !retriedIds.has(e.id)), ...report.licenseInfo],
    attributionRequirements: [...existing.attributionRequirements.filter((e) => !retriedIds.has(e.id)), ...report.attributionRequirements],
  };
  writeFileSync(ASSET_REPORT_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");

  console.log(`\n─── Wikimedia import report (this run) ───`);
  console.log(`  downloaded:                ${report.downloaded.length}`);
  console.log(`  missing:                   ${report.missing.length}`);
  console.log(`  attribution required:      ${report.attributionRequirements.length}`);
  if (report.missing.length > 0) {
    console.log(`\n  Missing (kept existing asset, if any):`);
    for (const m of report.missing) console.log(`    - ${m.id}: ${m.reason}`);
  }
  console.log(`\n  Full report written to scripts/asset-report.json\n`);
}

async function cmdImportEnvatoTryonPilot() {
  console.log(`\nImporting Envato garment images for the Virtual Try-On pilot (10 outfits only)...\n`);
  const result = await importEnvatoTryonPilot();
  printImportSummary(result);
}

async function cmdRefreshBanners() {
  const manifest = loadManifest();
  console.log(`\nRefreshing Wikimedia celebrity banners from local portraits (no network calls)...\n`);
  const { refreshed, skipped } = await refreshWikimediaBanners(manifest);
  console.log(`\n  refreshed: ${refreshed}, skipped (not wikimedia-sourced or missing portrait): ${skipped}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────────────

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "status":
      cmdStatus();
      break;
    case "generate":
      await cmdGenerate(flags);
      break;
    case "retry-failed":
      await cmdRetryFailed();
      break;
    case "verify-all":
      await cmdVerifyAll();
      break;
    case "report":
      cmdReport(flags);
      break;
    case "sync-dna":
      cmdSyncDna();
      break;
    case "wikimedia-import":
      await cmdWikimediaImport(flags);
      break;
    case "refresh-banners":
      await cmdRefreshBanners();
      break;
    case "import-envato-tryon-pilot":
      await cmdImportEnvatoTryonPilot();
      break;
    default:
      console.log(`Usage: node scripts/asset-manager.mjs <status|generate|retry-failed|verify-all|report|sync-dna|wikimedia-import|refresh-banners|import-envato-tryon-pilot> [flags]`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
