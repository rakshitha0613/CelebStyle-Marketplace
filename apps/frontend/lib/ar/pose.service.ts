import type { PoseLandmark, InitStatus } from './garment.types.js';

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const BLAZEPOSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export class PoseService {
  private status: InitStatus = 'UNINITIALIZED';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private landmarker: any = null;

  get initStatus(): InitStatus { return this.status; }
  get isReady(): boolean { return this.status === 'READY'; }

  async initialize(): Promise<void> {
    if (this.status === 'READY') return;
    if (this.status === 'INITIALIZING') throw new Error('Already initializing');

    this.status = 'INITIALIZING';
    try {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: BLAZEPOSE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.status = 'READY';
    } catch (err) {
      this.status = 'ERROR';
      throw err;
    }
  }

  detectLandmarks(
    video: HTMLVideoElement,
    timestamp: number,
  ): PoseLandmark[] | null {
    if (this.status !== 'READY' || !this.landmarker) return null;

    const result = this.landmarker.detectForVideo(video, timestamp);
    if (!result.landmarks?.length) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.landmarks[0].map((lm: any): PoseLandmark => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));
  }

  destroy(): void {
    this.landmarker?.close?.();
    this.landmarker = null;
    this.status = 'UNINITIALIZED';
  }
}
