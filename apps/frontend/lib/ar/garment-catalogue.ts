import type { GarmentAsset } from './garment.types.js';

// Placeholder catalogue removed — real garments are loaded at runtime from
// the CelebStyle outfit API via outfitsToGarments() in outfit-to-garment.ts.
export const DEMO_GARMENTS: GarmentAsset[] = [];

export function getGarmentById(id: string): GarmentAsset | undefined {
  return DEMO_GARMENTS.find((g) => g.id === id);
}

export function getGarmentsByType(type: GarmentAsset['type']): GarmentAsset[] {
  return DEMO_GARMENTS.filter((g) => g.type === type);
}
