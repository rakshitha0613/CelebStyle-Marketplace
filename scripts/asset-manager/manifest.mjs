/**
 * Manifest — the single source of truth for what has actually been generated.
 *
 * Every target image path already has a *fake* placeholder file sitting at it
 * (rasterized SVGs / flat gradients), so file existence on disk can never be
 * trusted. Only `status === "generated"` in the manifest means "this is a
 * real AI-generated photo" — everything else (absent, "failed",
 * "never-attempted", "broken") means the slot must be (re)generated.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..");
export const MANIFEST_PATH = join(ROOT, "scripts", "asset-manifest.json");
// Slot paths are stored relative to apps/frontend/public/ (e.g. "assets/celebrities/<id>/portrait.webp").
export const PUBLIC_DIR = join(ROOT, "apps", "frontend", "public");

const SCHEMA_VERSION = 2;

/** @typedef {"generated"|"failed"|"never-attempted"|"broken"} SlotStatus */

/**
 * @typedef {Object} SlotEntry
 * @property {string} prompt
 * @property {"pollinations"|"replicate"|"manual-upload"} backend
 * @property {string} model
 * @property {number|null} seed
 * @property {string|null} generatedAt
 * @property {number|null} width
 * @property {number|null} height
 * @property {SlotStatus} status
 * @property {boolean} needsPaidUpgrade
 * @property {string|null} qualityFlag
 * @property {string|null} lastVerified
 * @property {string|null} error
 * @property {number} attempts
 * @property {string|null} promptHash
 */

function emptyManifest() {
  return { version: SCHEMA_VERSION, slots: {}, fashionDNA: {} };
}

export function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest();
  try {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    if (!raw || typeof raw !== "object" || !raw.slots) return emptyManifest();
    if (!raw.fashionDNA) { raw.fashionDNA = {}; raw.version = SCHEMA_VERSION; } // migrate manifests written before schema v2
    return raw;
  } catch {
    return emptyManifest();
  }
}

/** Atomic write: write to a temp file in the same dir, then rename over the target. */
export function saveManifest(manifest) {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  const tmpPath = `${MANIFEST_PATH}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  renameSync(tmpPath, MANIFEST_PATH);
}

/** Default (unpopulated) shape for a slot that has never been touched. */
export function defaultSlot() {
  return {
    prompt: null,
    backend: null,
    model: null,
    seed: null,
    generatedAt: null,
    width: null,
    height: null,
    status: "never-attempted",
    needsPaidUpgrade: false,
    qualityFlag: null,
    lastVerified: null,
    error: null,
    attempts: 0,
    promptHash: null,
    // Provenance — populated when backend === "wikimedia" (or any other
    // real-photo source in future); null for AI-generated slots.
    sourceUrl: null,
    license: null,
    attribution: null,
  };
}

export function getSlot(manifest, relPath) {
  return manifest.slots[relPath] ?? defaultSlot();
}

/** Merge a patch into a slot and persist the whole manifest immediately (Ctrl+C-safe). */
export function updateSlot(manifest, relPath, patch) {
  const current = manifest.slots[relPath] ?? defaultSlot();
  manifest.slots[relPath] = { ...current, ...patch };
  saveManifest(manifest);
  return manifest.slots[relPath];
}

/** True only when a slot holds a real, previously-generated image. */
export function isGenerated(manifest, relPath) {
  return getSlot(manifest, relPath).status === "generated";
}

// ── Fashion DNA (per-celebrity style profile, reused across regenerations) ─────

export function getFashionDNA(manifest, celebId) {
  return manifest.fashionDNA?.[celebId] ?? null;
}

/** Stores/refreshes one celebrity's Fashion DNA and persists immediately. */
export function setFashionDNA(manifest, celebId, dna) {
  if (!manifest.fashionDNA) manifest.fashionDNA = {};
  manifest.fashionDNA[celebId] = dna;
  saveManifest(manifest);
  return dna;
}
