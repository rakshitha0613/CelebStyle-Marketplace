/**
 * Builds the full list of required image slots from the app's real data
 * sources — no duplicated/hardcoded catalogue. Celebrities come straight
 * from celebs-seed.json (already JSON). Outfits are parsed out of
 * apps/backend/src/data/catalogue.ts's `outfitRecords` array by a small
 * bracket-depth scanner (that file is plain TypeScript, not importable
 * from a plain `node` process without a TS loader, so we read it as text
 * instead of hardcoding a second copy of the 100 records).
 *
 * Collection definitions here intentionally mirror
 * apps/backend/src/data/collections.ts (same 6 slugs/filters) — kept small
 * and duplicated on purpose rather than trying to import backend TS.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./manifest.mjs";
import { pickChromaColor } from "./chroma-key.mjs";
import { buildCelebrityPersona, computeFashionDNA } from "./celebrity-style.mjs";
import {
  celebrityPortraitPrompt,
  celebrityBannerPrompt,
  outfitHeroPrompt,
  outfitDetail1Prompt,
  outfitDetail2Prompt,
  outfitFabricPrompt,
  outfitThumbPrompt,
  outfitGarmentPrompt,
  genericGarmentPrompt,
  collectionCoverPrompt,
  bannerPrompt,
  stylistHeroPrompt,
  wardrobeEmptyStatePrompt,
  tryonHeroPrompt,
  BANNER_PROMPTS,
} from "./prompts.mjs";

const CATALOGUE_PATH = join(ROOT, "apps", "backend", "src", "data", "catalogue.ts");
const CELEBS_SEED_PATH = join(ROOT, "apps", "backend", "src", "data", "celebs-seed.json");

// ── Data loaders ────────────────────────────────────────────────────────────────

export function loadCelebrities() {
  const seed = JSON.parse(readFileSync(CELEBS_SEED_PATH, "utf8"));
  return seed.records.map((r) => ({
    id: r.id,
    name: r.name,
    industry: r.industry,
    bio: r.bio,
    styleTags: r.styleTags ?? [],
  }));
}

function extractField(block, name, isNumber = false) {
  const re = isNumber ? new RegExp(`${name}:\\s*(\\d+)`) : new RegExp(`${name}:\\s*"([^"]*)"`);
  const m = block.match(re);
  if (!m) return undefined;
  return isNumber ? Number(m[1]) : m[1];
}

export function loadOutfits() {
  const text = readFileSync(CATALOGUE_PATH, "utf8");
  const marker = "export const outfitRecords: OutfitRecord[] = [";
  const startIdx = text.indexOf(marker);
  if (startIdx === -1) throw new Error("Could not find outfitRecords in catalogue.ts");
  const arrayBody = text.slice(startIdx + marker.length);

  const blocks = [];
  let depth = 0;
  let current = "";
  let inBlock = false;
  for (const ch of arrayBody) {
    if (ch === "{") {
      depth++;
      inBlock = true;
    }
    if (inBlock) current += ch;
    if (ch === "}") {
      depth--;
      if (depth === 0 && inBlock) {
        blocks.push(current);
        current = "";
        inBlock = false;
      }
    }
  }

  return blocks
    .map((block) => ({
      id: extractField(block, "id"),
      celebrityId: extractField(block, "celebrityId"),
      movieName: extractField(block, "movieName"),
      occasion: extractField(block, "occasion"),
      category: extractField(block, "category"),
      colorPalette: extractField(block, "colorPalette"),
      price: extractField(block, "price", true),
      characterName: extractField(block, "characterName"),
      description: extractField(block, "description"),
    }))
    .filter((o) => Boolean(o.id));
}

// ── Collection definitions (mirrors apps/backend/src/data/collections.ts) ──────

export const COLLECTION_DEFS = [
  { slug: "festive-edit", name: "Festive Edit", filter: (o) => o.id.startsWith("look-festive-") },
  { slug: "luxury-atelier", name: "Luxury Atelier", filter: (o) => o.id.startsWith("look-luxury-") },
  {
    slug: "cinematic-icons",
    name: "Cinematic Icons",
    filter: (o) => !o.id.startsWith("look-festive-") && !o.id.startsWith("look-luxury-"),
  },
  { slug: "wedding-edit", name: "Wedding Edit", filter: (o) => o.occasion === "Wedding" },
  { slug: "red-carpet-icons", name: "Red Carpet Icons", filter: (o) => o.occasion === "Party" },
  {
    slug: "power-dressing",
    name: "Power Dressing",
    filter: (o) => /suit|blazer|bandhgala|tuxedo/i.test(o.category || ""),
  },
];

export const GENERIC_GARMENT_TYPES = [
  "T_SHIRT", "SHIRT", "JACKET", "HOODIE", "DRESS", "KURTA",
  "SAREE", "LEHENGA", "SHERWANI", "BLAZER", "SUIT", "INDO_WESTERN",
];

function seedFromString(str) {
  let seed = 0;
  for (const ch of str) seed = (seed * 31 + ch.charCodeAt(0)) % 1_000_000;
  return seed;
}

// ── Slot builders ────────────────────────────────────────────────────────────────
// Each slot: { path, tier: "hero"|"bulk", kind, prompt, seed, transparent, chromaColor }

function celebritySlots(celebrities, outfits) {
  const slots = [];
  for (const c of celebrities) {
    const persona = buildCelebrityPersona(c, outfits);

    slots.push({
      path: `assets/celebrities/${c.id}/portrait.webp`,
      tier: "hero",
      kind: "celebrity-portrait",
      prompt: celebrityPortraitPrompt(persona),
      seed: seedFromString(c.id),
    });
    slots.push({
      path: `assets/celebrities/${c.id}/banner.webp`,
      tier: "bulk",
      kind: "celebrity-banner",
      prompt: celebrityBannerPrompt(persona),
      seed: seedFromString(c.id) + 1,
    });
  }
  return slots;
}

function outfitSlots(outfits) {
  const slots = [];
  for (const o of outfits) {
    const seed = seedFromString(o.id);
    const chromaColor = pickChromaColor(o.colorPalette);

    slots.push({ path: `assets/outfits/${o.id}/hero.webp`, tier: "hero", kind: "outfit-hero", prompt: outfitHeroPrompt(o), seed });
    slots.push({ path: `assets/outfits/${o.id}/detail1.webp`, tier: "bulk", kind: "outfit-detail1", prompt: outfitDetail1Prompt(o), seed: seed + 1 });
    slots.push({ path: `assets/outfits/${o.id}/detail2.webp`, tier: "bulk", kind: "outfit-detail2", prompt: outfitDetail2Prompt(o), seed: seed + 2 });
    slots.push({ path: `assets/outfits/${o.id}/fabric.webp`, tier: "bulk", kind: "outfit-fabric", prompt: outfitFabricPrompt(o), seed: seed + 3 });
    slots.push({ path: `assets/outfits/${o.id}/thumb.webp`, tier: "bulk", kind: "outfit-thumb", prompt: outfitThumbPrompt(o), seed: seed + 4 });
    slots.push({
      path: `assets/outfits/${o.id}/garment.webp`,
      tier: "bulk",
      kind: "outfit-garment",
      prompt: outfitGarmentPrompt(o, chromaColor),
      seed: seed + 5,
      transparent: true,
      chromaColor,
    });
  }
  return slots;
}

function genericGarmentSlots() {
  return GENERIC_GARMENT_TYPES.map((type, i) => {
    const chromaColor = ["green", "blue", "magenta"][i % 3];
    return {
      path: `assets/garments/${type.toLowerCase()}.webp`,
      tier: "bulk",
      kind: "generic-garment",
      prompt: genericGarmentPrompt(type, chromaColor),
      seed: seedFromString(type),
      transparent: true,
      chromaColor,
    };
  });
}

function collectionSlots(outfits) {
  return COLLECTION_DEFS.map((def) => {
    const matches = outfits.filter(def.filter).slice(0, 5);
    const dominantColors = [...new Set(matches.map((o) => o.colorPalette).filter(Boolean))].slice(0, 2).join(", ") || "gold, ivory";
    const dominantCategory = [...new Set(matches.map((o) => o.category).filter(Boolean))].slice(0, 2).join(" and ") || "statement pieces";
    return {
      path: `assets/collections/${def.slug}/cover.webp`,
      tier: "hero",
      kind: "collection-cover",
      prompt: collectionCoverPrompt({ name: def.name, dominantColors, dominantCategory }),
      seed: seedFromString(def.slug),
    };
  });
}

function bannerSlots() {
  return Object.keys(BANNER_PROMPTS).map((slug) => ({
    path: `assets/banners/${slug}.webp`,
    tier: "bulk",
    kind: "banner",
    prompt: bannerPrompt(slug),
    seed: seedFromString(slug),
  }));
}

function stylistSlots() {
  return [{ path: "assets/stylist/hero.webp", tier: "bulk", kind: "stylist-hero", prompt: stylistHeroPrompt(), seed: seedFromString("stylist-hero") }];
}

function wardrobeSlots() {
  const kinds = ["empty-recently-viewed", "empty-wishlist", "empty-tryon"];
  return kinds.map((kind) => ({
    path: `assets/wardrobe/${kind}.webp`,
    tier: "bulk",
    kind: "wardrobe-empty-state",
    prompt: wardrobeEmptyStatePrompt(kind),
    seed: seedFromString(kind),
  }));
}

function tryonSlots() {
  return [{ path: "assets/tryon/hero.webp", tier: "bulk", kind: "tryon-hero", prompt: tryonHeroPrompt(), seed: seedFromString("tryon-hero") }];
}

/** Every required asset in the app, tagged with its generation tier. */
export function buildAllSlots() {
  const celebrities = loadCelebrities();
  const outfits = loadOutfits();
  return [
    ...celebritySlots(celebrities, outfits),
    ...outfitSlots(outfits),
    ...genericGarmentSlots(),
    ...collectionSlots(outfits),
    ...bannerSlots(),
    ...stylistSlots(),
    ...wardrobeSlots(),
    ...tryonSlots(),
  ];
}

