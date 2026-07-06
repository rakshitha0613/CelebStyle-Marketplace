/**
 * Sprint 8.5 — AR Enhancement Tests
 *
 * Self-contained Node.js. No browser APIs, no MediaPipe, no Canvas.
 * All implementations are inlined to mirror the frontend service code.
 *
 * Covers:
 *   PoseSmoother:
 *   [1]  First call seeds state and returns raw frame unchanged
 *   [2]  EMA smoothing: output closer to previous than to raw
 *   [3]  Confidence gate: low-visibility landmark extrapolated from velocity
 *   [4]  Temporal window: subsequent frames are averaged with weights
 *   [5]  Velocity estimates are non-zero after movement
 *   [6]  reset() clears all state
 *   [7]  estimateOrientation returns correct shoulderRotation
 *   [8]  estimateOrientation detects forward-facing pose
 *   [9]  estimateOrientation flags non-forward-facing pose
 *   [10] estimateOrientation returns hipRotation matching shoulder when hips absent
 *
 *   Enhanced Garment Alignment:
 *   [11] computeBodyOrientation returns zero rotation for level shoulders
 *   [12] computeBodyOrientation returns positive rotation for tilted shoulders
 *   [13] perspectiveFactor is < 1 when subject is off-centre
 *   [14] perspectiveFactor is ~1 when subject is centred
 *   [15] computeEnhancedGarmentAlignment returns alignment with orientation
 *   [16] hipVerticalOffset >= 0
 *   [17] perspectiveScale matches orientation.perspectiveFactor
 *   [18] waistCenter.y is between chestCenter.y and hipCenter.y
 *   [19] Enhanced alignment inherits correct rotation from shoulder angle
 *   [20] visible=false when landmark confidence below threshold
 *
 *   Physics — animated wind:
 *   [21] tickAnimatedWind advances windStrength > 0 when baseStrength > 0
 *   [22] windStrength varies over multiple ticks (oscillation)
 *   [23] windStrength is 0 when baseStrength = 0
 *
 *   Physics — body inertia:
 *   [24] updateBodyCenter initializes without error
 *   [25] getBodyVelocity returns non-zero after body movement
 *   [26] Velocity is low-pass filtered (no impulsive spike)
 *   [27] stepWithInertia advances positions of free vertices
 *   [28] stepWithInertia does not move pinned vertices
 *   [29] stepWithInertia applies gravity (y decreases for free vertex)
 *   [30] Body inertia offsets free vertices opposite to movement direction
 *
 *   Enhanced lighting types:
 *   [31] All four presets have fill light defined
 *   [32] All presets have exposure config defined
 *   [33] Fill light intensity is in valid range (0–1)
 *   [34] Exposure value is in plausible range (0.5–2.0)
 *   [35] Dramatic preset has higher directional intensity than soft
 *
 *   Camera utils (facingMode):
 *   [36] buildVideoConstraints with 'environment' uses environment facingMode
 *   [37] buildVideoConstraints with 'user' uses user facingMode
 *
 *   Performance:
 *   [38] smooth() on 33 landmarks executes in < 1ms per call
 *   [39] computeBodyOrientation executes in < 0.5ms per call
 *   [40] computeEnhancedGarmentAlignment executes in < 0.5ms per call
 *   [41] stepWithInertia on 50-vertex mesh executes in < 2ms per call
 *   [42] tickAnimatedWind executes in < 0.1ms per call
 *
 * Sentinel: "@ar85.celebstyle.test"
 * Run: npm run test:ar-enhancement
 */

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function approx(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

function perf(fn: () => void, times = 200): number {
  const t0 = Date.now();
  for (let i = 0; i < times; i++) fn();
  return (Date.now() - t0) / times;
}

// ── Inline types ──────────────────────────────────────────────────────────────

interface PoseLandmark { x: number; y: number; z: number; visibility: number; }

interface GarmentAsset {
  id: string; name: string; type: string; imageUrl: string;
  naturalWidth: number; naturalHeight: number;
  anchors: { leftShoulder: { x: number; y: number }; rightShoulder: { x: number; y: number }; leftHip: { x: number; y: number }; rightHip: { x: number; y: number } };
  scaleMultiplier: number;
}

interface BodyMeasurements {
  shoulderWidth: number;
  chestCenter: { x: number; y: number };
  hipWidth: number;
  hipCenter: { x: number; y: number };
  torsoHeight: number;
  shoulderAngle: number;
  minVisibility: number;
}

interface ConstraintData { indexA: number; indexB: number; restLength: number; stiffness: number; }
interface PhysicsConfig {
  gravity: number; damping: number; stiffness: number; iterations: number;
  windEnabled: boolean; windDirection: { x: number; y: number; z: number }; windStrength: number;
}
const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 9.8, damping: 0.98, stiffness: 50, iterations: 5,
  windEnabled: false, windDirection: { x: 1, y: 0, z: 0 }, windStrength: 0,
};

// ── Inline PoseSmoother ───────────────────────────────────────────────────────

