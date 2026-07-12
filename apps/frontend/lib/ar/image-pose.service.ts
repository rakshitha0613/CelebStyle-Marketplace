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
 * Builds anatomically-proportioned heuristic landmarks for a front-facing
 * full-body portrait.  Used as fallback when MediaPipe pose detection fails.
 *
 * Proportions assume the subject occupies most of the frame vertically
 * (head near top, feet near bottom).  All values are normalised 0–1.
 *
 * The function accepts image dimensions but the landmarks are expressed in
 * normalised space — the caller must scale by canvas W/H when needed.
 */
export function buildHeuristicLandmarks(
  _imageWidth: number,
  _imageHeight: number,
): PoseLandmark[] {
  const blank: PoseLandmark = { x: 0.5, y: 0.5, z: 0, visibility: 0 };
  const arr = new Array(33).fill(null).map(() => ({ ...blank }));

  // ── Head ─────────────────────────────────────────────────────────────────
  arr[0]  = { x: 0.500, y: 0.085, z: 0, visibility: 0.90 }; // nose
  arr[1]  = { x: 0.474, y: 0.072, z: 0, visibility: 0.85 }; // left eye inner
  arr[2]  = { x: 0.462, y: 0.068, z: 0, visibility: 0.85 }; // left eye
  arr[3]  = { x: 0.446, y: 0.072, z: 0, visibility: 0.80 }; // left eye outer
  arr[4]  = { x: 0.526, y: 0.072, z: 0, visibility: 0.85 }; // right eye inner
  arr[5]  = { x: 0.538, y: 0.068, z: 0, visibility: 0.85 }; // right eye
  arr[6]  = { x: 0.554, y: 0.072, z: 0, visibility: 0.80 }; // right eye outer
  arr[7]  = { x: 0.432, y: 0.092, z: 0, visibility: 0.80 }; // left ear
  arr[8]  = { x: 0.568, y: 0.092, z: 0, visibility: 0.80 }; // right ear
  arr[9]  = { x: 0.488, y: 0.112, z: 0, visibility: 0.88 }; // mouth left
  arr[10] = { x: 0.512, y: 0.112, z: 0, visibility: 0.88 }; // mouth right

  // ── Shoulders (normalised y ≈ 0.26 for full-body frame) ──────────────────
  arr[POSE_LANDMARKS.LEFT_SHOULDER]  = { x: 0.338, y: 0.260, z: 0, visibility: 0.93 };
  arr[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.662, y: 0.260, z: 0, visibility: 0.93 };

  // ── Elbows ────────────────────────────────────────────────────────────────
  arr[POSE_LANDMARKS.LEFT_ELBOW]  = { x: 0.280, y: 0.420, z: 0, visibility: 0.82 };
  arr[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.720, y: 0.420, z: 0, visibility: 0.82 };

  // ── Wrists ────────────────────────────────────────────────────────────────
  arr[POSE_LANDMARKS.LEFT_WRIST]  = { x: 0.262, y: 0.570, z: 0, visibility: 0.72 };
  arr[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.738, y: 0.570, z: 0, visibility: 0.72 };

  // ── Hips (≈ 53% down for standing full-body) ─────────────────────────────
  arr[POSE_LANDMARKS.LEFT_HIP]  = { x: 0.375, y: 0.550, z: 0, visibility: 0.90 };
  arr[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.625, y: 0.550, z: 0, visibility: 0.90 };

  // ── Knees ─────────────────────────────────────────────────────────────────
  arr[POSE_LANDMARKS.LEFT_KNEE]  = { x: 0.375, y: 0.755, z: 0, visibility: 0.78 };
  arr[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.625, y: 0.755, z: 0, visibility: 0.78 };

  // ── Ankles ────────────────────────────────────────────────────────────────
  arr[27] = { x: 0.372, y: 0.935, z: 0, visibility: 0.68 };
  arr[28] = { x: 0.628, y: 0.935, z: 0, visibility: 0.68 };

  return arr;
}

/**
 * Returns true when both shoulders AND at least one hip are confidently
 * detected.  Hip visibility is required for body-proportional garment sizing.
 */
export function hasGoodUpperBodyLandmarks(
  landmarks: PoseLandmark[],
  threshold = 0.4,
): boolean {
  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  const shouldersOk = !!(
    ls && rs &&
    ls.visibility >= threshold &&
    rs.visibility >= threshold
  );

  const hipsOk = !!(
    (lh && lh.visibility >= threshold * 0.8) ||
    (rh && rh.visibility >= threshold * 0.8)
  );

  return shouldersOk && hipsOk;
}
