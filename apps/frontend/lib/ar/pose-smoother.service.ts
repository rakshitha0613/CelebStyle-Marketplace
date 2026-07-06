/**
 * pose-smoother.service — Landmark temporal stabilization for virtual try-on.
 *
 * Algorithm:
 *   1. Confidence gate — landmarks below threshold use last-known + velocity extrapolation
 *   2. Exponential Moving Average (EMA) — α×new + (1−α)×prev per coordinate
 *   3. Temporal window — weighted average over last N frames (recent frames heavier)
 *   4. Velocity estimation — tracks per-landmark velocity for inertia-aware rendering
 *
 * No browser APIs — fully testable in Node.js.
 */

import type { PoseLandmark } from './garment.types.js';

// ── Configuration ─────────────────────────────────────────────────────────────

export interface PoseSmootherConfig {
  /** EMA weight for the incoming frame (higher = more responsive, less smooth). Default 0.55 */
  alpha: number;
  /** EMA weight applied to the per-landmark velocity estimate. Default 0.4 */
  velocityAlpha: number;
  /** Minimum visibility to treat a landmark as a new measurement. Default 0.4 */
  confidenceThreshold: number;
  /** Rolling window size for temporal stabilization. Default 3 */
  windowSize: number;
  /** Velocity extrapolation dampening when a landmark falls below confidence. Default 0.5 */
  extrapolationDamping: number;
}

export const DEFAULT_SMOOTHER_CONFIG: PoseSmootherConfig = {
  alpha:                0.55,
  velocityAlpha:        0.40,
  confidenceThreshold:  0.40,
  windowSize:           3,
  extrapolationDamping: 0.50,
};

// ── Body orientation output ───────────────────────────────────────────────────

export interface BodyOrientation {
  /** Angle of the shoulder line relative to horizontal (radians) */
  shoulderRotation: number;
  /** Torso forward lean estimated from z-depth asymmetry of shoulders (radians) */
  torsoAngle: number;
  /** Angle of the hip line relative to horizontal (radians) */
  hipRotation: number;
  /** Angle of the left upper arm (shoulder → elbow) (radians) */
  leftArmAngle: number;
  /** Angle of the right upper arm (shoulder → elbow) (radians) */
  rightArmAngle: number;
  /** True when both shoulders are visible and z-spread is small (frontal pose) */
  isForwardFacing: boolean;
  /** Mean visibility of the primary structural landmarks (0–1) */
  confidence: number;
}

// ── Smoother class ────────────────────────────────────────────────────────────

export class PoseSmoother {
  private smoothed: PoseLandmark[] | null = null;
  private velocities: Array<{ vx: number; vy: number; vz: number }> = [];
  private window: PoseLandmark[][] = [];
  private config: PoseSmootherConfig;

  constructor(config: Partial<PoseSmootherConfig> = {}) {
    this.config = { ...DEFAULT_SMOOTHER_CONFIG, ...config };
  }

  /**
   * Accept a raw landmark frame and return temporally-stabilized landmarks.
   * First call seeds the filter and returns the raw frame unchanged.
   */
  smooth(raw: PoseLandmark[]): PoseLandmark[] {
    if (raw.length === 0) return raw;

    // First frame: seed state
    if (!this.smoothed) {
      this.smoothed  = raw.map((lm) => ({ ...lm }));
      this.velocities = raw.map(() => ({ vx: 0, vy: 0, vz: 0 }));
      this.window    = [raw.map((lm) => ({ ...lm }))];
      return this.smoothed;
    }

    const { alpha, velocityAlpha, confidenceThreshold, extrapolationDamping } = this.config;
    const result: PoseLandmark[] = [];

    for (let i = 0; i < raw.length; i++) {
      const cur  = raw[i];
      const prev = this.smoothed[i] ?? cur;
      const vel  = this.velocities[i] ?? { vx: 0, vy: 0, vz: 0 };

      if (cur.visibility < confidenceThreshold && prev.visibility >= confidenceThreshold) {
        // Gate: low-confidence measurement → extrapolate from last known + velocity
        result.push({
          x:          prev.x + vel.vx * extrapolationDamping,
          y:          prev.y + vel.vy * extrapolationDamping,
          z:          prev.z + vel.vz * extrapolationDamping,
          visibility: prev.visibility * 0.85, // graceful confidence decay
        });
      } else {
        // EMA blend
        const sx = alpha * cur.x          + (1 - alpha) * prev.x;
        const sy = alpha * cur.y          + (1 - alpha) * prev.y;
        const sz = alpha * cur.z          + (1 - alpha) * prev.z;
        const sv = alpha * cur.visibility + (1 - alpha) * prev.visibility;

        // Update velocity with its own EMA
        vel.vx = velocityAlpha * (sx - prev.x) + (1 - velocityAlpha) * vel.vx;
        vel.vy = velocityAlpha * (sy - prev.y) + (1 - velocityAlpha) * vel.vy;
        vel.vz = velocityAlpha * (sz - prev.z) + (1 - velocityAlpha) * vel.vz;

        result.push({ x: sx, y: sy, z: sz, visibility: sv });
      }
    }

    // Temporal window: push current EMA result, evict oldest
    this.window.push(result.map((lm) => ({ ...lm })));
    if (this.window.length > this.config.windowSize) this.window.shift();

    // Weighted temporal average if we have ≥2 frames
    if (this.window.length >= 2) {
      const w = this.window.length;
      const denom = (w * (w + 1)) / 2; // triangular number for weight normalisation
      const stabilized = result.map((_, i) => {
        let sx = 0, sy = 0, sz = 0, sv = 0;
        for (let f = 0; f < this.window.length; f++) {
          const weight = (f + 1) / denom; // earlier frames get lower weight
          const wlm   = this.window[f][i];
          if (wlm) {
            sx += wlm.x * weight;
            sy += wlm.y * weight;
            sz += wlm.z * weight;
            sv += wlm.visibility * weight;
          }
        }
        return { x: sx, y: sy, z: sz, visibility: sv };
      });
      this.smoothed = stabilized;
      return stabilized;
    }

    this.smoothed = result;
    return result;
  }