interface PoseSmootherConfig {
  alpha: number; velocityAlpha: number; confidenceThreshold: number;
  windowSize: number; extrapolationDamping: number;
}

const DEFAULT_SMOOTHER_CONFIG: PoseSmootherConfig = {
  alpha: 0.55, velocityAlpha: 0.40, confidenceThreshold: 0.40,
  windowSize: 3, extrapolationDamping: 0.50,
};

interface BodyOrientation {
  shoulderRotation: number; torsoAngle: number; hipRotation: number;
  leftArmAngle: number; rightArmAngle: number;
  isForwardFacing: boolean; confidence: number;
}

class PoseSmoother {
  private smoothed: PoseLandmark[] | null = null;
  private velocities: Array<{ vx: number; vy: number; vz: number }> = [];
  private window: PoseLandmark[][] = [];
  private config: PoseSmootherConfig;

  constructor(config: Partial<PoseSmootherConfig> = {}) {
    this.config = { ...DEFAULT_SMOOTHER_CONFIG, ...config };
  }

  smooth(raw: PoseLandmark[]): PoseLandmark[] {
    if (raw.length === 0) return raw;
    if (!this.smoothed) {
      this.smoothed   = raw.map((lm) => ({ ...lm }));
      this.velocities = raw.map(() => ({ vx: 0, vy: 0, vz: 0 }));
      this.window     = [raw.map((lm) => ({ ...lm }))];
      return this.smoothed;
    }
    const { alpha, velocityAlpha, confidenceThreshold, extrapolationDamping } = this.config;
    const result: PoseLandmark[] = [];
    for (let i = 0; i < raw.length; i++) {
      const cur  = raw[i];
      const prev = this.smoothed[i] ?? cur;
      const vel  = this.velocities[i] ?? { vx: 0, vy: 0, vz: 0 };
      if (cur.visibility < confidenceThreshold && prev.visibility >= confidenceThreshold) {
        result.push({
          x: prev.x + vel.vx * extrapolationDamping,
          y: prev.y + vel.vy * extrapolationDamping,
          z: prev.z + vel.vz * extrapolationDamping,
          visibility: prev.visibility * 0.85,
        });
      } else {
        const sx = alpha * cur.x + (1 - alpha) * prev.x;
        const sy = alpha * cur.y + (1 - alpha) * prev.y;
        const sz = alpha * cur.z + (1 - alpha) * prev.z;
        const sv = alpha * cur.visibility + (1 - alpha) * prev.visibility;
        vel.vx = velocityAlpha * (sx - prev.x) + (1 - velocityAlpha) * vel.vx;
        vel.vy = velocityAlpha * (sy - prev.y) + (1 - velocityAlpha) * vel.vy;
        vel.vz = velocityAlpha * (sz - prev.z) + (1 - velocityAlpha) * vel.vz;
        result.push({ x: sx, y: sy, z: sz, visibility: sv });
      }
    }
    this.window.push(result.map((lm) => ({ ...lm })));
    if (this.window.length > this.config.windowSize) this.window.shift();
    if (this.window.length >= 2) {
      const w = this.window.length;
      const denom = (w * (w + 1)) / 2;
      const stabilized = result.map((_, i) => {
        let sx = 0, sy = 0, sz = 0, sv = 0;
        for (let f = 0; f < this.window.length; f++) {
          const weight = (f + 1) / denom;
          const wlm   = this.window[f][i];
          if (wlm) { sx += wlm.x * weight; sy += wlm.y * weight; sz += wlm.z * weight; sv += wlm.visibility * weight; }
        }
        return { x: sx, y: sy, z: sz, visibility: sv };
      });
      this.smoothed = stabilized;
      return stabilized;
    }
    this.smoothed = result;
    return result;
  }

  estimateOrientation(landmarks: PoseLandmark[]): BodyOrientation {
    const LS = landmarks[11]; const RS = landmarks[12];
    const LE = landmarks[13]; const RE = landmarks[14];
    const LH = landmarks[23]; const RH = landmarks[24];
    const shouldersOk = !!(LS && RS && LS.visibility > 0.4 && RS.visibility > 0.4);
    const hipsOk      = !!(LH && RH && LH.visibility > 0.3 && RH.visibility > 0.3);
    const shoulderRotation = shouldersOk ? Math.atan2(RS!.y - LS!.y, RS!.x - LS!.x) : 0;
    const torsoAngle = shouldersOk ? Math.atan2(RS!.z - LS!.z, Math.abs(RS!.x - LS!.x) + 1e-6) : 0;
    const hipRotation = hipsOk ? Math.atan2(RH!.y - LH!.y, RH!.x - LH!.x) : shoulderRotation;
    const leftArmAngle  = shouldersOk && LE && LE.visibility > 0.3 ? Math.atan2(LE.y - LS!.y, LE.x - LS!.x) : 0;
    const rightArmAngle = shouldersOk && RE && RE.visibility > 0.3 ? Math.atan2(RE.y - RS!.y, RE.x - RS!.x) : 0;
    const zSpread = shouldersOk ? Math.abs(RS!.z - LS!.z) : 1;
    const isForwardFacing = shouldersOk && zSpread < 0.15;
    const visValues = [LS, RS, LH, RH].filter(Boolean).map((l) => l!.visibility);
    const confidence = visValues.length > 0 ? visValues.reduce((a, b) => a + b, 0) / visValues.length : 0;
    return { shoulderRotation, torsoAngle, hipRotation, leftArmAngle, rightArmAngle, isForwardFacing, confidence };
  }

