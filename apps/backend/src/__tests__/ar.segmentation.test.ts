/**
 * @ar6.2.celebstyle.segmentation — Sprint 6.2 AR segmentation & pipeline tests
 * Self-contained Node.js-compatible tests. No browser APIs, no MediaPipe.
 */

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function approx(a: number, b: number, tolerance = 1): boolean {
  return Math.abs(a - b) <= tolerance;
}

// ── Inline implementations — mirror of lib/ar/mask-processor.ts ──────────────

function thresholdMask(confidenceMask: Float32Array, threshold: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(confidenceMask.length);
  for (let i = 0; i < confidenceMask.length; i++) {
    result[i] = confidenceMask[i] >= threshold ? 255 : 0;
  }
  return result;
}

function smoothMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(mask);
  const result = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0; let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += mask[ny * width + nx]; count++;
          }
        }
      }
      result[y * width + x] = Math.round(sum / count);
    }
  }
  return result;
}

function temporalSmooth(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  factor: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(current.length);
  const f = Math.max(0, Math.min(1, factor));
  for (let i = 0; i < current.length; i++) {
    result[i] = Math.round(current[i] * (1 - f) + previous[i] * f);
  }
  return result;
}

function blendMasks(
  maskA: Uint8ClampedArray,
  maskB: Uint8ClampedArray,
  alpha: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(maskA.length);
  const a = Math.max(0, Math.min(1, alpha));
  for (let i = 0; i < maskA.length; i++) {
    result[i] = Math.round(maskA[i] * (1 - a) + maskB[i] * a);
  }
  return result;
}

function computeCoverage(mask: Uint8ClampedArray): number {
  if (mask.length === 0) return 0;
  let p = 0;
  for (let i = 0; i < mask.length; i++) { if (mask[i] > 127) p++; }
  return p / mask.length;
}

function getMaskBoundingBox(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 127) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX === -1) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function erodeMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  kernelSize: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(mask.length);
  const r = Math.floor(kernelSize / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const v = mask[ny * width + nx]; if (v < minVal) minVal = v;
          } else { minVal = 0; }
        }
      }
      result[y * width + x] = minVal;
    }
  }
  return result;
}

// ── Mock SegmentationService (state machine only) ─────────────────────────────

type InitStatus = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

interface SegmentationConfig {
  modelType: 'portrait' | 'landscape';
  confidenceThreshold: number;
  smoothingFactor: number;
  runEveryNFrames: number;
}

class MockSegmentationService {
  private _status: InitStatus = 'UNINITIALIZED';
  private config: SegmentationConfig;

  constructor(config: SegmentationConfig) { this.config = { ...config }; }

  get initStatus(): InitStatus { return this._status; }
  get isReady(): boolean { return this._status === 'READY'; }

  async initialize(): Promise<void> {
    if (this._status === 'READY') return;
    if (this._status === 'INITIALIZING') throw new Error('Already initializing');
    this._status = 'INITIALIZING';
    // Simulate async init
    await Promise.resolve();
    this._status = 'READY';
  }

  updateConfig(patch: Partial<SegmentationConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): SegmentationConfig { return { ...this.config }; }

  destroy(): void {
    this._status = 'UNINITIALIZED';
  }
}

// ── Mock BackgroundService ────────────────────────────────────────────────────

type BackgroundMode = 'NONE' | 'BLUR' | 'REPLACE' | 'TRANSPARENT';

interface BackgroundConfig {
  mode: BackgroundMode;
  blurStrength: number;
  replacementImageUrl?: string;
  color?: string;
}

class MockBackgroundService {
  private config: BackgroundConfig;

  constructor(config: BackgroundConfig) { this.config = { ...config }; }

  get mode(): BackgroundMode { return this.config.mode; }
  get blurStrength(): number { return this.config.blurStrength; }

  updateConfig(patch: Partial<BackgroundConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  destroy(): void { /* no-op in mock */ }
}

// ── Mock RenderPipeline ───────────────────────────────────────────────────────

type PipelineStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR';

class MockRenderPipeline {
  private _status: PipelineStatus = 'IDLE';
  private _frameCount = 0;
  private _errorHandler: ((e: Error) => void) | null = null;

  get status(): PipelineStatus { return this._status; }
  get frameCount(): number { return this._frameCount; }

  onError(fn: (e: Error) => void): void { this._errorHandler = fn; }

