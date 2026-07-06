import type { GarmentAsset, GarmentType } from './garment.types.js';
import { GARMENT_SCALE_MULTIPLIERS } from './garment-alignment.service.js';
import type { Outfit } from '@/lib/api';

const BASE_ANCHORS = {
  leftShoulder:  { x: 0.22, y: 0.12 },
  rightShoulder: { x: 0.78, y: 0.12 },
  leftHip:       { x: 0.30, y: 0.72 },
  rightHip:      { x: 0.70, y: 0.72 },
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
  return 'SHIRT';
}

/** Converts a single Outfit to a GarmentAsset for the AR rendering pipeline. */
export function outfitToGarment(outfit: Outfit): GarmentAsset {
  const type = categoryToGarmentType(outfit.category);
  return {
    id: outfit.id,
    name: `${outfit.celebrityName} — ${outfit.category}`,
    type,
    imageUrl: outfit.imageUrl,
    naturalWidth: 400,
    naturalHeight: 500,
    anchors: BASE_ANCHORS,
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS[type] ?? 1.18,
  };
}

/** Converts a list of Outfits to GarmentAssets, preserving order. */
export function outfitsToGarments(outfits: Outfit[]): GarmentAsset[] {
  return outfits.map(outfitToGarment);
}