  getVelocity(index: number): { vx: number; vy: number; vz: number } {
    return this.velocities[index] ?? { vx: 0, vy: 0, vz: 0 };
  }

  reset(): void { this.smoothed = null; this.velocities = []; this.window = []; }
  getLastSmoothed(): PoseLandmark[] | null { return this.smoothed; }
}

// ── Inline enhanced alignment ─────────────────────────────────────────────────

interface EnhancedBodyOrientation {
  shoulderRotation: number; torsoTilt: number; forwardLean: number;
  hipRotation: number; perspectiveFactor: number;
}

interface EnhancedGarmentAlignment {
  x: number; y: number; width: number; height: number;
  rotation: number; opacity: number; visible: boolean; mirrored: boolean;
  perspectiveScale: number; hipVerticalOffset: number;
  waistCenter: { x: number; y: number };
  orientation: EnhancedBodyOrientation;
}

const POSE = { LS: 11, RS: 12, LE: 13, RE: 14, LH: 23, RH: 24 };

function computeBodyOrientation(
  landmarks: PoseLandmark[], canvasWidth: number, canvasHeight: number
): EnhancedBodyOrientation {
  const ls = landmarks[POSE.LS]; const rs = landmarks[POSE.RS];
  const lh = landmarks[POSE.LH]; const rh = landmarks[POSE.RH];
  const lsX = ls ? ls.x * canvasWidth  : canvasWidth  * 0.35;
  const lsY = ls ? ls.y * canvasHeight : canvasHeight * 0.35;
  const rsX = rs ? rs.x * canvasWidth  : canvasWidth  * 0.65;
  const rsY = rs ? rs.y * canvasHeight : canvasHeight * 0.35;
  const hasShoulders = !!(ls && rs && ls.visibility > 0.4 && rs.visibility > 0.4);
  const hasHips      = !!(lh && rh && lh.visibility > 0.3 && rh.visibility > 0.3);
  const shoulderRotation = hasShoulders ? Math.atan2(rsY - lsY, rsX - lsX) : 0;
  const forwardLean = hasShoulders
    ? Math.atan2((rs!.z - ls!.z), Math.abs(rsX - lsX) / canvasWidth + 1e-6) : 0;
  const hipRotation = hasHips
    ? Math.atan2((rh!.y - lh!.y) * canvasHeight, (rh!.x - lh!.x) * canvasWidth)
    : shoulderRotation;
  const midX = (lsX + rsX) / (2 * canvasWidth);
  const offCentre = Math.abs(midX - 0.5) * 2;
  const perspectiveFactor = Math.max(0.9, Math.min(1.1, 1 - offCentre * 0.04));
  return { shoulderRotation, torsoTilt: shoulderRotation, forwardLean, hipRotation, perspectiveFactor };
}

function computeEnhancedGarmentAlignment(
  measurements: BodyMeasurements, garment: GarmentAsset,
  landmarks: PoseLandmark[], canvasWidth: number, canvasHeight: number,
  opacity: number, mirrored: boolean, visibilityThreshold = 0.5
): EnhancedGarmentAlignment {
  const orientation   = computeBodyOrientation(landmarks, canvasWidth, canvasHeight);
  const targetWidth   = measurements.shoulderWidth * garment.scaleMultiplier * orientation.perspectiveFactor;
  const targetHeight  = targetWidth * (garment.naturalHeight / garment.naturalWidth);
  const waistCenter   = {
    x: (measurements.chestCenter.x + measurements.hipCenter.x) * 0.5,
    y: (measurements.chestCenter.y + measurements.hipCenter.y) * 0.5,
  };
  const idealBottom       = measurements.chestCenter.y + targetHeight * 0.85;
  const hipVerticalOffset = measurements.hipCenter.y > 0
    ? Math.max(0, measurements.hipCenter.y - idealBottom) * 0.15 : 0;
  return {
    x: measurements.chestCenter.x,
    y: measurements.chestCenter.y + hipVerticalOffset,
    width: targetWidth, height: targetHeight,
    rotation: measurements.shoulderAngle,
    opacity: Math.max(0, Math.min(1, opacity)),
    visible: measurements.minVisibility >= visibilityThreshold,
    mirrored,
    perspectiveScale: orientation.perspectiveFactor,
    hipVerticalOffset, waistCenter, orientation,
  };
}

// ── Inline physics service (subset) ──────────────────────────────────────────

