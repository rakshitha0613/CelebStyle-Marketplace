import type { GarmentAsset } from './garment.types.js';
import { GARMENT_SCALE_MULTIPLIERS } from './garment-alignment.service.js';

/**
 * Demo garment catalogue.
 *
 * imageUrl points to CDN-hosted garment images. In production these would
 * come from the CelebStyle outfit API; the anchor points must be calibrated
 * per garment by measuring pixel positions in the source image.
 *
 * Anchor convention (normalised 0–1 within the garment image):
 *   leftShoulder  ≈ (0.22, 0.12)   — person's left shoulder seam
 *   rightShoulder ≈ (0.78, 0.12)   — person's right shoulder seam
 *   leftHip       ≈ (0.30, 0.72)   — person's left hip seam / hem start
 *   rightHip      ≈ (0.70, 0.72)
 */

const BASE_ANCHORS = {
  leftShoulder:  { x: 0.22, y: 0.12 },
  rightShoulder: { x: 0.78, y: 0.12 },
  leftHip:       { x: 0.30, y: 0.72 },
  rightHip:      { x: 0.70, y: 0.72 },
};

export const DEMO_GARMENTS: GarmentAsset[] = [
  {
    id: 'tshirt-white-001',
    name: 'White Classic Tee',
    type: 'T_SHIRT',
    imageUrl: 'https://placehold.co/400x500/ffffff/333333?text=White+Tee',
    naturalWidth: 400,
    naturalHeight: 500,
    anchors: BASE_ANCHORS,
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['T_SHIRT'],
  },
  {
    id: 'shirt-blue-001',
    name: 'Blue Oxford Shirt',
    type: 'SHIRT',
    imageUrl: 'https://placehold.co/400x560/1e40af/ffffff?text=Blue+Shirt',
    naturalWidth: 400,
    naturalHeight: 560,
    anchors: {
      ...BASE_ANCHORS,
      leftHip:  { x: 0.28, y: 0.75 },
      rightHip: { x: 0.72, y: 0.75 },
    },
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['SHIRT'],
  },
  {
    id: 'jacket-black-001',
    name: 'Black Blazer',
    type: 'JACKET',
    imageUrl: 'https://placehold.co/420x580/111827/ffffff?text=Black+Blazer',
    naturalWidth: 420,
    naturalHeight: 580,
    anchors: {
      leftShoulder:  { x: 0.18, y: 0.10 },
      rightShoulder: { x: 0.82, y: 0.10 },
      leftHip:       { x: 0.25, y: 0.70 },
      rightHip:      { x: 0.75, y: 0.70 },
    },
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['JACKET'],
  },
  {
    id: 'hoodie-gray-001',
    name: 'Gray Hoodie',
    type: 'HOODIE',
    imageUrl: 'https://placehold.co/410x540/6b7280/ffffff?text=Gray+Hoodie',
    naturalWidth: 410,
    naturalHeight: 540,
    anchors: {
      ...BASE_ANCHORS,
      leftShoulder:  { x: 0.20, y: 0.13 },
      rightShoulder: { x: 0.80, y: 0.13 },
    },
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['HOODIE'],
  },
];

export function getGarmentById(id: string): GarmentAsset | undefined {
  return DEMO_GARMENTS.find((g) => g.id === id);
}

export function getGarmentsByType(type: GarmentAsset['type']): GarmentAsset[] {
  return DEMO_GARMENTS.filter((g) => g.type === type);
}
