/**
 * Pure alignment math — no browser APIs. Fully testable in Node.js.
 */

import type {
  PoseLandmark,
  GarmentAsset,
  BodyMeasurements,
  GarmentAlignment,
} from './garment.types.js';
import { POSE_LANDMARKS } from './garment.types.js';

// ── Geometry helpers ──────────────────────────────────────────────────────────

export function distance(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  return Math.hypot(bx - ax, by - ay);
}

export function midpoint(
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number } {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

export function shoulderAngle(
  lsX: number, lsY: number,
  rsX: number, rsY: number,
): number {
  return Math.atan2(rsY - lsY, rsX - lsX);
}

// ── Body measurements ─────────────────────────────────────────────────────────

/**
 * Extracts body measurements from BlazePose landmarks.
 * Returns null when shoulders are not confidently detected.
 * Hips fall back to an estimate based on shoulder width when not visible.
 */
export function computeBodyMeasurements(
  landmarks: PoseLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  visibilityThreshold = 0.5,
): BodyMeasurements | null {
  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!ls || !rs) return null;
  if (ls.visibility < visibilityThreshold || rs.visibility < visibilityThreshold) return null;

  const lsX = ls.x * canvasWidth;
  const lsY = ls.y * canvasHeight;
  const rsX = rs.x * canvasWidth;
  const rsY = rs.y * canvasHeight;

  const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const hipVisible =
    lh != null &&
    rh != null &&
    lh.visibility >= visibilityThreshold &&
    rh.visibility >= visibilityThreshold;

  let lhX: number, lhY: number, rhX: number, rhY: number;
  if (hipVisible) {
    lhX = lh!.x * canvasWidth;
    lhY = lh!.y * canvasHeight;
    rhX = rh!.x * canvasWidth;
    rhY = rh!.y * canvasHeight;
  } else {
    // Estimate hip position: proportional to shoulder position
    const sw = distance(lsX, lsY, rsX, rsY);
    const estimatedHipDropY = sw * 1.4; // typical torso ratio
    const chX = (lsX + rsX) / 2;
    const chY = (lsY + rsY) / 2;
    lhX = chX - sw * 0.42;
    lhY = chY + estimatedHipDropY;
    rhX = chX + sw * 0.42;
    rhY = chY + estimatedHipDropY;
  }

  const sw = distance(lsX, lsY, rsX, rsY);
  const chestCenter = midpoint(lsX, lsY, rsX, rsY);
  const hipCenter = midpoint(lhX, lhY, rhX, rhY);
  const hipWidth = distance(lhX, lhY, rhX, rhY);
  const torsoHeight = distance(chestCenter.x, chestCenter.y, hipCenter.x, hipCenter.y);
  const angle = shoulderAngle(lsX, lsY, rsX, rsY);
  const minVisibility = Math.min(ls.visibility, rs.visibility);

  return {
    shoulderWidth: sw,
    chestCenter,
    hipWidth,
    hipCenter,
    torsoHeight,
    shoulderAngle: angle,
    minVisibility,
  };
}

// ── Garment alignment ─────────────────────────────────────────────────────────

/**
 * Computes the canvas-space transform needed to place a garment on the body.
 *
 * The garment image is drawn such that its shoulder anchor point lands exactly
 * on the detected shoulder midpoint (chestCenter). Width scales with detected
 * shoulder width; height preserves the garment's natural aspect ratio.
 */
export function computeGarmentAlignment(
  measurements: BodyMeasurements,
  garment: GarmentAsset,
  opacity: number,
  mirrored: boolean,
  visibilityThreshold = 0.5,
): GarmentAlignment {
  const targetWidth = measurements.shoulderWidth * garment.scaleMultiplier;
  const targetHeight = targetWidth * (garment.naturalHeight / garment.naturalWidth);

  return {
    x: measurements.chestCenter.x,
    y: measurements.chestCenter.y,
    width: targetWidth,
    height: targetHeight,
    rotation: measurements.shoulderAngle,
    opacity: Math.max(0, Math.min(1, opacity)),
    visible: measurements.minVisibility >= visibilityThreshold,
    mirrored,
  };
}

// ── Scale factor helpers ──────────────────────────────────────────────────────

/** Recommended scaleMultiplier per garment type. */
export const GARMENT_SCALE_MULTIPLIERS: Record<string, number> = {
  T_SHIRT: 1.15,
  SHIRT:   1.18,
  JACKET:  1.25,
  HOODIE:  1.20,
};