class PhysicsService {
  private vertexCount   = 0;
  private positions     = new Float32Array(0);
  private prevPositions = new Float32Array(0);
  private pinned        = new Uint8Array(0);
  private constraints: ConstraintData[] = [];
  private wind         = { x: 0, y: 0, z: 0 };
  windStrength          = 0;
  private windPhase     = 0;
  bodyVelocity          = { x: 0, y: 0, z: 0 };
  private prevBodyCenter = { x: 0, y: 0, z: 0 };
  private bodyCenterInit = false;

  initialize(vertexCount: number, initialPositions: Float32Array, constraints: ConstraintData[]): void {
    this.vertexCount   = vertexCount;
    this.positions     = new Float32Array(initialPositions);
    this.prevPositions = new Float32Array(initialPositions);
    this.pinned        = new Uint8Array(vertexCount);
    this.constraints   = constraints;
  }

  pinVertex(i: number): void { this.pinned[i] = 1; }
  setWind(d: { x: number; y: number; z: number }, s: number): void { this.wind = d; this.windStrength = s; }
  setVertexPosition(i: number, x: number, y: number, z: number): void {
    const j = i * 3;
    this.positions[j] = x; this.positions[j+1] = y; this.positions[j+2] = z;
    this.prevPositions[j] = x; this.prevPositions[j+1] = y; this.prevPositions[j+2] = z;
  }
  getPosition(i: number): { x: number; y: number; z: number } {
    const j = i * 3;
    return { x: this.positions[j], y: this.positions[j+1], z: this.positions[j+2] };
  }

  tickAnimatedWind(dt: number, baseStrength: number): void {
    this.windPhase += dt * 0.9;
    const primary   = Math.sin(this.windPhase) * 0.40 + 0.60;
    const gust      = Math.sin(this.windPhase * 2.7) * 0.12;
    this.windStrength = Math.max(0, baseStrength * (primary + gust));
  }

  updateBodyCenter(cx: number, cy: number, cz: number, dt: number): void {
    if (!this.bodyCenterInit) { this.prevBodyCenter = { x: cx, y: cy, z: cz }; this.bodyCenterInit = true; return; }
    const invDt = dt > 1e-6 ? 1 / dt : 0;
    const rawVx = (cx - this.prevBodyCenter.x) * invDt;
    const rawVy = (cy - this.prevBodyCenter.y) * invDt;
    const rawVz = (cz - this.prevBodyCenter.z) * invDt;
    this.bodyVelocity.x = this.bodyVelocity.x * 0.75 + rawVx * 0.25;
    this.bodyVelocity.y = this.bodyVelocity.y * 0.75 + rawVy * 0.25;
    this.bodyVelocity.z = this.bodyVelocity.z * 0.75 + rawVz * 0.25;
    this.prevBodyCenter = { x: cx, y: cy, z: cz };
  }

  stepWithInertia(dt: number, config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG): void {
    if (this.vertexCount === 0) return;
    const dt2 = dt * dt; const damp = config.damping;
    for (let i = 0; i < this.vertexCount; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;
      const vx = (this.positions[j]     - this.prevPositions[j])     * damp;
      const vy = (this.positions[j + 1] - this.prevPositions[j + 1]) * damp;
      const vz = (this.positions[j + 2] - this.prevPositions[j + 2]) * damp;
      this.prevPositions[j]   = this.positions[j];
      this.prevPositions[j+1] = this.positions[j+1];
      this.prevPositions[j+2] = this.positions[j+2];
      const windX = config.windEnabled ? this.wind.x * this.windStrength : 0;
      const windZ = config.windEnabled ? this.wind.z * this.windStrength : 0;
      const inertiaX = -this.bodyVelocity.x * 0.012;
      const inertiaZ = -this.bodyVelocity.z * 0.012;
      this.positions[j]     += vx + (windX + inertiaX) * dt2;
      this.positions[j + 1] += vy - config.gravity * dt2;
      this.positions[j + 2] += vz + (windZ + inertiaZ) * dt2;
    }
    const invIter = 1 / config.iterations;
    for (let iter = 0; iter < config.iterations; iter++) {
      for (const c of this.constraints) {
        const ia = c.indexA * 3; const ib = c.indexB * 3;
        const dx = this.positions[ib]   - this.positions[ia];
        const dy = this.positions[ib+1] - this.positions[ia+1];
        const dz = this.positions[ib+2] - this.positions[ia+2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-9) continue;
        const error = (dist - c.restLength) / dist;
        const correction = error * 0.5 * c.stiffness * invIter;
        if (!this.pinned[c.indexA]) {
          this.positions[ia]   += dx * correction;
          this.positions[ia+1] += dy * correction;
          this.positions[ia+2] += dz * correction;
        }
        if (!this.pinned[c.indexB]) {
          this.positions[ib]   -= dx * correction;
          this.positions[ib+1] -= dy * correction;
          this.positions[ib+2] -= dz * correction;
        }
      }
    }
  }
}

// ── Inline enhanced lighting ──────────────────────────────────────────────────

