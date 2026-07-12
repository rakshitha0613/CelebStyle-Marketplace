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
 * Maps a GarmentType to a generic transparent PNG in /public/assets/garments/.
 * Used as fallback when an outfit-specific garment.png is not available.
 */
const GARMENT_TYPE_FALLBACK: Record<GarmentType, string> = {
  T_SHIRT:      '/assets/garments/t_shirt.png',
  SHIRT:        '/assets/garments/shirt.png',
  JACKET:       '/assets/garments/jacket.png',
  HOODIE:       '/assets/garments/hoodie.png',
  DRESS:        '/assets/garments/dress.png',
  KURTA:        '/assets/garments/kurta.png',
  SAREE:        '/assets/garments/saree.png',
  LEHENGA:      '/assets/garments/lehenga.png',
  SHERWANI:     '/assets/garments/sherwani.png',
  BLAZER:       '/assets/garments/blazer.png',
  SUIT:         '/assets/garments/suit.png',
  INDO_WESTERN: '/assets/garments/indo_western.png',
};

export const GARMENT_PLACEHOLDER_URL = '/assets/garments/placeholder.png';

/** Converts a single Outfit to a GarmentAsset for the AR rendering pipeline. */
export function outfitToGarment(outfit: Outfit): GarmentAsset {
  const type = categoryToGarmentType(outfit.category);
  const dims = NATURAL_DIMS[type];
  // Prefer outfit-specific garment PNG; fall back to generic type silhouette
  const imageUrl = `/assets/outfits/${outfit.id}/garment.png`;
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
export function outfitsToGarments(outfits: Outfit[]): GarmentAsset[] {
  return outfits.map(outfitToGarment);
}