  /**
   * Derive structural body orientation from an already-smoothed landmark frame.
   * Useful for garment rotation, perspective correction, and physics inertia.
   */
  estimateOrientation(landmarks: PoseLandmark[]): BodyOrientation {
    const LS = landmarks[11]; // LEFT_SHOULDER
    const RS = landmarks[12]; // RIGHT_SHOULDER
    const LE = landmarks[13]; // LEFT_ELBOW
    const RE = landmarks[14]; // RIGHT_ELBOW
    const LH = landmarks[23]; // LEFT_HIP
    const RH = landmarks[24]; // RIGHT_HIP

    const shouldersOk = !!(LS && RS && LS.visibility > 0.4 && RS.visibility > 0.4);
    const hipsOk      = !!(LH && RH && LH.visibility > 0.3 && RH.visibility > 0.3);

    const shoulderRotation = shouldersOk
      ? Math.atan2(RS!.y - LS!.y, RS!.x - LS!.x)
      : 0;

    // Forward lean: lateral z-asymmetry of shoulders → estimate of body rotation
    const torsoAngle = shouldersOk
      ? Math.atan2(RS!.z - LS!.z, Math.abs(RS!.x - LS!.x) + 1e-6)
      : 0;

    const hipRotation = hipsOk
      ? Math.atan2(RH!.y - LH!.y, RH!.x - LH!.x)
      : shoulderRotation;

    const leftArmAngle  = shouldersOk && LE && LE.visibility > 0.3
      ? Math.atan2(LE.y - LS!.y, LE.x - LS!.x)
      : 0;

    const rightArmAngle = shouldersOk && RE && RE.visibility > 0.3
      ? Math.atan2(RE.y - RS!.y, RE.x - RS!.x)
      : 0;

    // Forward-facing: both shoulders present and z-spread < 0.15 (normalized units)
    const zSpread = shouldersOk ? Math.abs(RS!.z - LS!.z) : 1;
    const isForwardFacing = shouldersOk && zSpread < 0.15;

    const visValues = [LS, RS, LH, RH].filter(Boolean).map((l) => l!.visibility);
    const confidence = visValues.length > 0
      ? visValues.reduce((a, b) => a + b, 0) / visValues.length
      : 0;

    return {
      shoulderRotation,
      torsoAngle,
      hipRotation,
      leftArmAngle,
      rightArmAngle,
      isForwardFacing,
      confidence,
    };
  }

  /** Returns the current per-landmark velocity (useful for physics inertia). */
  getVelocity(index: number): { vx: number; vy: number; vz: number } {
    return this.velocities[index] ?? { vx: 0, vy: 0, vz: 0 };
  }

  /** Returns the last returned (smoothed + stabilized) frame, or null before first call. */
  getLastSmoothed(): PoseLandmark[] | null {
    return this.smoothed;
  }

  /** Reset all filter state (e.g. after a garment change or pause). */
  reset(): void {
    this.smoothed   = null;
    this.velocities = [];
    this.window     = [];
  }

  updateConfig(patch: Partial<PoseSmootherConfig>): void {
    this.config = { ...this.config, ...patch };
  }
}