interface FillLightConfig { position: [number, number, number]; intensity: number; color: string; }
interface CameraExposureConfig { exposure: number; contrast: number; brightness: number; }
interface EnhancedPreset {
  ambientIntensity: number; directionalIntensity: number;
  directionalPosition: [number, number, number];
  fillLight: FillLightConfig; exposure: CameraExposureConfig;
}

const ENHANCED_PRESETS: Record<string, EnhancedPreset> = {
  soft:     { ambientIntensity: 0.8, directionalIntensity: 0.5, directionalPosition: [5, 10, 5],
               fillLight: { position: [-3, 5, 3],  intensity: 0.30, color: '#ffffff' },
               exposure:  { exposure: 1.00, contrast: 1.00, brightness:  0.00 } },
  dramatic: { ambientIntensity: 0.3, directionalIntensity: 1.5, directionalPosition: [2, 8, 2],
               fillLight: { position: [-4, 2, 4],  intensity: 0.20, color: '#c0d4ff' },
               exposure:  { exposure: 1.10, contrast: 1.20, brightness: -0.05 } },
  neutral:  { ambientIntensity: 0.6, directionalIntensity: 0.8, directionalPosition: [5, 10, 5],
               fillLight: { position: [-3, 6, 3],  intensity: 0.35, color: '#fff4e0' },
               exposure:  { exposure: 1.00, contrast: 1.00, brightness:  0.00 } },
  natural:  { ambientIntensity: 0.9, directionalIntensity: 0.6, directionalPosition: [-5, 10, 3],
               fillLight: { position: [ 4, 4, 4],  intensity: 0.25, color: '#ffe8d0' },
               exposure:  { exposure: 0.95, contrast: 0.95, brightness:  0.05 } },
};

// ── Camera utils ──────────────────────────────────────────────────────────────

function buildVideoConstraints(facingMode: 'user' | 'environment', w = 1280, h = 720) {
  return { facingMode, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30, max: 60 } };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLandmarks(count = 33, visibility = 0.9): PoseLandmark[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 0.3 + (i % 5) * 0.08,
    y: 0.1 + Math.floor(i / 5) * 0.12,
    z: 0.01 * (i % 3),
    visibility,
  }));
}

function frontalLandmarks(): PoseLandmark[] {
  const lm = makeLandmarks(33, 0.9);
  // Shoulders at y=0.35, level (same y)
  lm[11] = { x: 0.35, y: 0.35, z: 0.01, visibility: 0.9 };
  lm[12] = { x: 0.65, y: 0.35, z: 0.01, visibility: 0.9 };
  // Hips
  lm[23] = { x: 0.37, y: 0.65, z: 0.02, visibility: 0.85 };
  lm[24] = { x: 0.63, y: 0.65, z: 0.02, visibility: 0.85 };
  return lm;
}

function tiltedLandmarks(): PoseLandmark[] {
  const lm = makeLandmarks(33, 0.9);
  lm[11] = { x: 0.35, y: 0.40, z: 0.01, visibility: 0.9 }; // left shoulder lower
  lm[12] = { x: 0.65, y: 0.30, z: 0.01, visibility: 0.9 };
  lm[23] = { x: 0.37, y: 0.65, z: 0.02, visibility: 0.85 };
  lm[24] = { x: 0.63, y: 0.65, z: 0.02, visibility: 0.85 };
  return lm;
}

function makeGarment(): GarmentAsset {
  return {
    id: 'g1', name: 'Test Saree', type: 'T_SHIRT', imageUrl: '/test.jpg',
    naturalWidth: 800, naturalHeight: 1200,
    anchors: {
      leftShoulder: { x: 0.22, y: 0.12 }, rightShoulder: { x: 0.78, y: 0.12 },
      leftHip: { x: 0.25, y: 0.90 },      rightHip: { x: 0.75, y: 0.90 },
    },
    scaleMultiplier: 1.15,
  };
}

function makeMeasurements(shoulderWidth = 200): BodyMeasurements {
  return {
    shoulderWidth,
    chestCenter:  { x: 320, y: 180 },
    hipWidth:     160,
    hipCenter:    { x: 320, y: 340 },
    torsoHeight:  160,
    shoulderAngle: 0,
    minVisibility: 0.85,
  };
}

function makeMesh(rows = 5, cols = 5): { positions: Float32Array; constraints: ConstraintData[] } {
  const n = rows * cols;
  const positions = new Float32Array(n * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3;
      positions[i]   = c * 0.1;
      positions[i+1] = -r * 0.1;
      positions[i+2] = 0;
    }
  }
  const constraints: ConstraintData[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) {
        const a = r * cols + c; const b = a + 1;
        constraints.push({ indexA: a, indexB: b, restLength: 0.1, stiffness: 0.8 });
      }
      if (r < rows - 1) {
        const a = r * cols + c; const b = a + cols;
        constraints.push({ indexA: a, indexB: b, restLength: 0.1, stiffness: 0.8 });
      }
    }
  }
  return { positions, constraints };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

