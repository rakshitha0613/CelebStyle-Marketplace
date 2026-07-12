import type {
  GarmentAsset,
  GarmentAlignment,
  GarmentOverlayConfig,
  PoseLandmark,
} from './garment.types.js';
import { PoseService } from './pose.service.js';
import { GarmentAssetLoader } from './garment-asset.loader.js';
import { GarmentRenderer } from './garment-renderer.js';
import {
  computeBodyMeasurements,
  computeEnhancedGarmentAlignment,
} from './garment-alignment.service.js';
import { PoseSmoother } from './pose-smoother.service.js';

/** Minimum interval between pose-detection calls (ms). Targets ~30 Hz. */
const POSE_DETECTION_INTERVAL_MS = 33;

export class GarmentOverlayService {
  private poseService: PoseService;
  private poseSmoother = new PoseSmoother({
    alpha: 0.45,              // slightly smoother than default 0.55
    velocityAlpha: 0.35,
    confidenceThreshold: 0.35,
    windowSize: 4,            // one extra frame for stability
    extrapolationDamping: 0.45,
  });
  private assetLoader: GarmentAssetLoader;
  private renderer: GarmentRenderer;
  private config: GarmentOverlayConfig;
  private currentAsset: GarmentAsset | null = null;
  private currentImage: HTMLImageElement | null = null;
  private lastAlignment: GarmentAlignment | null = null;
  private lastLandmarks: PoseLandmark[] | null = null;
  private initialized = false;

  // Frame-rate management
  private lastPoseTimestamp = 0;

  constructor(config: GarmentOverlayConfig) {
    this.config = { ...config, opacity: Math.max(0, Math.min(1, config.opacity)) };
    this.poseService = new PoseService();
    this.assetLoader = new GarmentAssetLoader();
    this.renderer = new GarmentRenderer();
  }

  get isInitialized(): boolean { return this.initialized; }
  get currentGarment(): GarmentAsset | null { return this.currentAsset; }
  get lastKnownAlignment(): GarmentAlignment | null { return this.lastAlignment; }

  async initialize(): Promise<void> {
    await this.poseService.initialize();
    this.initialized = true;
  }

  async setGarment(asset: GarmentAsset): Promise<void> {
    this.currentAsset = asset;
    this.currentImage = await this.assetLoader.loadImage(asset);
    this.lastAlignment = null;
    this.poseSmoother.reset(); // fresh start for new garment
  }

  processFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    timestamp: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    if (!this.initialized || !this.currentAsset || !this.currentImage) return;
    if (!this.config.visible) return;

    // ── Pose detection with frame-rate throttling ─────────────────────────
    // Run pose detection at ~30 Hz regardless of RAF cadence.
    // Between detections, reuse the last smoothed landmarks so the garment
    // continues to track without stutter on high-refresh displays.
    const shouldDetect = (timestamp - this.lastPoseTimestamp) >= POSE_DETECTION_INTERVAL_MS;

    if (shouldDetect) {
      const rawLandmarks = this.poseService.detectLandmarks(video, timestamp);
      if (rawLandmarks) {
        const smoothed = this.poseSmoother.smooth(rawLandmarks);
        this.lastLandmarks = smoothed;
        this.lastPoseTimestamp = timestamp;
      } else {
        // Pose lost — keep using last known landmarks so the garment doesn't
        // suddenly disappear on a single missed detection frame.
        this.lastPoseTimestamp = timestamp;
      }
    }

    if (!this.lastLandmarks) return;

    const measurements = computeBodyMeasurements(
      this.lastLandmarks,
      canvasWidth,
      canvasHeight,
      this.config.visibilityThreshold,
    );
    if (!measurements) return;

    const alignment = computeEnhancedGarmentAlignment(
      measurements,
      this.currentAsset,
      this.lastLandmarks,
      canvasWidth,
      canvasHeight,
      this.config.opacity,
      this.config.mirrored,
      this.config.visibilityThreshold,
    );
    this.lastAlignment = alignment;

    this.renderer.render(ctx, this.currentImage, this.currentAsset, alignment, this.config);

    if (this.config.debugLandmarks) {
      this.renderer.renderLandmarks(
        ctx, this.lastLandmarks, canvasWidth, canvasHeight, this.config.visibilityThreshold,
      );
    }
  }

  updateConfig(patch: Partial<GarmentOverlayConfig>): void {
    this.config = { ...this.config, ...patch };
    if (patch.opacity !== undefined) {
      this.config.opacity = Math.max(0, Math.min(1, patch.opacity));
    }
  }

  getConfig(): GarmentOverlayConfig { return { ...this.config }; }

  getLastLandmarks(): PoseLandmark[] | null { return this.lastLandmarks; }

  reset(): void {
    this.lastAlignment   = null;
    this.lastLandmarks   = null;
    this.currentAsset    = null;
    this.currentImage    = null;
    this.lastPoseTimestamp = 0;
    this.poseSmoother.reset();
  }

  destroy(): void {
    this.poseService.destroy();
    this.assetLoader.clearCache();
    this.reset();
    this.initialized = false;
  }
}
