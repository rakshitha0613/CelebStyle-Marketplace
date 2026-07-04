import type { FrameMetrics } from './types.js';

const WINDOW_SIZE = 60;
const DROPPED_FRAME_THRESHOLD_MS = 66; // 2× target 33 ms

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private segmentationTimes: number[] = [];
  private renderTimes: number[] = [];
  private droppedFrames = 0;
  private lastFrameTime = -1;

  recordFrame(now: number): void {
    if (this.lastFrameTime >= 0) {
      const delta = now - this.lastFrameTime;
      if (delta > DROPPED_FRAME_THRESHOLD_MS) this.droppedFrames++;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > WINDOW_SIZE) this.frameTimes.shift();
    }
    this.lastFrameTime = now;
  }

  recordSegmentation(ms: number): void {
    this.segmentationTimes.push(ms);
    if (this.segmentationTimes.length > WINDOW_SIZE) this.segmentationTimes.shift();
  }

  recordRender(ms: number): void {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > WINDOW_SIZE) this.renderTimes.shift();
  }

  getMetrics(): FrameMetrics {
    const avg = (arr: number[]): number =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const avgDelta = avg(this.frameTimes);
    const fps = avgDelta === 0 ? 0 : Math.round(1000 / avgDelta);
    const segMs = avg(this.segmentationTimes);
    const renderMs = avg(this.renderTimes);

    return {
      fps,
      latencyMs: parseFloat((segMs + renderMs).toFixed(2)),
      segmentationMs: parseFloat(segMs.toFixed(2)),
      renderMs: parseFloat(renderMs.toFixed(2)),
      droppedFrames: this.droppedFrames,
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.segmentationTimes = [];
    this.renderTimes = [];
    this.droppedFrames = 0;
    this.lastFrameTime = -1;
  }
}