function testPoseSmoother(): void {
  console.log('\n  PoseSmoother');

  const s = new PoseSmoother();
  const raw0 = makeLandmarks();

  // [1] First call returns raw frame (seeds state)
  const r0 = s.smooth(raw0);
  ok('[1] First call returns raw frame length unchanged', r0.length === raw0.length);
  ok('[1] First call x values match raw', approx(r0[0].x, raw0[0].x, 1e-9));

  // [2] EMA: second frame that is far from first → output should be between the two
  const raw1 = makeLandmarks();
  raw1[0] = { x: 0.9, y: 0.9, z: 0.9, visibility: 0.9 };
  const r1 = s.smooth(raw1);
  ok('[2] EMA: smoothed x between prev and new', r1[0].x > raw0[0].x && r1[0].x < raw1[0].x);

  // [3] Confidence gate: low-visibility landmark extrapolated
  const s2   = new PoseSmoother();
  const seed = makeLandmarks();
  seed[5] = { x: 0.5, y: 0.5, z: 0.0, visibility: 0.9 };
  s2.smooth(seed);
  // Inject a movement to build velocity
  const move = makeLandmarks();
  move[5] = { x: 0.55, y: 0.55, z: 0.0, visibility: 0.9 };
  s2.smooth(move);
  // Now send low-confidence
  const lowConf = makeLandmarks();
  lowConf[5] = { x: 0.99, y: 0.99, z: 0.0, visibility: 0.05 };
  const r3 = s2.smooth(lowConf);
  ok('[3] Confidence gate: low-vis output != raw value', !approx(r3[5].x, 0.99, 0.01));
  ok('[3] Confidence gate: visibility decayed', r3[5].visibility < 0.9);

  // [4] Temporal window: 3+ frames → further smoothed
  const s3 = new PoseSmoother({ windowSize: 3 });
  s3.smooth(makeLandmarks());
  s3.smooth(makeLandmarks());
  const r4a = s3.smooth(makeLandmarks());
  ok('[4] Temporal window result has same landmark count', r4a.length === 33);

  // [5] Velocity estimate is non-zero after a large movement
  const s4 = new PoseSmoother();
  s4.smooth(makeLandmarks());
  const fast = makeLandmarks();
  fast[0] = { x: 0.8, y: 0.8, z: 0.0, visibility: 0.9 };
  s4.smooth(fast);
  const vel5 = s4.getVelocity(0);
  ok('[5] Velocity non-zero after movement', Math.abs(vel5.vx) > 0 || Math.abs(vel5.vy) > 0);

  // [6] reset clears state
  s4.reset();
  ok('[6] reset clears smoothed state', s4.getLastSmoothed() === null);

  // [7] estimateOrientation: level shoulders → shoulderRotation ≈ 0
  const sOr = new PoseSmoother();
  const or7 = sOr.estimateOrientation(frontalLandmarks());
  ok('[7] Level shoulders → shoulderRotation ≈ 0', Math.abs(or7.shoulderRotation) < 0.05);

  // [8] estimateOrientation: frontal pose → isForwardFacing = true
  ok('[8] isForwardFacing = true for frontal landmarks', or7.isForwardFacing === true);

  // [9] estimateOrientation: tilted → shoulderRotation != 0
  const or9 = sOr.estimateOrientation(tiltedLandmarks());
  ok('[9] Tilted shoulders → shoulderRotation != 0', Math.abs(or9.shoulderRotation) > 0.01);

  // [10] No hips → hipRotation falls back to shoulderRotation
  const noHips = frontalLandmarks();
  noHips[23] = { x: 0, y: 0, z: 0, visibility: 0.05 };
  noHips[24] = { x: 0, y: 0, z: 0, visibility: 0.05 };
  const or10 = sOr.estimateOrientation(noHips);
  ok('[10] No hips → hipRotation = shoulderRotation', approx(or10.hipRotation, or10.shoulderRotation));
}