/**
 * Computes Fashion DNA for every celebrity (pure — outfit data only, no
 * name-based inference). Callers persist this into the manifest via
 * manifest.mjs's setFashionDNA so it's stored for reuse across regenerations.
 * @returns {Record<string, ReturnType<typeof computeFashionDNA>>}
 */
export function buildCelebrityDNAMap() {
  const celebrities = loadCelebrities();
  const outfits = loadOutfits();
  const map = {};
  for (const c of celebrities) {
    map[c.id] = computeFashionDNA(c, outfits);
  }
  return map;
}

function pickSpread(array, n) {
  if (array.length <= n) return array;
  const indices = Array.from({ length: n }, (_, i) => Math.floor((i * array.length) / n));
  return [...new Set(indices)].map((i) => array[i]);
}

/**
 * The review batch (requirement #1): 10 celebrity portraits, 10 outfit
 * heroes, 5 banners, 5 of 6 collection covers = 30 images. Picked as a
 * spread across the full lists, not the first N, for representative QA.
 */
export function buildBatch1Slots() {
  const all = buildAllSlots();
  const celebPortraits = pickSpread(all.filter((s) => s.kind === "celebrity-portrait"), 10);
  const outfitHeroes = pickSpread(all.filter((s) => s.kind === "outfit-hero"), 10);
  const banners = all.filter((s) => s.kind === "banner"); // exactly 5
  const collectionCovers = all.filter((s) => s.kind === "collection-cover").slice(0, 5);
  return [...celebPortraits, ...outfitHeroes, ...banners, ...collectionCovers];
}
