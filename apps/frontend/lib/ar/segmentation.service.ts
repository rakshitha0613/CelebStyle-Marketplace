import type { MaskData, SegmentationConfig, InitStatus } from './types.js';
import { smoothMask, temporalSmooth } from './mask-processor.js';

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/image_segmenter';

const MODEL_URLS: Record<string, string> = {
  portrait: `${MODEL_BASE}/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
  landscape: `${MODEL_BASE}/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite`,
};

export class SegmentationService {
  private status: InitStatus = 'UNINITIALIZED';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private segmenter: any = null;
  private config: SegmentationConfig;
  private frameCount = 0;
  private lastMask: MaskData | null = null;

  constructor(config: SegmentationConfig) {
    this.config = { ...config };
  }

  get initStatus(): InitStatus { return this.status; }
  get isReady(): boolean { return this.status === 'READY'; }

  async initialize(): Promise<void> {
    if (this.status === 'READY') return;
    if (this.status === 'INITIALIZING') throw new Error('Already initializing');

    this.status = 'INITIALIZING';
    try {
      const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URLS[this.config.modelType] ?? MODEL_URLS.portrait,
          delegate: 'GPU',
        },
        outputCategoryMask: false,
        outputConfidenceMasks: true,
        runningMode: 'VIDEO',
      });

      this.status = 'READY';
    } catch (err) {
      this.status = 'ERROR';
      throw err;
    }
  }

  async segmentFrame(
    video: HTMLVideoElement,
    timestamp: number,
  ): Promise<MaskData | null> {
    if (this.status !== 'READY' || !this.segmenter) return null;

    this.frameCount++;
    if (this.frameCount % this.config.runEveryNFrames !== 0) return this.lastMask;

    const start = performance.now();
    try {
      const result = this.segmenter.segmentForVideo(video, timestamp);
      const confidenceMasks = result.confidenceMasks;
      if (!confidenceMasks?.length) {
        result.close?.();
        return this.lastMask;
      }

      const cm = confidenceMasks[0];
      const { width, height } = cm;
      const raw = cm.getAsFloat32Array() as Float32Array;

      const binary = new Uint8ClampedArray(raw.length);
      for (let i = 0; i < raw.length; i++) {
        binary[i] = raw[i] >= this.config.confidenceThreshold ? 255 : 0;
      }

      const smoothRadius = Math.round(this.config.smoothingFactor * 3);
      const smoothed = smoothRadius > 0
        ? smoothMask(binary, width, height, smoothRadius)
        : binary;

      const finalMask = (this.lastMask && this.config.smoothingFactor > 0)
        ? temporalSmooth(smoothed, this.lastMask.data, 0.3)
        : smoothed;

      const avgConf = raw.reduce((s, v) => s + v, 0) / raw.length;

      cm.close?.();
      result.close?.();

      const maskData: MaskData = {
        data: finalMask,
        width,
        height,
        confidence: avgConf,
        timestamp,
      };
      this.lastMask = maskData;

      void start; // latency tracked by pipeline
      return maskData;
    } catch (err) {
      console.error('[SegmentationService]', err);
      return this.lastMask;
    }
  }

  updateConfig(config: Partial<SegmentationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  destroy(): void {
    this.segmenter?.close?.();
    this.segmenter = null;
    this.status = 'UNINITIALIZED';
    this.lastMask = null;
    this.frameCount = 0;
  }
}