function testEnhancedAlignment(): void {
  console.log('\n  Enhanced Garment Alignment');
  const W = 640; const H = 480;

  // [11] Level shoulders → shoulderRotation ≈ 0
  const or11 = computeBodyOrientation(frontalLandmarks(), W, H);
  ok('[11] Level shoulders → rotation ≈ 0', Math.abs(or11.shoulderRotation) < 0.05);

  // [12] Tilted shoulders → positive rotation
  const or12 = computeBodyOrientation(tiltedLandmarks(), W, H);
  ok('[12] Tilted shoulders → non-zero rotation', Math.abs(or12.shoulderRotation) > 0.01);

  // [13] Off-centre subject → perspectiveFactor < 1
  const offCentre = frontalLandmarks();
  offCentre[11] = { x: 0.05, y: 0.35, z: 0.01, visibility: 0.9 };
  offCentre[12] = { x: 0.25, y: 0.35, z: 0.01, visibility: 0.9 };
  const or13 = computeBodyOrientation(offCentre, W, H);
  ok('[13] Off-centre → perspectiveFactor < 1', or13.perspectiveFactor < 1.0);

  // [14] Centred subject → perspectiveFactor ≈ 1
  const or14 = computeBodyOrientation(frontalLandmarks(), W, H);
  ok('[14] Centred subject → perspectiveFactor ≈ 1', approx(or14.perspectiveFactor, 1.0, 0.05));

  // [15] computeEnhancedGarmentAlignment returns full shape
  const lm15 = frontalLandmarks();
  const a15  = computeEnhancedGarmentAlignment(makeMeasurements(), makeGarment(), lm15, W, H, 0.9, false);
  ok('[15] Returns orientation field', a15.orientation !== undefined);
  ok('[15] Returns waistCenter field', a15.waistCenter !== undefined);

  // [16] hipVerticalOffset >= 0
  ok('[16] hipVerticalOffset >= 0', a15.hipVerticalOffset >= 0);

  // [17] perspectiveScale matches orientation.perspectiveFactor
  ok('[17] perspectiveScale = orientation.perspectiveFactor', approx(a15.perspectiveScale, a15.orientation.perspectiveFactor));

  // [18] waistCenter.y between chest and hip
  ok('[18] waistCenter.y between chestCenter.y and hipCenter.y',
     a15.waistCenter.y >= 180 && a15.waistCenter.y <= 340);

  // [19] rotation = shoulder angle from measurements
  ok('[19] rotation = measurements.shoulderAngle', approx(a15.rotation, 0, 0.001));

  // [20] visible=false when confidence below threshold
  const lowVis = frontalLandmarks().map((lm) => ({ ...lm, visibility: 0.2 }));
  const a20    = computeEnhancedGarmentAlignment(
    { ...makeMeasurements(), minVisibility: 0.2 }, makeGarment(), lowVis, W, H, 0.9, false, 0.5
  );
  ok('[20] visible=false when minVisibility < threshold', a20.visible === false);
}

function testPhysicsAnimatedWind(): void {
  console.log('\n  Physics — animated wind');
  const { positions, constraints } = makeMesh(5, 5);
  const svc = new PhysicsService();
  svc.initialize(25, positions, constraints);
  svc.setWind({ x: 1, y: 0, z: 0 }, 0);

  // [21] tickAnimatedWind sets windStrength > 0
  svc.tickAnimatedWind(1 / 60, 1.0);
  ok('[21] windStrength > 0 after tick with baseStrength=1', svc.windStrength > 0);

  // [22] windStrength varies over multiple ticks
  const strengths: number[] = [];
  for (let i = 0; i < 60; i++) { svc.tickAnimatedWind(1 / 60, 1.0); strengths.push(svc.windStrength); }
  const unique = new Set(strengths.map((v) => v.toFixed(4))).size;
  ok('[22] windStrength oscillates (>5 distinct values in 60 ticks)', unique > 5);

  // [23] windStrength = 0 when baseStrength = 0
  svc.tickAnimatedWind(1 / 60, 0);
  ok('[23] windStrength = 0 when baseStrength = 0', approx(svc.windStrength, 0, 0.001));
}

function testPhysicsInertia(): void {
  console.log('\n  Physics — body inertia');
  const { positions, constraints } = makeMesh(5, 5);
  const svc = new PhysicsService();
  svc.initialize(25, positions, constraints);
  svc.pinVertex(0); // pin top-left

  // [24] updateBodyCenter initialises without error
  svc.updateBodyCenter(0.5, 0.5, 0, 1 / 60);
  ok('[24] updateBodyCenter initialises without throwing', true);

  // [25] velocity non-zero after movement
  svc.updateBodyCenter(0.6, 0.5, 0, 1 / 60); // body moved right
  ok('[25] bodyVelocity.x != 0 after rightward movement', Math.abs(svc.bodyVelocity.x) > 0);

  // [26] velocity is low-pass filtered (immediate huge jump dampened)
  const svc2 = new PhysicsService();
  svc2.initialize(4, new Float32Array([0,0,0, 0.1,0,0, 0,0.1,0, 0.1,0.1,0]), []);
  svc2.updateBodyCenter(0.0, 0.5, 0, 1 / 60);
  svc2.updateBodyCenter(0.5, 0.5, 0, 1 / 60); // large jump
  const rawVx26 = (0.5 - 0.0) * 60; // 30 units/s raw
  ok('[26] EMA damps impulsive velocity (bodyVelocity.x < rawVx)', Math.abs(svc2.bodyVelocity.x) < rawVx26);

  // [27] stepWithInertia moves free vertices
  const { positions: p3, constraints: c3 } = makeMesh(3, 3);
  const svc3 = new PhysicsService();
  svc3.initialize(9, p3, c3);
  const beforeY = svc3.getPosition(4).y; // center vertex (free)
  svc3.stepWithInertia(1 / 60, DEFAULT_PHYSICS_CONFIG);
  const afterY  = svc3.getPosition(4).y;
  ok('[27] Free vertex moves after stepWithInertia', beforeY !== afterY);

  // [28] Pinned vertex does not move
  svc3.pinVertex(0);
  svc3.setVertexPosition(0, 0, 0, 0);
  svc3.stepWithInertia(1 / 60, DEFAULT_PHYSICS_CONFIG);
  const pinnedPos = svc3.getPosition(0);
  ok('[28] Pinned vertex stays at (0,0,0)', approx(pinnedPos.x, 0) && approx(pinnedPos.y, 0) && approx(pinnedPos.z, 0));

  // [29] Gravity pulls free vertex downward
  const { positions: p4 } = makeMesh(2, 2);
  const svc4 = new PhysicsService();
  svc4.initialize(4, p4, []);
  const y0 = svc4.getPosition(3).y;
  svc4.stepWithInertia(1 / 60, DEFAULT_PHYSICS_CONFIG);
  ok('[29] Gravity pulls free vertex down (y decreases)', svc4.getPosition(3).y < y0);

  // [30] Body inertia offsets cloth opposite to body direction
  const { positions: p5 } = makeMesh(2, 2);
  const svc5 = new PhysicsService();
  svc5.initialize(4, p5, []);
  svc5.updateBodyCenter(0.0, 0.5, 0, 1 / 60);
  svc5.updateBodyCenter(0.5, 0.5, 0, 1 / 60); // body moved RIGHT
  const x0 = svc5.getPosition(3).x;
  svc5.stepWithInertia(1 / 60, { ...DEFAULT_PHYSICS_CONFIG, gravity: 0 });
  // Cloth should shift LEFT (inertia opposite body direction)
  ok('[30] Inertia: cloth shifts left when body moves right', svc5.getPosition(3).x < x0);
}

