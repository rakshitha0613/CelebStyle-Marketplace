export type GarmentType = 'T_SHIRT' | 'SHIRT' | 'JACKET' | 'HOODIE';

export type InitStatus = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

export interface GarmentAnchorPoint {
  x: number; // normalized 0–1 within garment image width
  y: number; // normalized 0–1 within garment image height
}

export interface GarmentAnchors {
  leftShoulder: GarmentAnchorPoint;
  rightShoulder: GarmentAnchorPoint;
  leftHip: GarmentAnchorPoint;
  rightHip: GarmentAnchorPoint;
}

export interface GarmentAsset {
  id: string;
  name: string;
  type: GarmentType;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  anchors: GarmentAnchors;
  /**
   * Body-fit multiplier applied on top of detected shoulder width.
   * 1.0 = tight fit, 1.1 = relaxed, 1.2 = oversized.
   */
  scaleMultiplier: number;
  /** Optional GLB/GLTF URL for 3D rendering. When absent the 2D overlay is used. */
  modelUrl?: string;
}

export interface PoseLandmark {
  x: number;          // normalized 0–1 (image-relative)
  y: number;          // normalized 0–1
  z: number;          // normalized depth
  visibility: number; // 0–1 confidence
}

/** Indices into the 33-landmark BlazePose array */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

export const BLAZEPOSE_LANDMARK_COUNT = 33;

export interface BodyMeasurements {
  shoulderWidth: number;
  chestCenter: { x: number; y: number };
  hipWidth: number;
  hipCenter: { x: number; y: number };
  torsoHeight: number;
  shoulderAngle: number; // radians — tilt of shoulder line
  minVisibility: number; // lowest confidence among key landmarks used
}

export interface GarmentAlignment {
  /** Canvas X/Y of the detected shoulder midpoint — garment shoulder anchor goes here */
  x: number;
  y: number;
  width: number;   // target render width in pixels
  height: number;  // target render height in pixels (aspect-ratio preserved)
  rotation: number; // radians — matches shoulder tilt
  opacity: number;  // 0–1, clamped
  visible: boolean;
  mirrored: boolean;
}

export interface GarmentOverlayConfig {
  opacity: number;             // 0–1
  visible: boolean;
  debugLandmarks: boolean;
  highContrast: boolean;
  mirrored: boolean;           // true for front-facing/selfie camera
  visibilityThreshold: number; // minimum landmark confidence to render overlay
}

// ── Worker message contracts ───────────────────────────────────────────────────

export type OverlayWorkerInboundMessage =
  | { type: 'INIT'; payload: { visibilityThreshold: number } }
  | {
      type: 'ALIGN_GARMENT';
      payload: {
        landmarks: PoseLandmark[];
        garment: GarmentAsset;
        canvasWidth: number;
        canvasHeight: number;
        config: GarmentOverlayConfig;
      };
    }
  | { type: 'DESTROY' };

export type OverlayWorkerOutboundMessage =
  | { type: 'READY' }
  | { type: 'ALIGNMENT_RESULT'; payload: { alignment: GarmentAlignment; measurements: BodyMeasurements } }
  | { type: 'INVISIBLE'; payload: { reason: string } }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'DESTROYED' };
