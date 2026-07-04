/**
 * @ar6.2.celebstyle.camera — Sprint 6.2 AR camera & performance tests
 * Self-contained Node.js-compatible tests. No browser APIs required.
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

// ── Inline implementations (mirrors camera.utils.ts + performance.monitor.ts) ──

type CameraFacingMode = 'user' | 'environment';
type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'CAMERA_IN_USE'
  | 'CONSTRAINT_ERROR'
  | 'UNKNOWN';

function buildVideoConstraints(
  facingMode: CameraFacingMode,
  targetWidth = 1280,
  targetHeight = 720,
): Record<string, unknown> {
  return {
    facingMode,
    width: { ideal: targetWidth },
    height: { ideal: targetHeight },
    frameRate: { ideal: 30, max: 60 },
  };
}

function detectOptimalFacingMode(): CameraFacingMode {
  return 'user';
}

function classifyCameraError(error: unknown): CameraErrorCode {
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  ) {
    const name = (error as { name: string }).name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'PERMISSION_DENIED';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'NO_CAMERA';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'CAMERA_IN_USE';
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'CONSTRAINT_ERROR';
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

type ARTier = 'FULL' | 'MID' | 'LITE' | 'STATIC';
const VALID_TIERS: ARTier[] = ['FULL', 'MID', 'LITE', 'STATIC'];

interface FrameMetrics {
  fps: number;
  latencyMs: number;
  segmentationMs: number;
  renderMs: number;
  droppedFrames: number;
}

class PerformanceMonitor {
  private frameTimes: number[] = [];
  private segmentationTimes: number[] = [];
  private renderTimes: number[] = [];
  private droppedFrames = 0;
  private lastFrameTime = -1;

  recordFrame(now: number): void {
    if (this.lastFrameTime >= 0) {
      const delta = now - this.lastFrameTime;
      if (delta > 66) this.droppedFrames++;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > 60) this.frameTimes.shift();
    }
    this.lastFrameTime = now;
  }

  recordSegmentation(ms: number): void {
    this.segmentationTimes.push(ms);
    if (this.segmentationTimes.length > 60) this.segmentationTimes.shift();
  }

  recordRender(ms: number): void {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > 60) this.renderTimes.shift();
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDOMException(name: string): { name: string } {
  return { name };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('============================================================');
console.log('  Sprint 6.2 — AR Camera & Performance Tests');
console.log('============================================================');

// [1] buildVideoConstraints — basic structure
console.log('\n  [1] buildVideoConstraints — structure');
{
  const c = buildVideoConstraints('user');
  ok('facingMode = user', c['facingMode'] === 'user');
  ok('width.ideal present', typeof (c['width'] as { ideal: number })?.ideal === 'number');
  ok('height.ideal present', typeof (c['height'] as { ideal: number })?.ideal === 'number');
  ok('frameRate.ideal present', typeof (c['frameRate'] as { ideal: number })?.ideal === 'number');
}

// [2] buildVideoConstraints — custom resolution
console.log('\n  [2] buildVideoConstraints — custom resolution');
{
  const c = buildVideoConstraints('user', 640, 480);
  ok('width.ideal = 640', (c['width'] as { ideal: number })?.ideal === 640);
  ok('height.ideal = 480', (c['height'] as { ideal: number })?.ideal === 480);
}

// [3] buildVideoConstraints — frame rate cap
console.log('\n  [3] buildVideoConstraints — frame rate');
{
  const c = buildVideoConstraints('user');
  const fr = c['frameRate'] as { ideal: number; max: number };
  ok('frameRate.ideal = 30', fr.ideal === 30);
  ok('frameRate.max = 60', fr.max === 60);
}

// [4] buildVideoConstraints — environment facing
console.log('\n  [4] buildVideoConstraints — environment facing mode');
{
  const c = buildVideoConstraints('environment');
  ok('facingMode = environment', c['facingMode'] === 'environment');
}

// [5] classifyCameraError — NotAllowedError → PERMISSION_DENIED
console.log('\n  [5] classifyCameraError — NotAllowedError');
{
  const err = makeDOMException('NotAllowedError');
  ok('NotAllowedError → PERMISSION_DENIED', classifyCameraError(err) === 'PERMISSION_DENIED');
}

// [6] classifyCameraError — PermissionDeniedError (Firefox variant)
console.log('\n  [6] classifyCameraError — PermissionDeniedError (Firefox)');
{
  const err = makeDOMException('PermissionDeniedError');
  ok('PermissionDeniedError → PERMISSION_DENIED', classifyCameraError(err) === 'PERMISSION_DENIED');
}

// [7] classifyCameraError — NotFoundError → NO_CAMERA
console.log('\n  [7] classifyCameraError — NotFoundError');
{
  const err = makeDOMException('NotFoundError');
  ok('NotFoundError → NO_CAMERA', classifyCameraError(err) === 'NO_CAMERA');
}

// [8] classifyCameraError — DevicesNotFoundError → NO_CAMERA
console.log('\n  [8] classifyCameraError — DevicesNotFoundError');
{
  const err = makeDOMException('DevicesNotFoundError');
  ok('DevicesNotFoundError → NO_CAMERA', classifyCameraError(err) === 'NO_CAMERA');
}

// [9] classifyCameraError — NotReadableError → CAMERA_IN_USE
console.log('\n  [9] classifyCameraError — NotReadableError');
{
  const err = makeDOMException('NotReadableError');
  ok('NotReadableError → CAMERA_IN_USE', classifyCameraError(err) === 'CAMERA_IN_USE');
}

// [10] classifyCameraError — OverconstrainedError → CONSTRAINT_ERROR
console.log('\n  [10] classifyCameraError — OverconstrainedError');
{
  const err = makeDOMException('OverconstrainedError');
  ok('OverconstrainedError → CONSTRAINT_ERROR', classifyCameraError(err) === 'CONSTRAINT_ERROR');
}

// [11] classifyCameraError — unknown DOMException name → UNKNOWN
console.log('\n  [11] classifyCameraError — unknown DOMException name');
{
  const err = makeDOMException('SomeOtherError');
  ok('unknown name → UNKNOWN', classifyCameraError(err) === 'UNKNOWN');
}

// [12] classifyCameraError — non-DOMException (plain Error) → UNKNOWN
console.log('\n  [12] classifyCameraError — plain Error → UNKNOWN');
{
  ok('plain Error → UNKNOWN', classifyCameraError(new Error('fail')) === 'UNKNOWN');
  ok('string → UNKNOWN', classifyCameraError('denied') === 'UNKNOWN');
  ok('null → UNKNOWN', classifyCameraError(null) === 'UNKNOWN');
}

// [13] detectOptimalFacingMode — returns valid facing mode
console.log('\n  [13] detectOptimalFacingMode');
{
  const mode = detectOptimalFacingMode();
  ok("returns 'user' or 'environment'", mode === 'user' || mode === 'environment');
  ok('try-on defaults to user (selfie camera)', mode === 'user');
}

// [14] ARTier — all valid tier strings defined
console.log('\n  [14] ARTier values');
{
  ok('FULL in valid tiers', VALID_TIERS.includes('FULL'));
  ok('MID in valid tiers', VALID_TIERS.includes('MID'));
  ok('LITE in valid tiers', VALID_TIERS.includes('LITE'));
  ok('STATIC in valid tiers', VALID_TIERS.includes('STATIC'));
}

// [15] PerformanceMonitor — zero metrics before any frames
console.log('\n  [15] PerformanceMonitor — initial state');
{
  const m = new PerformanceMonitor();
  const metrics = m.getMetrics();
  ok('fps = 0 initially', metrics.fps === 0);
  ok('segmentationMs = 0 initially', metrics.segmentationMs === 0);
  ok('renderMs = 0 initially', metrics.renderMs === 0);
  ok('droppedFrames = 0 initially', metrics.droppedFrames === 0);
}

// [16] PerformanceMonitor — FPS computation at 33ms intervals ≈ 30 FPS
console.log('\n  [16] PerformanceMonitor — FPS = 30 for 33ms intervals');
{
  const m = new PerformanceMonitor();
  let t = 0;
  for (let i = 0; i < 30; i++) { m.recordFrame(t); t += 33; }
  const metrics = m.getMetrics();
  ok('fps ≈ 30 (±2)', Math.abs(metrics.fps - 30) <= 2);
}

// [17] PerformanceMonitor — recordSegmentation tracks latency
console.log('\n  [17] PerformanceMonitor — segmentation latency');
{
  const m = new PerformanceMonitor();
  m.recordSegmentation(10);
  m.recordSegmentation(20);
  const metrics = m.getMetrics();
  ok('avg segmentation = 15ms', metrics.segmentationMs === 15);
}

// [18] PerformanceMonitor — recordRender tracks render time
console.log('\n  [18] PerformanceMonitor — render latency');
{
  const m = new PerformanceMonitor();
  m.recordRender(5);
  m.recordRender(7);
  const metrics = m.getMetrics();
  ok('avg render = 6ms', metrics.renderMs === 6);
  ok('latencyMs = segMs + renderMs', metrics.latencyMs === metrics.segmentationMs + metrics.renderMs);
}

// [19] PerformanceMonitor — dropped frames at >66ms intervals
console.log('\n  [19] PerformanceMonitor — dropped frame detection');
{
  const m = new PerformanceMonitor();
  m.recordFrame(0);
  m.recordFrame(100); // 100ms gap → dropped
  m.recordFrame(200); // another 100ms gap → dropped
  const metrics = m.getMetrics();
  ok('droppedFrames = 2', metrics.droppedFrames === 2);
}

// [20] PerformanceMonitor — reset clears all state
console.log('\n  [20] PerformanceMonitor — reset');
{
  const m = new PerformanceMonitor();
  m.recordFrame(0);
  m.recordFrame(100);
  m.recordSegmentation(15);
  m.recordRender(5);
  m.reset();
  const metrics = m.getMetrics();
  ok('fps = 0 after reset', metrics.fps === 0);
  ok('segmentationMs = 0 after reset', metrics.segmentationMs === 0);
  ok('droppedFrames = 0 after reset', metrics.droppedFrames === 0);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n============================================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) process.exit(1);
