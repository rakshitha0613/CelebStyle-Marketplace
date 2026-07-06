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
  DRESS:   1.22,
};

// ── Phase 3: enhanced fitting ─────────────────────────────────────────────────

export interface BodyOrientation {
  /** Shoulder line tilt (radians, positive = right shoulder lower) */
  shoulderRotation: number;
  /** Left-right lean of torso (same as shoulderRotation, semantic alias) */
  torsoTilt: number;
  /** Forward lean estimate from shoulder z-depth asymmetry (radians) */
  forwardLean: number;
  /** Hip line angle (radians) */
  hipRotation: number;
  /**
   * Perspective correction factor (0.9–1.1).
   * Slightly reduces garment scale when the subject is off-centre laterally,
   * approximating camera foreshortening.
   */
  perspectiveFactor: number;
}

export interface EnhancedGarmentAlignment extends GarmentAlignment {
  /** Perspective-adjusted scale factor applied on top of shoulder-width scale */
  perspectiveScale: number;
  /** Vertical nudge (px) from hip tracking, pulling bottom of garment toward hips */
  hipVerticalOffset: number;
  /** Estimated waist anchor (canvas px) for belt/bottom alignment */
  waistCenter: { x: number; y: number };
  /** Body orientation snapshot at time of alignment */
  orientation: BodyOrientation;
}

/**
 * Estimate body orientation from raw landmarks and canvas dimensions.
 * Pure math — no browser APIs.
 */
export function computeBodyOrientation(
  landmarks: PoseLandmark[],
  canvasWidth: number,
  canvasHeight: number,
): BodyOrientation {
  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  const lsX = ls ? ls.x * canvasWidth  : canvasWidth  * 0.35;
  const lsY = ls ? ls.y * canvasHeight : canvasHeight * 0.35;
  const rsX = rs ? rs.x * canvasWidth  : canvasWidth  * 0.65;
  const rsY = rs ? rs.y * canvasHeight : canvasHeight * 0.35;

  const hasShoulders = !!(ls && rs && ls.visibility > 0.4 && rs.visibility > 0.4);
  const hasHips      = !!(lh && rh && lh.visibility > 0.3 && rh.visibility > 0.3);

  const shoulderRotation = hasShoulders
    ? Math.atan2(rsY - lsY, rsX - lsX)
    : 0;

  const forwardLean = hasShoulders
    ? Math.atan2((rs!.z - ls!.z), Math.abs(rsX - lsX) / canvasWidth + 1e-6)
    : 0;

  const hipRotation = hasHips
    ? Math.atan2(
        (rh!.y - lh!.y) * canvasHeight,
        (rh!.x - lh!.x) * canvasWidth,
      )
    : shoulderRotation;

  // Lateral position correction: subject at edge of frame → slight scale reduction
  const midX = (lsX + rsX) / (2 * canvasWidth); // 0–1
  const offCentre = Math.abs(midX - 0.5) * 2;   // 0–1
  const perspectiveFactor = 1 - offCentre * 0.04; // ±4 % max correction

  return {
    shoulderRotation,
    torsoTilt:         shoulderRotation,
    forwardLean,
    hipRotation,
    perspectiveFactor: Math.max(0.9, Math.min(1.1, perspectiveFactor)),
  };
}

/**
 * Drop-in replacement for computeGarmentAlignment with depth correction,
 * perspective foreshortening, and hip-tracking vertical offset.
 *
 * Returns an EnhancedGarmentAlignment (superset of GarmentAlignment).
 */
export function computeEnhancedGarmentAlignment(
  measurements:  BodyMeasurements,
  garment:       GarmentAsset,
  landmarks:     PoseLandmark[],
  canvasWidth:   number,
  canvasHeight:  number,
  opacity:       number,
  mirrored:      boolean,
  visibilityThreshold = 0.5,
): EnhancedGarmentAlignment {
  const orientation   = computeBodyOrientation(landmarks, canvasWidth, canvasHeight);
  const targetWidth   = measurements.shoulderWidth * garment.scaleMultiplier * orientation.perspectiveFactor;
  const targetHeight  = targetWidth * (garment.naturalHeight / garment.naturalWidth);

  // Waist: halfway between chest centre and hip centre
  const waistCenter = {
    x: (measurements.chestCenter.x + measurements.hipCenter.x) * 0.5,
    y: (measurements.chestCenter.y + measurements.hipCenter.y) * 0.5,
  };

  // Hip vertical offset: subtle pull-down when hips are tracked and garment is long
  const idealBottom  = measurements.chestCenter.y + targetHeight * 0.85;
  const hipVerticalOffset = measurements.hipCenter.y > 0
    ? Math.max(0, measurements.hipCenter.y - idealBottom) * 0.15
    : 0;

  return {
    x:               measurements.chestCenter.x,
    y:               measurements.chestCenter.y + hipVerticalOffset,
    width:           targetWidth,
    height:          targetHeight,
    rotation:        measurements.shoulderAngle,
    opacity:         Math.max(0, Math.min(1, opacity)),
    visible:         measurements.minVisibility >= visibilityThreshold,
    mirrored,
    perspectiveScale: orientation.perspectiveFactor,
    hipVerticalOffset,
    waistCenter,
    orientation,
  };
}
