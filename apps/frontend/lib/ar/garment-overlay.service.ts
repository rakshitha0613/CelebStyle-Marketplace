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

export class GarmentOverlayService {
  private poseService: PoseService;
  private poseSmoother = new PoseSmoother();
  private assetLoader: GarmentAssetLoader;
  private renderer: GarmentRenderer;
  private config: GarmentOverlayConfig;
  private currentAsset: GarmentAsset | null = null;
  private currentImage: HTMLImageElement | null = null;
  private lastAlignment: GarmentAlignment | null = null;
  private lastLandmarks: PoseLandmark[] | null = null;
  private initialized = false;

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

    const rawLandmarks = this.poseService.detectLandmarks(video, timestamp);
    if (!rawLandmarks) { this.lastLandmarks = null; return; }

    // Smooth raw landmarks before every downstream calculation
    const landmarks = this.poseSmoother.smooth(rawLandmarks);
    this.lastLandmarks = landmarks;

    const measurements = computeBodyMeasurements(
      landmarks,
      canvasWidth,
      canvasHeight,
      this.config.visibilityThreshold,
    );
    if (!measurements) return;

    const alignment = computeEnhancedGarmentAlignment(
      measurements,
      this.currentAsset,
      landmarks,
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
        ctx, landmarks, canvasWidth, canvasHeight, this.config.visibilityThreshold,
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

  /** Returns the most-recently detected landmark array, or null if not yet detected */
  getLastLandmarks(): PoseLandmark[] | null { return this.lastLandmarks; }

  reset(): void {
    this.lastAlignment  = null;
    this.lastLandmarks  = null;
    this.currentAsset   = null;
    this.currentImage   = null;
    this.poseSmoother.reset();
  }

  destroy(): void {
    this.poseService.destroy();
    this.assetLoader.clearCache();
    this.reset();
    this.initialized = false;
  }
}
