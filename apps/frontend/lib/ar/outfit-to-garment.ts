import type { GarmentAsset, GarmentType, GarmentAnchors } from './garment.types.js';
import { GARMENT_SCALE_MULTIPLIERS } from './garment-alignment.service.js';
import type { Outfit } from '@/lib/api';

/**
 * Shoulder anchor Y = fraction of garment image from the top where the
 * shoulder seam sits. Lower values → more collar visible above the shoulders.
 * Hip anchor Y = fraction where the waist/hem falls (used for belt alignment).
 *
 * These are normalised within the garment IMAGE coordinate space (0–1).
 */
const ANCHOR_MAP: Record<GarmentType, GarmentAnchors> = {
  T_SHIRT: {
    leftShoulder:  { x: 0.20, y: 0.09 },
    rightShoulder: { x: 0.80, y: 0.09 },
    leftHip:       { x: 0.26, y: 0.78 },
    rightHip:      { x: 0.74, y: 0.78 },
  },
  SHIRT: {
    leftShoulder:  { x: 0.18, y: 0.08 },
    rightShoulder: { x: 0.82, y: 0.08 },
    leftHip:       { x: 0.24, y: 0.80 },
    rightHip:      { x: 0.76, y: 0.80 },
  },
  JACKET: {
    leftShoulder:  { x: 0.15, y: 0.07 },
    rightShoulder: { x: 0.85, y: 0.07 },
    leftHip:       { x: 0.22, y: 0.78 },
    rightHip:      { x: 0.78, y: 0.78 },
  },
  HOODIE: {
    leftShoulder:  { x: 0.19, y: 0.10 },
    rightShoulder: { x: 0.81, y: 0.10 },
    leftHip:       { x: 0.26, y: 0.82 },
    rightHip:      { x: 0.74, y: 0.82 },
  },
  DRESS: {
    leftShoulder:  { x: 0.22, y: 0.06 },
    rightShoulder: { x: 0.78, y: 0.06 },
    leftHip:       { x: 0.28, y: 0.38 },
    rightHip:      { x: 0.72, y: 0.38 },
  },
  KURTA: {
    leftShoulder:  { x: 0.20, y: 0.07 },
    rightShoulder: { x: 0.80, y: 0.07 },
    leftHip:       { x: 0.26, y: 0.50 },
    rightHip:      { x: 0.74, y: 0.50 },
  },
  SAREE: {
    leftShoulder:  { x: 0.22, y: 0.05 },
    rightShoulder: { x: 0.78, y: 0.05 },
    leftHip:       { x: 0.28, y: 0.35 },
    rightHip:      { x: 0.72, y: 0.35 },
  },
  LEHENGA: {
    leftShoulder:  { x: 0.22, y: 0.06 },
    rightShoulder: { x: 0.78, y: 0.06 },
    leftHip:       { x: 0.28, y: 0.40 },
    rightHip:      { x: 0.72, y: 0.40 },
  },
  SHERWANI: {
    leftShoulder:  { x: 0.16, y: 0.07 },
    rightShoulder: { x: 0.84, y: 0.07 },
    leftHip:       { x: 0.22, y: 0.46 },
    rightHip:      { x: 0.78, y: 0.46 },
  },
  BLAZER: {
    leftShoulder:  { x: 0.14, y: 0.06 },
    rightShoulder: { x: 0.86, y: 0.06 },
    leftHip:       { x: 0.21, y: 0.78 },
    rightHip:      { x: 0.79, y: 0.78 },
  },
  SUIT: {
    leftShoulder:  { x: 0.13, y: 0.06 },
    rightShoulder: { x: 0.87, y: 0.06 },
    leftHip:       { x: 0.20, y: 0.78 },
    rightHip:      { x: 0.80, y: 0.78 },
  },
  INDO_WESTERN: {
    leftShoulder:  { x: 0.18, y: 0.07 },
    rightShoulder: { x: 0.82, y: 0.07 },
    leftHip:       { x: 0.24, y: 0.50 },
    rightHip:      { x: 0.76, y: 0.50 },
  },
};

// Reference natural dimensions per type — only used as aspect-ratio fallback
// when the actual image dimensions aren't yet known. Heights are intentionally
// tall so that garment images with varied ratios aren't distorted at load time.
const NATURAL_DIMS: Record<GarmentType, { w: number; h: number }> = {
  T_SHIRT:      { w: 400, h: 420 },
  SHIRT:        { w: 400, h: 460 },
  JACKET:       { w: 420, h: 500 },
  HOODIE:       { w: 420, h: 480 },
  DRESS:        { w: 380, h: 760 },
  KURTA:        { w: 400, h: 680 },
  SAREE:        { w: 420, h: 900 },
  LEHENGA:      { w: 420, h: 820 },
  SHERWANI:     { w: 420, h: 720 },
  BLAZER:       { w: 420, h: 500 },
  SUIT:         { w: 420, h: 520 },
  INDO_WESTERN: { w: 400, h: 620 },
};

/**
 * Maps an outfit category string to a GarmentType for the AR pipeline.
 * Matching is broadest-first: longer/more-specific strings are checked first
 * to avoid false positives (e.g. "blazer" before "shirt").
 */