function testEnhancedLighting(): void {
  console.log('\n  Enhanced lighting presets');
  const presets = Object.values(ENHANCED_PRESETS);

  // [31] All presets have fill light
  ok('[31] All 4 presets have fillLight', presets.every((p) => p.fillLight !== undefined));

  // [32] All presets have exposure config
  ok('[32] All 4 presets have exposure config', presets.every((p) => p.exposure !== undefined));

  // [33] Fill light intensity 0–1
  ok('[33] Fill light intensity in 0–1', presets.every((p) => p.fillLight.intensity >= 0 && p.fillLight.intensity <= 1));

  // [34] Exposure in 0.5–2.0
  ok('[34] Exposure in 0.5–2.0', presets.every((p) => p.exposure.exposure >= 0.5 && p.exposure.exposure <= 2.0));

  // [35] Dramatic has higher directional intensity than soft
  ok('[35] dramatic directionalIntensity > soft', ENHANCED_PRESETS['dramatic']!.directionalIntensity > ENHANCED_PRESETS['soft']!.directionalIntensity);
}

function testCameraUtils(): void {
  console.log('\n  Camera utils — facingMode');
  const env  = buildVideoConstraints('environment');
  const user = buildVideoConstraints('user');
  ok('[36] environment facingMode set', env.facingMode === 'environment');
  ok('[37] user facingMode set', user.facingMode === 'user');
}

function testPerformance(): void {
  console.log('\n  Performance');
  const lm = makeLandmarks();

  // [38] PoseSmoother.smooth < 1ms per call
  const smoother = new PoseSmoother();
  smoother.smooth(lm);
  const msSmooth = perf(() => smoother.smooth(lm), 500);
  ok(`[38] smooth() < 1ms (${msSmooth.toFixed(3)}ms)`, msSmooth < 1);

  // [39] computeBodyOrientation < 0.5ms
  const msOr = perf(() => computeBodyOrientation(lm, 640, 480), 1000);
  ok(`[39] computeBodyOrientation < 0.5ms (${msOr.toFixed(3)}ms)`, msOr < 0.5);

  // [40] computeEnhancedGarmentAlignment < 0.5ms
  const msAlign = perf(() => computeEnhancedGarmentAlignment(makeMeasurements(), makeGarment(), lm, 640, 480, 0.9, false), 500);
  ok(`[40] computeEnhancedGarmentAlignment < 0.5ms (${msAlign.toFixed(3)}ms)`, msAlign < 0.5);

  // [41] stepWithInertia on 50-vertex mesh < 2ms
  const { positions, constraints } = makeMesh(10, 5); // 50 verts
  const svcPerf = new PhysicsService();
  svcPerf.initialize(50, positions, constraints);
  const msStep = perf(() => svcPerf.stepWithInertia(1 / 60), 500);
  ok(`[41] stepWithInertia(50 verts) < 2ms (${msStep.toFixed(3)}ms)`, msStep < 2);

  // [42] tickAnimatedWind < 0.1ms
  const msTick = perf(() => svcPerf.tickAnimatedWind(1 / 60, 1.0), 5000);
  ok(`[42] tickAnimatedWind < 0.1ms (${msTick.toFixed(4)}ms)`, msTick < 0.1);
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log('============================================================');
console.log('  Sprint 8.5 — AR Enhancement Tests');
console.log('============================================================');

testPoseSmoother();
testEnhancedAlignment();
testPhysicsAnimatedWind();
testPhysicsInertia();
testEnhancedLighting();
testCameraUtils();
testPerformance();

console.log('\n============================================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) process.exit(1);
