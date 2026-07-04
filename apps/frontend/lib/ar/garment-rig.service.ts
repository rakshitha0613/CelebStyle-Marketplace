import type { PoseLandmark } from './garment.types.js';
import {
  UPPER_BODY_BONE_MAP,
  type BoneTransform,
  type BoneMapping,
} from './three.types.js';

const DEFAULT_VISIBILITY_THRESHOLD = 0.5;

export class GarmentRigService {
  private readonly visibilityThreshold: number;

  constructor(visibilityThreshold = DEFAULT_VISIBILITY_THRESHOLD) {
    this.visibilityThreshold = visibilityThreshold;
  }

  /**
   * Converts a normalised BlazePose landmark (x/y in [0,1], z depth-normalised)
   * to Three.js world space.
   * x: [-1, 1]  right is positive
   * y: [-1, 1]  up is positive (image y is flipped)
   * z: depth estimate, negative = closer to viewer
   */
  computeLandmarkToWorld(
    landmark: PoseLandmark,
    sceneDepth = 2.0,
  ): { x: number; y: number; z: number } {
    return {
      x:  (landmark.x - 0.5) * 2.0,
      y: -(landmark.y - 0.5) * 2.0,
      z:  landmark.z * sceneDepth * 0.5,
    };
  }

  /** Unit vector from `from` to `to`; falls back to (0, -1, 0) for degenerate inputs */
  computeBoneDirection(
    from: { x: number; y: number; z: number },
    to:   { x: number; y: number; z: number },
  ): { x: number; y: number; z: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return { x: 0, y: -1, z: 0 };
    return { x: dx / len, y: dy / len, z: dz / len };
  }

  /** 3D distance between two world-space points */
  private _distance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ): number {
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }

  /**
   * Estimated shoulder width in normalised world-space units
   * using landmarks 11 (left) and 12 (right).
   * Returns null if either shoulder is below the visibility threshold.
   */
  computeShoulderWidth(
    landmarks: PoseLandmark[],
    sceneDepth = 2.0,
  ): number | null {
    const ls = landmarks[11];
    const rs = landmarks[12];
    if (!ls || !rs) return null;
    if (ls.visibility < this.visibilityThreshold || rs.visibility < this.visibilityThreshold) return null;
    const lw = this.computeLandmarkToWorld(ls, sceneDepth);
    const rw = this.computeLandmarkToWorld(rs, sceneDepth);
    return this._distance(lw, rw);
  }

  /**
   * Computes world-space bone transforms for every entry in UPPER_BODY_BONE_MAP
   * that has sufficient landmark visibility.
   */
  computeBoneTransforms(
    landmarks: PoseLandmark[],
    sceneDepth = 2.0,
  ): Map<string, BoneTransform> {
    const result = new Map<string, BoneTransform>();

    for (const mapping of UPPER_BODY_BONE_MAP) {
      const lm = landmarks[mapping.landmarkIndex];
      if (!lm || lm.visibility < this.visibilityThreshold) continue;

      const pos = this.computeLandmarkToWorld(lm, sceneDepth);

      let direction: { x: number; y: number; z: number } = { x: 0, y: -1, z: 0 };
      let length = 0.3;

      if (mapping.parentLandmarkIndex !== null) {
        const parentLm = landmarks[mapping.parentLandmarkIndex];
        if (parentLm && parentLm.visibility >= this.visibilityThreshold) {
          const parentPos = this.computeLandmarkToWorld(parentLm, sceneDepth);
          direction = this.computeBoneDirection(parentPos, pos);
          length = this._distance(parentPos, pos);
        }
      }

      result.set(mapping.boneName, { position: pos, direction, length });
    }

    return result;
  }

  /** Returns only the bone names that could be computed for the given landmarks */
  getVisibleBones(landmarks: PoseLandmark[]): string[] {
    return UPPER_BODY_BONE_MAP
      .filter((m) => {
        const lm = landmarks[m.landmarkIndex];
        return lm && lm.visibility >= this.visibilityThreshold;
      })
      .map((m) => m.boneName);
  }

  /** Reference to the static bone map (for inspection / testing) */
  static getBoneMap(): BoneMapping[] {
    return UPPER_BODY_BONE_MAP;
  }
}
