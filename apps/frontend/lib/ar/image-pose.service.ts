/**
 * ImagePoseService — single-shot pose detection on static images.
 * Uses MediaPipe IMAGE mode (distinct from the VIDEO mode used for live camera).
 */
import type { PoseLandmark } from './garment.types.js';
import { POSE_LANDMARKS } from './garment.types.js';

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const BLAZEPOSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export type ImagePoseStatus = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLandmarker = any;

export class ImagePoseService {
  private status: ImagePoseStatus = 'UNINITIALIZED';
  private landmarker: AnyLandmarker = null;

  get isReady(): boolean { return this.status === 'READY'; }
  get initStatus(): ImagePoseStatus { return this.status; }

  async initialize(): Promise<void> {
    if (this.status === 'READY') return;
    if (this.status === 'INITIALIZING') {
      // Wait for existing init to complete
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(() => {
          if (this.status === 'READY') { clearInterval(check); resolve(); }
          if (this.status === 'ERROR') { clearInterval(check); reject(new Error('Init failed')); }
        }, 100);
      });
      return;
    }

    this.status = 'INITIALIZING';
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: BLAZEPOSE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
        minPoseDetectionConfidence: 0.25,
        minPosePresenceConfidence: 0.25,
        minTrackingConfidence: 0.25,
      });
      this.status = 'READY';
    } catch (err) {
      this.status = 'ERROR';
      throw err;
    }
  }

  /**
   * Detect pose landmarks in a static image.
   * Returns null if detection fails or no person is found.
   */
  detect(image: HTMLImageElement | HTMLCanvasElement): PoseLandmark[] | null {
    if (this.status !== 'READY' || !this.landmarker) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = this.landmarker.detect(image);
      if (!result?.landmarks?.length) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.landmarks[0].map((lm: any): PoseLandmark => ({
        x: lm.x ?? 0,
        y: lm.y ?? 0,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 0,
      }));
    } catch {
      return null;
    }
  }

  destroy(): void {
    try { this.landmarker?.close?.(); } catch { /* ignore */ }
    this.landmarker = null;
    this.status = 'UNINITIALIZED';
  }
}

/**
 * Heuristic body landmarks for a front-facing full-body portrait.
 * Used as fallback when pose detection fails or returns low-confidence results.
 * Proportions based on standard anatomical ratios for a standing adult figure.
 */
export function buildHeuristicLandmarks(
  imageWidth: number,
  imageHeight: number,
): PoseLandmark[] {
  void imageWidth; void imageHeight; // proportions are normalized 0-1

  const blank: PoseLandmark = { x: 0.5, y: 0.5, z: 0, visibility: 0 };
  const arr = new Array(33).fill(null).map(() => ({ ...blank }));

  // Head / neck
  arr[0]  = { x: 0.500, y: 0.090, z: 0, visibility: 0.90 }; // nose
  arr[1]  = { x: 0.470, y: 0.075, z: 0, visibility: 0.85 }; // left eye inner
  arr[2]  = { x: 0.460, y: 0.072, z: 0, visibility: 0.85 }; // left eye
  arr[3]  = { x: 0.445, y: 0.075, z: 0, visibility: 0.80 }; // left eye outer
  arr[4]  = { x: 0.530, y: 0.075, z: 0, visibility: 0.85 }; // right eye inner
  arr[5]  = { x: 0.540, y: 0.072, z: 0, visibility: 0.85 }; // right eye
  arr[6]  = { x: 0.555, y: 0.075, z: 0, visibility: 0.80 }; // right eye outer
  arr[7]  = { x: 0.430, y: 0.095, z: 0, visibility: 0.80 }; // left ear
  arr[8]  = { x: 0.570, y: 0.095, z: 0, visibility: 0.80 }; // right ear
  arr[9]  = { x: 0.490, y: 0.115, z: 0, visibility: 0.90 }; // mouth left
  arr[10] = { x: 0.510, y: 0.115, z: 0, visibility: 0.90 }; // mouth right

  // Shoulders
  arr[POSE_LANDMARKS.LEFT_SHOULDER]  = { x: 0.340, y: 0.270, z: 0, visibility: 0.92 };
  arr[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.660, y: 0.270, z: 0, visibility: 0.92 };

  // Elbows
  arr[POSE_LANDMARKS.LEFT_ELBOW]  = { x: 0.285, y: 0.430, z: 0, visibility: 0.80 };
  arr[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.715, y: 0.430, z: 0, visibility: 0.80 };

  // Wrists
  arr[POSE_LANDMARKS.LEFT_WRIST]  = { x: 0.265, y: 0.580, z: 0, visibility: 0.70 };
  arr[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.735, y: 0.580, z: 0, visibility: 0.70 };

  // Hips
  arr[POSE_LANDMARKS.LEFT_HIP]  = { x: 0.380, y: 0.560, z: 0, visibility: 0.88 };
  arr[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.620, y: 0.560, z: 0, visibility: 0.88 };

  // Knees
  arr[POSE_LANDMARKS.LEFT_KNEE]  = { x: 0.380, y: 0.760, z: 0, visibility: 0.75 };
  arr[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.620, y: 0.760, z: 0, visibility: 0.75 };

  // Ankles
  arr[27] = { x: 0.375, y: 0.940, z: 0, visibility: 0.65 };
  arr[28] = { x: 0.625, y: 0.940, z: 0, visibility: 0.65 };

  return arr;
}

/** Returns true when key upper-body landmarks have sufficient confidence */
export function hasGoodUpperBodyLandmarks(
  landmarks: PoseLandmark[],
  threshold = 0.4,
): boolean {
  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  return !!(
    ls && rs &&
    ls.visibility >= threshold &&
    rs.visibility >= threshold
  );
}