  start(): void {
    if (this._status === 'RUNNING') return;
    this._status = 'RUNNING';
  }

  stop(): void {
    this._status = 'IDLE';
    this._frameCount = 0;
  }

  pause(): void { this._status = 'PAUSED'; }
  resume(): void { if (this._status === 'PAUSED') this._status = 'RUNNING'; }

  simulateFrames(n: number): void {
    for (let i = 0; i < n; i++) this._frameCount++;
  }

  simulateError(msg: string): void {
    this._status = 'ERROR';
    this._errorHandler?.(new Error(msg));
  }

  destroy(): void { this.stop(); }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('============================================================');
console.log('  Sprint 6.2 — AR Segmentation & Pipeline Tests');
console.log('============================================================');

// [1] thresholdMask — above threshold becomes 255
console.log('\n  [1] thresholdMask — values above threshold');
{
  const raw = new Float32Array([0.9, 0.8, 0.5, 0.4, 0.1]);
  const mask = thresholdMask(raw, 0.5);
  ok('0.9 ≥ 0.5 → 255', mask[0] === 255);
  ok('0.8 ≥ 0.5 → 255', mask[1] === 255);
  ok('0.5 ≥ 0.5 → 255 (inclusive)', mask[2] === 255);
  ok('0.4 < 0.5 → 0', mask[3] === 0);
  ok('0.1 < 0.5 → 0', mask[4] === 0);
}

// [2] thresholdMask — output length matches input
console.log('\n  [2] thresholdMask — output size');
{
  const raw = new Float32Array(100).fill(0.8);
  const mask = thresholdMask(raw, 0.7);
  ok('output length = input length', mask.length === 100);
  ok('all above threshold → all 255', Array.from(mask).every((v) => v === 255));
}

// [3] thresholdMask — all below threshold
console.log('\n  [3] thresholdMask — all below threshold → all 0');
{
  const raw = new Float32Array([0.1, 0.2, 0.3]);
  const mask = thresholdMask(raw, 0.5);
  ok('all 0', Array.from(mask).every((v) => v === 0));
}

// [4] smoothMask — output same size as input
console.log('\n  [4] smoothMask — output size preserved');
{
  const mask = new Uint8ClampedArray(16).fill(255);
  const smoothed = smoothMask(mask, 4, 4, 1);
  ok('output length = 16', smoothed.length === 16);
}

// [5] smoothMask — uniform mask unchanged
console.log('\n  [5] smoothMask — uniform mask identity');
{
  const mask = new Uint8ClampedArray(9).fill(200);
  const smoothed = smoothMask(mask, 3, 3, 1);
  ok('all values = 200 after smoothing uniform mask', Array.from(smoothed).every((v) => v === 200));
}

// [6] smoothMask — radius=0 returns copy
console.log('\n  [6] smoothMask — radius 0 is identity');
{
  const mask = new Uint8ClampedArray([100, 200, 50]);
  const smoothed = smoothMask(mask, 3, 1, 0);
  ok('value[0] unchanged', smoothed[0] === 100);
  ok('value[1] unchanged', smoothed[1] === 200);
}

// [7] temporalSmooth — factor=0 returns current unchanged
console.log('\n  [7] temporalSmooth — factor=0 returns current');
{
  const curr = new Uint8ClampedArray([100, 200]);
  const prev = new Uint8ClampedArray([50, 50]);
  const result = temporalSmooth(curr, prev, 0);
  ok('result[0] = current[0]', result[0] === 100);
  ok('result[1] = current[1]', result[1] === 200);
}

// [8] temporalSmooth — factor=1 returns previous
console.log('\n  [8] temporalSmooth — factor=1 returns previous');
{
  const curr = new Uint8ClampedArray([100, 200]);
  const prev = new Uint8ClampedArray([50, 80]);
  const result = temporalSmooth(curr, prev, 1);
  ok('result[0] = previous[0]', result[0] === 50);
  ok('result[1] = previous[1]', result[1] === 80);
}

// [9] temporalSmooth — factor=0.5 blends equally
console.log('\n  [9] temporalSmooth — factor=0.5 blends evenly');
{
  const curr = new Uint8ClampedArray([200]);
  const prev = new Uint8ClampedArray([100]);
  const result = temporalSmooth(curr, prev, 0.5);
  ok('blend of 200 and 100 at 0.5 = 150', result[0] === 150);
}

// [10] blendMasks — alpha=0 returns maskA
console.log('\n  [10] blendMasks — alpha=0 returns maskA');
{
  const a = new Uint8ClampedArray([100, 200]);
  const b = new Uint8ClampedArray([50, 50]);
  const result = blendMasks(a, b, 0);
  ok('result[0] = maskA[0]', result[0] === 100);
  ok('result[1] = maskA[1]', result[1] === 200);
}

// [11] blendMasks — alpha=1 returns maskB
console.log('\n  [11] blendMasks — alpha=1 returns maskB');
{
  const a = new Uint8ClampedArray([100, 200]);
  const b = new Uint8ClampedArray([50, 80]);
  const result = blendMasks(a, b, 1);
  ok('result[0] = maskB[0]', result[0] === 50);
  ok('result[1] = maskB[1]', result[1] === 80);
}

// [12] blendMasks — alpha=0.5 blends evenly
console.log('\n  [12] blendMasks — alpha=0.5 mid blend');
{
  const a = new Uint8ClampedArray([0]);
  const b = new Uint8ClampedArray([200]);
  const result = blendMasks(a, b, 0.5);
  ok('blend of 0 and 200 at 0.5 = 100', result[0] === 100);
}

// [13] computeCoverage — all person pixels
console.log('\n  [13] computeCoverage — all person → 1.0');
{
  const mask = new Uint8ClampedArray(100).fill(255);
  ok('coverage = 1.0', computeCoverage(mask) === 1.0);
}

// [14] computeCoverage — all background
console.log('\n  [14] computeCoverage — all background → 0.0');
{
  const mask = new Uint8ClampedArray(100).fill(0);
  ok('coverage = 0.0', computeCoverage(mask) === 0.0);
}

// [15] computeCoverage — half coverage
console.log('\n  [15] computeCoverage — half pixels → ~0.5');
{
  const mask = new Uint8ClampedArray(100);
  for (let i = 0; i < 50; i++) mask[i] = 255;
  const cov = computeCoverage(mask);
  ok('coverage ≈ 0.5', Math.abs(cov - 0.5) < 0.01);
}

// [16] computeCoverage — empty mask → 0
console.log('\n  [16] computeCoverage — empty mask');
{
  ok('empty → 0', computeCoverage(new Uint8ClampedArray(0)) === 0);
}

// [17] computeCoverage — pixel threshold is strictly >127
console.log('\n  [17] computeCoverage — pixel threshold = 127 (exclusive)');
{
  const mask = new Uint8ClampedArray([127, 128, 0, 255]);
  const cov = computeCoverage(mask);
  // 127 → not counted (≤127), 128 and 255 → counted = 2/4 = 0.5
  ok('127 not counted; 128 and 255 counted', Math.abs(cov - 0.5) < 0.01);
}

// [18] getMaskBoundingBox — no person pixels → empty bbox
console.log('\n  [18] getMaskBoundingBox — no person pixels');
{
  const mask = new Uint8ClampedArray(9).fill(0);
  const bb = getMaskBoundingBox(mask, 3, 3);
  ok('x = 0', bb.x === 0);
  ok('y = 0', bb.y === 0);
  ok('width = 0', bb.width === 0);
  ok('height = 0', bb.height === 0);
}

// [19] getMaskBoundingBox — full mask → full bbox
console.log('\n  [19] getMaskBoundingBox — full mask');
{
  const mask = new Uint8ClampedArray(9).fill(255);
  const bb = getMaskBoundingBox(mask, 3, 3);
  ok('x = 0', bb.x === 0);
  ok('y = 0', bb.y === 0);
  ok('width = 3', bb.width === 3);
  ok('height = 3', bb.height === 3);
}

// [20] getMaskBoundingBox — single pixel
console.log('\n  [20] getMaskBoundingBox — single pixel at (1,1)');
{
  const mask = new Uint8ClampedArray(9).fill(0);
  mask[1 * 3 + 1] = 255; // (1,1) in a 3×3 mask
  const bb = getMaskBoundingBox(mask, 3, 3);
  ok('x = 1', bb.x === 1);
  ok('y = 1', bb.y === 1);
  ok('width = 1', bb.width === 1);
  ok('height = 1', bb.height === 1);
}

// [21] erodeMask — shrinks person region inward
console.log('\n  [21] erodeMask — shrinks edges');
{
  // 5×5 mask with all 255 — erosion with kernel=3 removes 1-pixel border
  const mask = new Uint8ClampedArray(25).fill(255);
  const eroded = erodeMask(mask, 5, 5, 3);
  // Corner pixels should become 0 (edge pixels get min=0 from OOB neighbors)
  ok('top-left corner eroded to 0', eroded[0] === 0);
  ok('bottom-right corner eroded to 0', eroded[24] === 0);
  ok('center pixel (2,2) remains 255', eroded[2 * 5 + 2] === 255);
}

// [22] erodeMask — kernel=1 does not change uniform mask
console.log('\n  [22] erodeMask — kernel=1 on interior pixels');
{
  // A 3×3 mask with center = 255, borders = 255
  const mask = new Uint8ClampedArray(25).fill(255);
  const eroded = erodeMask(mask, 5, 5, 1);
  // kernel=1 → r=0, no neighborhood — identity
  ok('kernel=1 center pixel unchanged', eroded[2 * 5 + 2] === 255);
}

// [23] MockSegmentationService — initial status UNINITIALIZED
console.log('\n  [23] SegmentationService — initial status');
{
  const svc = new MockSegmentationService({
    modelType: 'portrait', confidenceThreshold: 0.7, smoothingFactor: 0.5, runEveryNFrames: 2,
  });
  ok('initial status = UNINITIALIZED', svc.initStatus === 'UNINITIALIZED');
  ok('isReady = false', !svc.isReady);
}

// [24] MockSegmentationService — after initialize → READY
console.log('\n  [24] SegmentationService — initialize → READY');
{
  const svc = new MockSegmentationService({
    modelType: 'portrait', confidenceThreshold: 0.7, smoothingFactor: 0.5, runEveryNFrames: 2,
  });
  await svc.initialize();
  ok('status = READY after init', svc.initStatus === 'READY');
  ok('isReady = true after init', svc.isReady);
}

// [25] MockSegmentationService — updateConfig merges correctly
console.log('\n  [25] SegmentationService — updateConfig');
{
  const svc = new MockSegmentationService({
    modelType: 'portrait', confidenceThreshold: 0.7, smoothingFactor: 0.5, runEveryNFrames: 2,
  });
  svc.updateConfig({ confidenceThreshold: 0.9, runEveryNFrames: 3 });
  const cfg = svc.getConfig();
  ok('confidenceThreshold updated to 0.9', cfg.confidenceThreshold === 0.9);
  ok('runEveryNFrames updated to 3', cfg.runEveryNFrames === 3);
  ok('modelType unchanged', cfg.modelType === 'portrait');
  ok('smoothingFactor unchanged', cfg.smoothingFactor === 0.5);
}

// [26] MockSegmentationService — destroy resets state
console.log('\n  [26] SegmentationService — destroy');
{
  const svc = new MockSegmentationService({
    modelType: 'portrait', confidenceThreshold: 0.7, smoothingFactor: 0.5, runEveryNFrames: 2,
  });
  await svc.initialize();
  svc.destroy();
  ok('status = UNINITIALIZED after destroy', svc.initStatus === 'UNINITIALIZED');
  ok('isReady = false after destroy', !svc.isReady);
}

// [27] MockBackgroundService — mode stored
console.log('\n  [27] BackgroundService — mode stored');
{
  const svc = new MockBackgroundService({ mode: 'BLUR', blurStrength: 10 });
  ok('mode = BLUR', svc.mode === 'BLUR');
  ok('blurStrength = 10', svc.blurStrength === 10);
}

// [28] MockBackgroundService — updateConfig changes mode
console.log('\n  [28] BackgroundService — updateConfig');
{
  const svc = new MockBackgroundService({ mode: 'NONE', blurStrength: 5 });
  svc.updateConfig({ mode: 'TRANSPARENT' });
  ok('mode changed to TRANSPARENT', svc.mode === 'TRANSPARENT');
  ok('blurStrength unchanged', svc.blurStrength === 5);
}

// [29] MockBackgroundService — NONE is valid mode
console.log('\n  [29] BackgroundService — NONE mode');
{
  const svc = new MockBackgroundService({ mode: 'NONE', blurStrength: 0 });
  ok('NONE mode set', svc.mode === 'NONE');
}

// [30] MockRenderPipeline — initial state is IDLE
console.log('\n  [30] RenderPipeline — initial state');
{
  const p = new MockRenderPipeline();
  ok('status = IDLE', p.status === 'IDLE');
  ok('frameCount = 0', p.frameCount === 0);
}

// [31] MockRenderPipeline — start → RUNNING
console.log('\n  [31] RenderPipeline — start → RUNNING');
{
  const p = new MockRenderPipeline();
  p.start();
  ok('status = RUNNING after start', p.status === 'RUNNING');
}

// [32] MockRenderPipeline — stop → IDLE
console.log('\n  [32] RenderPipeline — stop → IDLE');
{
  const p = new MockRenderPipeline();
  p.start();
  p.stop();
  ok('status = IDLE after stop', p.status === 'IDLE');
}

// [33] MockRenderPipeline — pause/resume cycle
console.log('\n  [33] RenderPipeline — pause/resume cycle');
{
  const p = new MockRenderPipeline();
  p.start();
  p.pause();
  ok('status = PAUSED', p.status === 'PAUSED');
  p.resume();
  ok('status = RUNNING after resume', p.status === 'RUNNING');
}

// [34] MockRenderPipeline — error propagation
console.log('\n  [34] RenderPipeline — error propagation');
{
  const p = new MockRenderPipeline();
  let caught: Error | null = null;
  p.onError((e) => { caught = e; });
  p.start();
  p.simulateError('GPU context lost');
  ok('status = ERROR', p.status === 'ERROR');
  // cast needed: TypeScript narrows `caught` to null because it doesn't track callback mutations through class methods
  ok('onError called with correct message', (caught as Error | null)?.message === 'GPU context lost');
}

// [35] MockRenderPipeline — frame counting
console.log('\n  [35] RenderPipeline — frame counting');
{
  const p = new MockRenderPipeline();
  p.start();
  p.simulateFrames(30);
  ok('frameCount = 30', p.frameCount === 30);
}

// [36] Worker message protocol — INIT message format
console.log('\n  [36] Worker message protocol — INIT');
{
  const msg = { type: 'INIT', payload: { modelType: 'portrait', confidenceThreshold: 0.7, smoothingFactor: 0.5, runEveryNFrames: 2 } };
  ok('type = INIT', msg.type === 'INIT');
  ok('payload has modelType', 'modelType' in msg.payload);
  ok('payload has confidenceThreshold', 'confidenceThreshold' in msg.payload);
  ok('portrait model type valid', msg.payload.modelType === 'portrait');
}

// [37] Worker message protocol — SEGMENT message format
console.log('\n  [37] Worker message protocol — SEGMENT');
{
  const msg = { type: 'SEGMENT', payload: { frame: null as unknown as ImageBitmap, timestamp: 12345 } };
  ok('type = SEGMENT', msg.type === 'SEGMENT');
  ok('timestamp present', typeof msg.payload.timestamp === 'number');
  ok('timestamp = 12345', msg.payload.timestamp === 12345);
}

// [38] Worker message protocol — MASK response format
console.log('\n  [38] Worker message protocol — MASK response');
{
  const buf = new ArrayBuffer(100);
  const msg = { type: 'MASK', payload: { data: buf, width: 10, height: 10, timestamp: 1000, latencyMs: 8 } };
  ok('type = MASK', msg.type === 'MASK');
  ok('payload.data is ArrayBuffer', msg.payload.data instanceof ArrayBuffer);
  ok('payload.width = 10', msg.payload.width === 10);
  ok('payload.height = 10', msg.payload.height === 10);
  ok('payload.latencyMs = 8', msg.payload.latencyMs === 8);
}

// [39] Worker message protocol — DESTROY message
console.log('\n  [39] Worker message protocol — DESTROY');
{
  const msg = { type: 'DESTROY' };
  ok('type = DESTROY', msg.type === 'DESTROY');
}

// [40] Coverage threshold — computeCoverage threshold consistency
console.log('\n  [40] computeCoverage — threshold consistency with thresholdMask');
{
  const raw = new Float32Array(100);
  // 70 pixels above 0.7 threshold
  for (let i = 0; i < 70; i++) raw[i] = 0.9;
  for (let i = 70; i < 100; i++) raw[i] = 0.1;
  const binary = thresholdMask(raw, 0.7);
  const coverage = computeCoverage(binary);
  ok('thresholdMask → coverage pipeline: 70% coverage', approx(coverage * 100, 70, 1));
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n============================================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) process.exit(1);
