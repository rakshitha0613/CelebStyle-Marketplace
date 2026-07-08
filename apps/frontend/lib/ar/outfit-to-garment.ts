import type { GarmentAsset, GarmentType, GarmentAnchors } from './garment.types.js';
import { GARMENT_SCALE_MULTIPLIERS } from './garment-alignment.service.js';
import type { Outfit } from '@/lib/api';

// Type-specific anchor points (normalized 0–1 in garment image space)
// leftShoulder/rightShoulder y-position controls how high above/below the
// detected shoulder midpoint the garment rides.
const ANCHOR_MAP: Record<GarmentType, GarmentAnchors> = {
  T_SHIRT: {
    leftShoulder:  { x: 0.18, y: 0.08 },
    rightShoulder: { x: 0.82, y: 0.08 },
    leftHip:       { x: 0.25, y: 0.78 },
    rightHip:      { x: 0.75, y: 0.78 },
  },
  SHIRT: {
    leftShoulder:  { x: 0.16, y: 0.07 },
    rightShoulder: { x: 0.84, y: 0.07 },
    leftHip:       { x: 0.24, y: 0.80 },
    rightHip:      { x: 0.76, y: 0.80 },
  },
  JACKET: {
    leftShoulder:  { x: 0.14, y: 0.06 },
    rightShoulder: { x: 0.86, y: 0.06 },
    leftHip:       { x: 0.22, y: 0.78 },
    rightHip:      { x: 0.78, y: 0.78 },
  },
  HOODIE: {
    leftShoulder:  { x: 0.17, y: 0.09 },
    rightShoulder: { x: 0.83, y: 0.09 },
    leftHip:       { x: 0.26, y: 0.82 },
    rightHip:      { x: 0.74, y: 0.82 },
  },
  DRESS: {
    leftShoulder:  { x: 0.20, y: 0.07 },
    rightShoulder: { x: 0.80, y: 0.07 },
    leftHip:       { x: 0.28, y: 0.48 },
    rightHip:      { x: 0.72, y: 0.48 },
  },
};

// Natural dimensions per garment type (width × height in logical pixels)
// Aspect ratios chosen to match typical garment photography proportions.
const NATURAL_DIMS: Record<GarmentType, { w: number; h: number }> = {
  T_SHIRT: { w: 400, h: 420 },
  SHIRT:   { w: 400, h: 460 },
  JACKET:  { w: 420, h: 500 },
  HOODIE:  { w: 420, h: 480 },
  DRESS:   { w: 380, h: 700 },
};

/**
 * Maps an outfit category string to one of the 4 supported AR garment types.
 * Defaults to SHIRT for ethnic/formal/other categories (Lehenga, Saree, Kurta, etc.)
 * since SHIRT anchors give the most natural upper-body placement.
 */
function categoryToGarmentType(category: string): GarmentType {
  const c = category.toLowerCase().trim();
  if (c.includes('jacket') || c.includes('blazer') || c.includes('coat') || c.includes('suit') || c.includes('sherwani') || c.includes('sherwaani')) return 'JACKET';
  if (c.includes('hoodie') || c.includes('sweatshirt')) return 'HOODIE';
  if (c.includes('t-shirt') || c.includes('tshirt') || c === 't shirt') return 'T_SHIRT';
  if (c.includes('dress') || c.includes('gown') || c.includes('lehenga') || c.includes('saree')) return 'DRESS';
  return 'SHIRT';
}

/** Converts a single Outfit to a GarmentAsset for the AR rendering pipeline. */
export function outfitToGarment(outfit: Outfit): GarmentAsset {
  const type = categoryToGarmentType(outfit.category);
  const dims = NATURAL_DIMS[type];
  return {
    id: outfit.id,
    name: `${outfit.celebrityName} — ${outfit.category}`,
    type,
    imageUrl: outfit.imageUrl,
    naturalWidth: dims.w,
    naturalHeight: dims.h,
    anchors: ANCHOR_MAP[type],
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS[type] ?? 1.18,
  };
}

/** Converts a list of Outfits to GarmentAssets, preserving order. */
export function outfitsToGarments(outfits: Outfit[]): GarmentAsset[] {
  return outfits.map(outfitToGarment);
}
