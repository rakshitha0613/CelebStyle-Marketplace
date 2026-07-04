import type { ARConfig, MaskData, FrameMetrics } from './types.js';
import { PerformanceMonitor } from './performance.monitor.js';
import { SegmentationService } from './segmentation.service.js';
import { BackgroundService } from './background.service.js';

export type PipelineStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';

export interface PipelineState {
  status: PipelineStatus;
  frameCount: number;
  lastMask: MaskData | null;
  metrics: FrameMetrics;
}

export interface PipelineCallbacks {
  onFrame?: (ctx: CanvasRenderingContext2D, state: PipelineState) => void;
  onMetrics?: (metrics: FrameMetrics) => void;
  onError?: (error: Error) => void;
}

export class RenderPipeline {
  private rafId: number | null = null;
  private state: PipelineState = {
    status: 'IDLE',
    frameCount: 0,
    lastMask: null,
    metrics: { fps: 0, latencyMs: 0, segmentationMs: 0, renderMs: 0, droppedFrames: 0 },
  };
  private monitor = new PerformanceMonitor();
  private segService: SegmentationService;
  private bgService: BackgroundService;
  private config: ARConfig;
  private callbacks: PipelineCallbacks;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(config: ARConfig, callbacks: PipelineCallbacks = {}) {
    this.config = { ...config };
    this.callbacks = callbacks;
    this.segService = new SegmentationService(config.segmentation);
    this.bgService = new BackgroundService(config.background);
  }

  async initialize(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    this.video = video;
    this.canvas = canvas;
    await this.segService.initialize();
  }

  start(): void {
    if (this.state.status === 'RUNNING') return;
    this.state.status = 'RUNNING';
    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }

  pause(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.state.status = 'PAUSED';
  }

  resume(): void {
    if (this.state.status !== 'PAUSED') return;
    this.state.status = 'RUNNING';
    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }

  stop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.state.status = 'IDLE';
    this.monitor.reset();
  }

  private tick(timestamp: number): void {
    if (this.state.status !== 'RUNNING') return;
    void this.processFrame(timestamp);
  }

  private async processFrame(timestamp: number): Promise<void> {
    if (!this.video || !this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const renderStart = performance.now();
    this.monitor.recordFrame(timestamp);
    this.state.frameCount++;

    try {
      const segStart = performance.now();
      const mask = await this.segService.segmentFrame(this.video, timestamp);
      this.monitor.recordSegmentation(performance.now() - segStart);

      if (mask) this.state.lastMask = mask;

      this.bgService.apply(ctx, this.video, this.state.lastMask, this.canvas.width, this.canvas.height);

      this.callbacks.onFrame?.(ctx, { ...this.state });
      this.monitor.recordRender(performance.now() - renderStart);

      if (this.state.frameCount % 30 === 0) {
        this.state.metrics = this.monitor.getMetrics();
        this.callbacks.onMetrics?.(this.state.metrics);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.state.status = 'ERROR';
      this.callbacks.onError?.(error);
      return;
    }

    if (this.state.status === 'RUNNING') {
      this.rafId = requestAnimationFrame((ts) => this.tick(ts));
    }
  }

  updateConfig(config: Partial<ARConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.segmentation) this.segService.updateConfig(config.segmentation);
    if (config.background) this.bgService.updateConfig(config.background);
  }

  getState(): PipelineState { return { ...this.state }; }

  destroy(): void {
    this.stop();
    this.segService.destroy();
    this.bgService.destroy();
    this.video = null;
    this.canvas = null;
  }
}
