/**
 * Estimates real-world body measurements (cm) from BlazePose landmarks.
 *
 * Calibration anchor: shoulder width is assumed to be REFERENCE_SHOULDER_CM
 * for an average adult. All other measurements derive from that scale factor.
 * Pass a user-provided height for better accuracy.
 */

import type { PoseLandmark } from './garment.types.js';
import { POSE_LANDMARKS } from './garment.types.js';
import type { PhysicalMeasurements } from './fit.types.js';

// Anthropometric constants (mean adult proportions)
const REFERENCE_SHOULDER_CM = 43;     // mean adult shoulder width
const SHOULDER_TO_HEIGHT    = 0.259;  // shoulder width / height ≈ 25.9%
const TORSO_TO_HEIGHT       = 0.306;  // torso length / height ≈ 30.6%
const ARM_TO_HEIGHT         = 0.221;  // one arm (shoulder→wrist) / height
const HIP_OFFSET            = 0.10;   // hipWidth = shoulderWidth × (1 + HIP_OFFSET)
const WAIST_OF_HIP          = 0.82;   // waistWidth / hipWidth

function pxDist(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  return Math.hypot(bx - ax, by - ay);
}

export class BodyMeasurementService {
  private readonly referenceShoulder: number;

  constructor(referenceShoulderCm = REFERENCE_SHOULDER_CM) {
    this.referenceShoulder = referenceShoulderCm;
  }

  /**
   * Returns real-world body measurements derived from BlazePose landmarks.
   * Returns null when both shoulders are not confidently visible.
   *
   * @param userHeightCm - optional override for proportional scaling
   */
  estimateMeasurements(
    landmarks: PoseLandmark[],
    canvasWidth:  number,
    canvasHeight: number,
    visibilityThreshold = 0.5,
    userHeightCm?: number,
  ): PhysicalMeasurements | null {
    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    if (!ls || !rs) return null;
    if (ls.visibility < visibilityThreshold || rs.visibility < visibilityThreshold) return null;

    const lsX = ls.x * canvasWidth,  lsY = ls.y * canvasHeight;
    const rsX = rs.x * canvasWidth,  rsY = rs.y * canvasHeight;

    const shoulderWidthPx = pxDist(lsX, lsY, rsX, rsY);
    if (shoulderWidthPx < 1) return null;

    // Scale: cm per pixel, anchored on shoulder width
    const scaleFactor = this.referenceShoulder / shoulderWidthPx;

    const shoulderWidth = this.referenceShoulder;

    // ── Height estimate ──────────────────────────────────────────────────────
    const estimatedHeight = userHeightCm ?? Math.round(shoulderWidth / SHOULDER_TO_HEIGHT);

    // ── Torso ────────────────────────────────────────────────────────────────
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const hipVisible =
      lh != null && rh != null &&
      lh.visibility >= visibilityThreshold && rh.visibility >= visibilityThreshold;

    let torsoLength: number;
    let hipWidthCm: number;

    if (hipVisible) {
      const lhX = lh!.x * canvasWidth, lhY = lh!.y * canvasHeight;
      const rhX = rh!.x * canvasWidth, rhY = rh!.y * canvasHeight;
      const shoulderMidX = (lsX + rsX) / 2, shoulderMidY = (lsY + rsY) / 2;
      const hipMidX = (lhX + rhX) / 2,      hipMidY = (lhY + rhY) / 2;
      torsoLength = pxDist(shoulderMidX, shoulderMidY, hipMidX, hipMidY) * scaleFactor;
      hipWidthCm  = pxDist(lhX, lhY, rhX, rhY) * scaleFactor;
    } else {
      // Proportional estimate when hips not visible
      torsoLength = estimatedHeight * TORSO_TO_HEIGHT;
      hipWidthCm  = shoulderWidth * (1 + HIP_OFFSET);
    }

    // ── Sleeve ───────────────────────────────────────────────────────────────
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const armVisible = le && re && lw && rw &&
      le.visibility >= visibilityThreshold && re.visibility >= visibilityThreshold &&
      lw.visibility >= visibilityThreshold && rw.visibility >= visibilityThreshold;

    let sleeveLength: number;
    if (armVisible) {
      const leX = le!.x * canvasWidth, leY = le!.y * canvasHeight;
      const reX = re!.x * canvasWidth, reY = re!.y * canvasHeight;
      const lwX = lw!.x * canvasWidth, lwY = lw!.y * canvasHeight;
      const rwX = rw!.x * canvasWidth, rwY = rw!.y * canvasHeight;
      const leftArm  = (pxDist(lsX, lsY, leX, leY) + pxDist(leX, leY, lwX, lwY)) * scaleFactor;
      const rightArm = (pxDist(rsX, rsY, reX, reY) + pxDist(reX, reY, rwX, rwY)) * scaleFactor;
      sleeveLength = (leftArm + rightArm) / 2;
    } else {
      sleeveLength = estimatedHeight * ARM_TO_HEIGHT;
    }

    // ── Chest / waist ────────────────────────────────────────────────────────
    // Chest circumference ≈ shoulder width × 2.2 (oval cross-section approximation)
    const chestCircumference = shoulderWidth * 2.2;
    const waistWidth         = hipWidthCm * WAIST_OF_HIP;

    // ── Confidence ───────────────────────────────────────────────────────────
    const usedVis = [ls.visibility, rs.visibility];
    if (hipVisible) usedVis.push(lh!.visibility, rh!.visibility);
    if (armVisible) usedVis.push(le!.visibility, re!.visibility, lw!.visibility, rw!.visibility);
    const confidence = usedVis.reduce((s, v) => s + v, 0) / usedVis.length;

    return {
      shoulderWidth,
      chestCircumference: Math.round(chestCircumference * 10) / 10,
      waistWidth:         Math.round(waistWidth * 10) / 10,
      hipWidth:           Math.round(hipWidthCm * 10) / 10,
      torsoLength:        Math.round(torsoLength * 10) / 10,
      sleeveLength:       Math.round(sleeveLength * 10) / 10,
      estimatedHeight:    Math.round(estimatedHeight),
      confidence:         Math.min(1, Math.max(0, confidence)),
    };
  }
}