export function categoryToGarmentType(category: string): GarmentType {
  const c = category.toLowerCase().trim();

  // ── Long / ethnic ─────────────────────────────────────────────────────────
  if (c.includes('lehenga'))                                     return 'LEHENGA';
  if (c.includes('saree') || c.includes('sari'))                 return 'SAREE';
  if (c.includes('sherwani') || c.includes('sherwaani'))         return 'SHERWANI';
  if (c.includes('indo-western') || c.includes('indo western'))  return 'INDO_WESTERN';
  if (c.includes('kurta') || c.includes('kurti'))                return 'KURTA';

  // ── Formal / structured ───────────────────────────────────────────────────
  if (c.includes('suit') && (c.includes('pant') || c.includes('trouser') || c.includes('full')))
                                                                  return 'SUIT';
  if (c.includes('blazer'))                                       return 'BLAZER';
  if (c.includes('suit'))                                         return 'SUIT';
  if (c.includes('jacket') || c.includes('coat') || c.includes('overcoat')) return 'JACKET';

  // ── Casual tops ───────────────────────────────────────────────────────────
  if (c.includes('hoodie') || c.includes('sweatshirt'))          return 'HOODIE';
  if (c.includes('t-shirt') || c.includes('tshirt') || c === 't shirt' || c.includes('tee')) return 'T_SHIRT';

  // ── Full-length ───────────────────────────────────────────────────────────
  if (c.includes('dress') || c.includes('gown') || c.includes('anarkali')) return 'DRESS';

  // Default: SHIRT covers everything else (ethnic tops, formal shirts, etc.)
  return 'SHIRT';
}

/**
 * Maps a GarmentType to a generic transparent WebP cutout in /public/assets/garments/,
 * produced by scripts/asset-manager.mjs. Currently unused by outfitToGarment (which
 * always resolves to the outfit-specific cutout) — kept for future use as a fallback.
 */
const GARMENT_TYPE_FALLBACK: Record<GarmentType, string> = {
  T_SHIRT:      '/assets/garments/t_shirt.webp',
  SHIRT:        '/assets/garments/shirt.webp',
  JACKET:       '/assets/garments/jacket.webp',
  HOODIE:       '/assets/garments/hoodie.webp',
  DRESS:        '/assets/garments/dress.webp',
  KURTA:        '/assets/garments/kurta.webp',
  SAREE:        '/assets/garments/saree.webp',
  LEHENGA:      '/assets/garments/lehenga.webp',
  SHERWANI:     '/assets/garments/sherwani.webp',
  BLAZER:       '/assets/garments/blazer.webp',
  SUIT:         '/assets/garments/suit.webp',
  INDO_WESTERN: '/assets/garments/indo_western.webp',
};

export const GARMENT_PLACEHOLDER_URL = '/assets/garments/placeholder.png';

// ── Garment-image repair (Phase 1.5 → Phase 2) ──────────────────────────────────
// Phase 1.5 fixed this for the 10 TRYON_PILOT_OUTFIT_IDS pilot outfits; Phase 2
// extends the exact same resolver to the full catalog.
//
// Root cause: `garment.webp` was assumed for every outfit, but the garment
// cutout pipeline only ever exported `garment.png` (confirmed: 0/100 outfit
// folders have a .webp cutout, all 100 have a .png). Since this module runs
// in the browser (no filesystem access, unlike catalogue.ts's Node-side
// resolver), existence is checked the browser-safe way: attempt to load each
// candidate extension via an Image probe and take the first that succeeds.
const GARMENT_EXT_PRIORITY = ['webp', 'png', 'jpg'] as const;

function probeImageLoads(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false); // SSR guard
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function resolveGarmentImageUrl(outfitId: string): Promise<string> {
  for (const ext of GARMENT_EXT_PRIORITY) {
    const url = `/assets/outfits/${outfitId}/garment.${ext}`;
    if (await probeImageLoads(url)) return url;
  }
  return `/assets/outfits/${outfitId}/garment.webp`; // nothing found — legacy path, caller shows placeholder
}

/** Converts a single Outfit to a GarmentAsset for the AR rendering pipeline. */
export async function outfitToGarment(outfit: Outfit): Promise<GarmentAsset> {
  const type = categoryToGarmentType(outfit.category);
  const dims = NATURAL_DIMS[type];
  // Prefer outfit-specific garment cutout; fall back to generic type silhouette
  const imageUrl = await resolveGarmentImageUrl(outfit.id);
  return {
    id:             outfit.id,
    name:           `${outfit.celebrityName} — ${outfit.category}`,
    type,
    imageUrl,
    naturalWidth:   dims.w,
    naturalHeight:  dims.h,
    anchors:        ANCHOR_MAP[type],
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS[type] ?? 1.30,
  };
}

/** Converts a list of Outfits to GarmentAssets, preserving order. */
export async function outfitsToGarments(outfits: Outfit[]): Promise<GarmentAsset[]> {
  return Promise.all(outfits.map(outfitToGarment));
}
