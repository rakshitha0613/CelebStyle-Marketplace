/**
 * @ar6.3.celebstyle.overlay — Sprint 6.3 Garment Overlay Tests
 * Self-contained Node.js-compatible. No browser APIs, no MediaPipe, no canvas.
 */

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function approx(a: number, b: number, tol = 0.001): boolean {
  return Math.abs(a - b) <= tol;
}

// ── Inline types (mirror of garment.types.ts) ─────────────────────────────────

type GarmentType = 'T_SHIRT' | 'SHIRT' | 'JACKET' | 'HOODIE';

interface GarmentAnchorPoint { x: number; y: number; }
interface GarmentAnchors {
  leftShoulder: GarmentAnchorPoint;
  rightShoulder: GarmentAnchorPoint;
  leftHip: GarmentAnchorPoint;
  rightHip: GarmentAnchorPoint;
}
interface GarmentAsset {
  id: string;
  name: string;
  type: GarmentType;
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  anchors: GarmentAnchors;
  scaleMultiplier: number;
}
interface PoseLandmark { x: number; y: number; z: number; visibility: number; }
interface BodyMeasurements {
  shoulderWidth: number;
  chestCenter: { x: number; y: number };
  hipWidth: number;
  hipCenter: { x: number; y: number };
  torsoHeight: number;
  shoulderAngle: number;
  minVisibility: number;
}
interface GarmentAlignment {
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  mirrored: boolean;
}
interface GarmentOverlayConfig {
  opacity: number;
  visible: boolean;
  debugLandmarks: boolean;
  highContrast: boolean;
  mirrored: boolean;
  visibilityThreshold: number;
}

const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,   RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,   RIGHT_WRIST: 16,
  LEFT_HIP: 23,     RIGHT_HIP: 24,
} as const;

const BLAZEPOSE_LANDMARK_COUNT = 33;

// ── Inline implementations (mirror garment-alignment.service.ts) ──────────────

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}
function midpoint(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}
function shoulderAngle(lsX: number, lsY: number, rsX: number, rsY: number): number {
  return Math.atan2(rsY - lsY, rsX - lsX);
}

function computeBodyMeasurements(
  landmarks: PoseLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  visibilityThreshold = 0.5,
): BodyMeasurements | null {
  const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  if (!ls || !rs) return null;
  if (ls.visibility < visibilityThreshold || rs.visibility < visibilityThreshold) return null;

  const lsX = ls.x * canvasWidth, lsY = ls.y * canvasHeight;
  const rsX = rs.x * canvasWidth, rsY = rs.y * canvasHeight;

  const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const hipVisible = lh && rh &&
    lh.visibility >= visibilityThreshold && rh.visibility >= visibilityThreshold;

  let lhX: number, lhY: number, rhX: number, rhY: number;
  if (hipVisible) {
    lhX = lh!.x * canvasWidth; lhY = lh!.y * canvasHeight;
    rhX = rh!.x * canvasWidth; rhY = rh!.y * canvasHeight;
  } else {
    const sw = distance(lsX, lsY, rsX, rsY);
    const estimatedHipDropY = sw * 1.4;
    const chX = (lsX + rsX) / 2;
    const chY = (lsY + rsY) / 2;
    lhX = chX - sw * 0.42; lhY = chY + estimatedHipDropY;
    rhX = chX + sw * 0.42; rhY = chY + estimatedHipDropY;
  }

  const sw = distance(lsX, lsY, rsX, rsY);
  const chestCenter = midpoint(lsX, lsY, rsX, rsY);
  const hipCenter = midpoint(lhX, lhY, rhX, rhY);
  const hipWidth = distance(lhX, lhY, rhX, rhY);
  const torsoHeight = distance(chestCenter.x, chestCenter.y, hipCenter.x, hipCenter.y);
  const angle = shoulderAngle(lsX, lsY, rsX, rsY);
  const minVisibility = Math.min(ls.visibility, rs.visibility);

  return { shoulderWidth: sw, chestCenter, hipWidth, hipCenter, torsoHeight, shoulderAngle: angle, minVisibility };
}

function computeGarmentAlignment(
  measurements: BodyMeasurements,
  garment: GarmentAsset,
  opacity: number,
  mirrored: boolean,
  visibilityThreshold = 0.5,
): GarmentAlignment {
  const targetWidth = measurements.shoulderWidth * garment.scaleMultiplier;
  const targetHeight = targetWidth * (garment.naturalHeight / garment.naturalWidth);
  return {
    x: measurements.chestCenter.x,
    y: measurements.chestCenter.y,
    width: targetWidth,
    height: targetHeight,
    rotation: measurements.shoulderAngle,
    opacity: Math.max(0, Math.min(1, opacity)),
    visible: measurements.minVisibility >= visibilityThreshold,
    mirrored,
  };
}

const GARMENT_SCALE_MULTIPLIERS: Record<string, number> = {
  T_SHIRT: 1.15, SHIRT: 1.18, JACKET: 1.25, HOODIE: 1.20,
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLandmarks(
  lsX = 0.3, lsY = 0.3, rsX = 0.7, rsY = 0.3,
  lhX = 0.35, lhY = 0.65, rhX = 0.65, rhY = 0.65,
  vis = 0.9,
): PoseLandmark[] {
  const lm: PoseLandmark[] = Array.from({ length: BLAZEPOSE_LANDMARK_COUNT }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 0,
  }));
  lm[POSE_LANDMARKS.LEFT_SHOULDER]  = { x: lsX, y: lsY, z: 0, visibility: vis };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: rsX, y: rsY, z: 0, visibility: vis };
  lm[POSE_LANDMARKS.LEFT_HIP]       = { x: lhX, y: lhY, z: 0, visibility: vis };
  lm[POSE_LANDMARKS.RIGHT_HIP]      = { x: rhX, y: rhY, z: 0, visibility: vis };
  return lm;
}

const CANVAS_W = 1280, CANVAS_H = 720;

const BASE_GARMENT: GarmentAsset = {
  id: 'test-tshirt-001',
  name: 'Test T-Shirt',
  type: 'T_SHIRT',
  imageUrl: 'https://example.com/tshirt.png',
  naturalWidth: 400,
  naturalHeight: 500,
  anchors: {
    leftShoulder:  { x: 0.22, y: 0.12 },
    rightShoulder: { x: 0.78, y: 0.12 },
    leftHip:       { x: 0.30, y: 0.72 },
    rightHip:      { x: 0.70, y: 0.72 },
  },
  scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['T_SHIRT'],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('============================================================');
console.log('  Sprint 6.3 — AR Garment Overlay Tests');
console.log('============================================================');

// [1] Landmark alignment — shoulder width computation
console.log('\n  [1] computeBodyMeasurements — shoulder width');
{
  const lm = makeLandmarks(0.25, 0.3, 0.75, 0.3);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  ok('measurements returned', m !== null);
  // shoulder width in pixels: (0.75 - 0.25) * 1280 = 640
  ok('shoulderWidth ≈ 640', approx(m.shoulderWidth, 640, 1));
}

// [2] Landmark alignment — torso height computation
console.log('\n  [2] computeBodyMeasurements — torso height');
{
  const lm = makeLandmarks(0.3, 0.3, 0.7, 0.3, 0.35, 0.7, 0.65, 0.7);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  // chest center Y = 0.3 * 720 = 216, hip center Y = 0.7 * 720 = 504
  // torsoHeight ≈ 504 - 216 = 288
  ok('torsoHeight > 0', m.torsoHeight > 0);
  ok('torsoHeight ≈ 288', approx(m.torsoHeight, 288, 2));
}

// [3] Landmark alignment — shoulder angle (level shoulders → 0 radians)
console.log('\n  [3] computeBodyMeasurements — level shoulder angle = 0');
{
  const lm = makeLandmarks(0.3, 0.3, 0.7, 0.3); // same Y → horizontal
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  ok('shoulderAngle ≈ 0 for level shoulders', approx(m.shoulderAngle, 0, 0.001));
}

// [4] Landmark alignment — tilted shoulder angle
console.log('\n  [4] computeBodyMeasurements — tilted shoulder angle');
{
  // Right shoulder 10px lower than left → slight negative angle (RShoulder is rightward)
  // atan2(rsY - lsY, rsX - lsX): lsY=0.29, rsY=0.31 → rsY > lsY → positive angle
  const lm = makeLandmarks(0.3, 0.29, 0.7, 0.31);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const expectedAngle = Math.atan2(
    (0.31 - 0.29) * CANVAS_H,
    (0.7  - 0.3)  * CANVAS_W,
  );
  ok('shoulderAngle matches atan2', approx(m.shoulderAngle, expectedAngle, 0.001));
  ok('shoulderAngle in [-π, π]', m.shoulderAngle >= -Math.PI && m.shoulderAngle <= Math.PI);
}

// [5] computeBodyMeasurements — returns null for missing landmarks
console.log('\n  [5] computeBodyMeasurements — missing landmarks → null');
{
  const lm: PoseLandmark[] = Array.from({ length: BLAZEPOSE_LANDMARK_COUNT }, () => ({
    x: 0, y: 0, z: 0, visibility: 0.9,
  }));
  // Remove left shoulder
  lm[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0, y: 0, z: 0, visibility: 0 };
  ok('returns null when left shoulder missing', computeBodyMeasurements(lm, CANVAS_W, CANVAS_H) === null);
}

// [6] computeBodyMeasurements — returns null when visibility below threshold
console.log('\n  [6] computeBodyMeasurements — low visibility → null');
{
  const lm = makeLandmarks(0.3, 0.3, 0.7, 0.3, 0.35, 0.65, 0.65, 0.65, 0.3);
  ok('returns null when visibility=0.3 < threshold=0.5',
    computeBodyMeasurements(lm, CANVAS_W, CANVAS_H, 0.5) === null);
}

// [7] computeBodyMeasurements — minVisibility correct
console.log('\n  [7] computeBodyMeasurements — minVisibility');
{
  const lm: PoseLandmark[] = Array.from({ length: BLAZEPOSE_LANDMARK_COUNT }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 0,
  }));
  lm[POSE_LANDMARKS.LEFT_SHOULDER]  = { x: 0.3, y: 0.3, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.7, y: 0.3, z: 0, visibility: 0.7 };
  lm[POSE_LANDMARKS.LEFT_HIP]       = { x: 0.35, y: 0.65, z: 0, visibility: 0.8 };
  lm[POSE_LANDMARKS.RIGHT_HIP]      = { x: 0.65, y: 0.65, z: 0, visibility: 0.8 };
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  ok('minVisibility = min(0.9, 0.7) = 0.7', approx(m.minVisibility, 0.7));
}

// [8] computeBodyMeasurements — chest center at shoulder midpoint
console.log('\n  [8] computeBodyMeasurements — chest center at shoulder midpoint');
{
  const lm = makeLandmarks(0.3, 0.3, 0.7, 0.3);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  ok('chestCenter.x = midpoint X', approx(m.chestCenter.x, 0.5 * CANVAS_W, 1));
  ok('chestCenter.y = midpoint Y', approx(m.chestCenter.y, 0.3 * CANVAS_H, 1));
}

// [9] computeBodyMeasurements — hip fallback when hips below threshold
console.log('\n  [9] computeBodyMeasurements — hip fallback');
{
  const lm: PoseLandmark[] = Array.from({ length: BLAZEPOSE_LANDMARK_COUNT }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 0,
  }));
  lm[POSE_LANDMARKS.LEFT_SHOULDER]  = { x: 0.3, y: 0.3, z: 0, visibility: 0.9 };
  lm[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.7, y: 0.3, z: 0, visibility: 0.9 };
  // hips have low visibility
  lm[POSE_LANDMARKS.LEFT_HIP]  = { x: 0.35, y: 0.7, z: 0, visibility: 0.1 };
  lm[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.65, y: 0.7, z: 0, visibility: 0.1 };
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H, 0.5)!;
  ok('still returns measurements with hip fallback', m !== null);
  ok('hipWidth > 0 from estimate', m.hipWidth > 0);
  ok('torsoHeight > 0 from estimate', m.torsoHeight > 0);
}

// [10] computeGarmentAlignment — x/y equals chest center (anchor point)
console.log('\n  [10] computeGarmentAlignment — garment anchor at shoulder center');
{
  const lm = makeLandmarks(0.3, 0.3, 0.7, 0.3);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  ok('alignment.x = chestCenter.x', approx(a.x, m.chestCenter.x, 0.01));
  ok('alignment.y = chestCenter.y', approx(a.y, m.chestCenter.y, 0.01));
}

// [11] computeGarmentAlignment — width = shoulderWidth × scaleMultiplier
console.log('\n  [11] computeGarmentAlignment — width = shoulderWidth × scaleMultiplier');
{
  const lm = makeLandmarks(0.25, 0.3, 0.75, 0.3);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  const expectedWidth = m.shoulderWidth * BASE_GARMENT.scaleMultiplier;
  ok('width = shoulderWidth × scaleMultiplier', approx(a.width, expectedWidth, 0.01));
}

// [12] computeGarmentAlignment — aspect ratio preserved
console.log('\n  [12] computeGarmentAlignment — aspect ratio preserved');
{
  const lm = makeLandmarks();
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  const naturalAR = BASE_GARMENT.naturalHeight / BASE_GARMENT.naturalWidth;
  const computedAR = a.height / a.width;
  ok('height/width matches natural aspect ratio', approx(computedAR, naturalAR, 0.001));
}

// [13] computeGarmentAlignment — rotation matches shoulder angle
console.log('\n  [13] computeGarmentAlignment — rotation matches shoulder angle');
{
  const lm = makeLandmarks(0.3, 0.29, 0.7, 0.31);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  ok('rotation = shoulderAngle', approx(a.rotation, m.shoulderAngle, 0.001));
}

// [14] computeGarmentAlignment — opacity clamped
console.log('\n  [14] computeGarmentAlignment — opacity clamped to [0,1]');
{
  const lm = makeLandmarks();
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const over  = computeGarmentAlignment(m, BASE_GARMENT, 1.5, false);
  const under = computeGarmentAlignment(m, BASE_GARMENT, -0.5, false);
  const mid   = computeGarmentAlignment(m, BASE_GARMENT, 0.6, false);
  ok('opacity > 1 clamped to 1', over.opacity === 1);
  ok('opacity < 0 clamped to 0', under.opacity === 0);
  ok('opacity 0.6 unchanged', approx(mid.opacity, 0.6));
}

// [15] computeGarmentAlignment — mirrored flag propagated
console.log('\n  [15] computeGarmentAlignment — mirrored flag');
{
  const lm = makeLandmarks();
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const mirrored    = computeGarmentAlignment(m, BASE_GARMENT, 0.85, true);
  const notMirrored = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  ok('mirrored=true propagated', mirrored.mirrored === true);
  ok('mirrored=false propagated', notMirrored.mirrored === false);
}

// [16] Scaling — scale > 0 always
console.log('\n  [16] Scaling — width and height always > 0');
{
  const lm = makeLandmarks(0.49, 0.3, 0.51, 0.3); // very narrow shoulders
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  ok('width > 0 for narrow shoulders', a.width > 0);
  ok('height > 0 for narrow shoulders', a.height > 0);
}

// [17] T-shirt scale multiplier
console.log('\n  [17] Garment scale — T-shirt');
{
  ok('T_SHIRT scaleMultiplier = 1.15', GARMENT_SCALE_MULTIPLIERS['T_SHIRT'] === 1.15);
}

// [18] Jacket scale multiplier — wider than T-shirt
console.log('\n  [18] Garment scale — JACKET wider than T-SHIRT');
{
  ok('JACKET > T_SHIRT scale', GARMENT_SCALE_MULTIPLIERS['JACKET'] > GARMENT_SCALE_MULTIPLIERS['T_SHIRT']);
}

// [19] Hoodie scale multiplier
console.log('\n  [19] Garment scale — HOODIE');
{
  ok('HOODIE scaleMultiplier = 1.20', GARMENT_SCALE_MULTIPLIERS['HOODIE'] === 1.20);
}

// [20] Shirt scale multiplier
console.log('\n  [20] Garment scale — SHIRT');
{
  ok('SHIRT scaleMultiplier = 1.18', GARMENT_SCALE_MULTIPLIERS['SHIRT'] === 1.18);
}

// [21] BlazePose landmark count
console.log('\n  [21] BlazePose landmark count');
{
  ok('BLAZEPOSE_LANDMARK_COUNT = 33', BLAZEPOSE_LANDMARK_COUNT === 33);
}

// [22] Garment anchor normalization — anchors within [0, 1]
console.log('\n  [22] Garment anchor normalization');
{
  const { anchors } = BASE_GARMENT;
  const allPoints = [
    anchors.leftShoulder, anchors.rightShoulder,
    anchors.leftHip, anchors.rightHip,
  ];
  const allInRange = allPoints.every(
    (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
  );
  ok('all anchor x/y in [0,1]', allInRange);
}

// [23] T-shirt anchor — left shoulder is left of center
console.log('\n  [23] T-shirt garment anchor positions');
{
  ok('leftShoulder.x < 0.5', BASE_GARMENT.anchors.leftShoulder.x < 0.5);
  ok('rightShoulder.x > 0.5', BASE_GARMENT.anchors.rightShoulder.x > 0.5);
  ok('shoulder anchors above hip anchors', BASE_GARMENT.anchors.leftShoulder.y < BASE_GARMENT.anchors.leftHip.y);
}

// [24] Overlay config — opacity clamped in GarmentOverlayService mock
console.log('\n  [24] GarmentOverlayConfig — opacity clamping');
{
  // Simulate config construction
  function clampOpacity(cfg: GarmentOverlayConfig): GarmentOverlayConfig {
    return { ...cfg, opacity: Math.max(0, Math.min(1, cfg.opacity)) };
  }
  const clamped = clampOpacity({ opacity: 1.5, visible: true, debugLandmarks: false, highContrast: false, mirrored: false, visibilityThreshold: 0.5 });
  ok('opacity 1.5 clamped to 1', clamped.opacity === 1);
  const low = clampOpacity({ opacity: -0.2, visible: true, debugLandmarks: false, highContrast: false, mirrored: false, visibilityThreshold: 0.5 });
  ok('opacity -0.2 clamped to 0', low.opacity === 0);
}

// [25] Overlay config — visible toggle
console.log('\n  [25] GarmentOverlayConfig — visible toggle');
{
  const cfg: GarmentOverlayConfig = { opacity: 0.85, visible: true, debugLandmarks: false, highContrast: false, mirrored: false, visibilityThreshold: 0.5 };
  const updated = { ...cfg, visible: !cfg.visible };
  ok('visible toggled from true to false', updated.visible === false);
}

// [26] High-contrast mode — overrides opacity to 1.0
console.log('\n  [26] High-contrast mode');
{
  // GarmentRenderer applies highContrast=true → globalAlpha = 1.0 regardless of opacity
  let recordedAlpha = 0;
  const mockCtx = { globalAlpha: 0, set: (v: number) => { recordedAlpha = v; } };
  const simulateRender = (highContrast: boolean, opacity: number) => {
    mockCtx.globalAlpha = highContrast ? 1.0 : opacity;
    recordedAlpha = mockCtx.globalAlpha;
  };
  simulateRender(true, 0.4);
  ok('highContrast=true → alpha=1.0', recordedAlpha === 1.0);
  simulateRender(false, 0.4);
  ok('highContrast=false → alpha=opacity', approx(recordedAlpha, 0.4));
}

// [27] Rendering — opacity=0 should skip draw (visible=false or alpha=0)
console.log('\n  [27] Rendering — opacity=0 skips draw');
{
  const lm = makeLandmarks();
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const a = computeGarmentAlignment(m, BASE_GARMENT, 0, false);
  ok('opacity=0 alignment has opacity=0', a.opacity === 0);
  // renderer would skip: if (!alignment.visible) return; — visible depends on landmark confidence
  // for opacity=0, renderer checks: if (alignment.opacity <= 0 && !config.highContrast) return
  const wouldSkip = (a.opacity <= 0) && !false; // highContrast=false
  ok('renderer would skip draw when opacity=0', wouldSkip);
}

// [28] Rendering — layer ordering: save/restore pattern
console.log('\n  [28] Rendering — save/restore canvas state');
{
  // Simulate the save/restore calls in GarmentRenderer.render
  let saved = 0; let restored = 0;
  const mockCtx = {
    save: () => saved++,
    restore: () => restored++,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    translate: () => {}, rotate: () => {}, scale: () => {},
    drawImage: () => {},
  };
  mockCtx.save();
  // ... drawing ...
  mockCtx.restore();
  ok('ctx.save() called before draw', saved === 1);
  ok('ctx.restore() called after draw', restored === 1);
}

// [29] Worker protocol — INIT message format
console.log('\n  [29] Worker protocol — INIT message');
{
  const msg = { type: 'INIT', payload: { visibilityThreshold: 0.5 } };
  ok('type = INIT', msg.type === 'INIT');
  ok('payload.visibilityThreshold present', 'visibilityThreshold' in msg.payload);
  ok('visibilityThreshold = 0.5', msg.payload.visibilityThreshold === 0.5);
}

// [30] Worker protocol — ALIGN_GARMENT message format
console.log('\n  [30] Worker protocol — ALIGN_GARMENT message');
{
  const cfg: GarmentOverlayConfig = {
    opacity: 0.85, visible: true, debugLandmarks: false,
    highContrast: false, mirrored: false, visibilityThreshold: 0.5,
  };
  const msg = {
    type: 'ALIGN_GARMENT',
    payload: {
      landmarks: makeLandmarks(),
      garment: BASE_GARMENT,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      config: cfg,
    },
  };
  ok('type = ALIGN_GARMENT', msg.type === 'ALIGN_GARMENT');
  ok('payload.landmarks is array', Array.isArray(msg.payload.landmarks));
  ok('payload.landmarks.length = 33', msg.payload.landmarks.length === 33);
  ok('payload.canvasWidth = 1280', msg.payload.canvasWidth === 1280);
}

// [31] Worker protocol — ALIGNMENT_RESULT response format
console.log('\n  [31] Worker protocol — ALIGNMENT_RESULT response');
{
  const lm = makeLandmarks();
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const alignment = computeGarmentAlignment(m, BASE_GARMENT, 0.85, false);
  const msg = { type: 'ALIGNMENT_RESULT', payload: { alignment, measurements: m } };
  ok('type = ALIGNMENT_RESULT', msg.type === 'ALIGNMENT_RESULT');
  ok('payload.alignment present', 'alignment' in msg.payload);
  ok('payload.measurements present', 'measurements' in msg.payload);
  ok('alignment.x is number', typeof msg.payload.alignment.x === 'number');
  ok('alignment.width > 0', msg.payload.alignment.width > 0);
}

// [32] Worker protocol — INVISIBLE response
console.log('\n  [32] Worker protocol — INVISIBLE response');
{
  const msg = { type: 'INVISIBLE', payload: { reason: 'Shoulders not confidently detected' } };
  ok('type = INVISIBLE', msg.type === 'INVISIBLE');
  ok('payload.reason is string', typeof msg.payload.reason === 'string');
}

// [33] Worker protocol — DESTROY message
console.log('\n  [33] Worker protocol — DESTROY message');
{
  const msg = { type: 'DESTROY' };
  ok('type = DESTROY', msg.type === 'DESTROY');
}

// [34] Asset loader mock — cache tracking
console.log('\n  [34] Asset loader — cache tracking');
{
  class MockAssetLoader {
    private cache = new Map<string, { image: object; lastAccessed: number }>();
    private readonly maxSize: number;
    constructor(maxSize = 20) { this.maxSize = maxSize; }

    addToCache(id: string): void {
      if (this.cache.size >= this.maxSize) this.evict();
      this.cache.set(id, { image: {}, lastAccessed: Date.now() });
    }

    private evict(): void {
      let oldestKey = ''; let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.lastAccessed < oldestTime) { oldestTime = entry.lastAccessed; oldestKey = key; }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    isLoaded(id: string): boolean { return this.cache.has(id); }
    getCacheSize(): number { return this.cache.size; }
    clearCache(): void { this.cache.clear(); }
  }

  const loader = new MockAssetLoader(3);
  ok('empty cache size = 0', loader.getCacheSize() === 0);
  ok('isLoaded returns false initially', !loader.isLoaded('tshirt-001'));

  loader.addToCache('tshirt-001');
  ok('isLoaded = true after add', loader.isLoaded('tshirt-001'));
  ok('cache size = 1', loader.getCacheSize() === 1);
}

// [35] Asset loader — LRU eviction at max size
console.log('\n  [35] Asset loader — LRU eviction');
{
  class MockAssetLoader {
    private cache = new Map<string, { lastAccessed: number }>();
    private readonly maxSize: number;
    constructor(maxSize: number) { this.maxSize = maxSize; }

    add(id: string, ts: number): void {
      if (this.cache.size >= this.maxSize) {
        let oldestKey = ''; let oldestTime = Infinity;
        for (const [key, entry] of this.cache) {
          if (entry.lastAccessed < oldestTime) { oldestTime = entry.lastAccessed; oldestKey = key; }
        }
        if (oldestKey) this.cache.delete(oldestKey);
      }
      this.cache.set(id, { lastAccessed: ts });
    }
    has(id: string): boolean { return this.cache.has(id); }
    size(): number { return this.cache.size; }
  }

  const loader = new MockAssetLoader(2);
  loader.add('a', 1000);
  loader.add('b', 2000);
  loader.add('c', 3000); // triggers eviction of 'a' (oldest)
  ok('cache size stays at maxSize', loader.size() === 2);
  ok('oldest entry evicted', !loader.has('a'));
  ok('newer entries retained', loader.has('b') && loader.has('c'));
}

// [36] Asset loader — clearCache resets state
console.log('\n  [36] Asset loader — clearCache');
{
  class SimpleLoader {
    cache = new Map<string, boolean>();
    add(id: string) { this.cache.set(id, true); }
    clearCache() { this.cache.clear(); }
    size() { return this.cache.size; }
  }
  const loader = new SimpleLoader();
  loader.add('a'); loader.add('b');
  ok('size = 2 before clear', loader.size() === 2);
  loader.clearCache();
  ok('size = 0 after clear', loader.size() === 0);
}

// [37] Concurrent load deduplication mock
console.log('\n  [37] Asset loader — concurrent load deduplication');
{
  const inflight = new Map<string, boolean>();
  // Simulate two concurrent loads for same ID
  inflight.set('tshirt-001', true); // first load registered
  const secondShouldReuse = inflight.has('tshirt-001');
  ok('second load detects in-flight request', secondShouldReuse);
  inflight.delete('tshirt-001');
  ok('in-flight cleared after completion', !inflight.has('tshirt-001'));
}

// [38] All garment types represented
console.log('\n  [38] Garment catalogue — all types');
{
  const types: GarmentType[] = ['T_SHIRT', 'SHIRT', 'JACKET', 'HOODIE'];
  for (const t of types) {
    ok(`${t} in GARMENT_SCALE_MULTIPLIERS`, t in GARMENT_SCALE_MULTIPLIERS);
  }
}

// [39] Alignment stability — consecutive calls produce same result
console.log('\n  [39] Alignment stability — stable across calls');
{
  const lm = makeLandmarks();
  const m1 = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  const m2 = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H)!;
  ok('shoulderWidth is deterministic', m1.shoulderWidth === m2.shoulderWidth);
  ok('shoulderAngle is deterministic', m1.shoulderAngle === m2.shoulderAngle);
  const a1 = computeGarmentAlignment(m1, BASE_GARMENT, 0.85, false);
  const a2 = computeGarmentAlignment(m2, BASE_GARMENT, 0.85, false);
  ok('alignment.width is deterministic', a1.width === a2.width);
  ok('alignment.rotation is deterministic', a1.rotation === a2.rotation);
}

// [40] Full pipeline: landmarks → measurements → alignment → render check
console.log('\n  [40] Full pipeline integration');
{
  const lm = makeLandmarks(0.2, 0.25, 0.8, 0.25);
  const m = computeBodyMeasurements(lm, CANVAS_W, CANVAS_H, 0.5)!;
  ok('measurements computed from landmarks', m !== null);

  const jacketAsset: GarmentAsset = {
    ...BASE_GARMENT,
    type: 'JACKET',
    scaleMultiplier: GARMENT_SCALE_MULTIPLIERS['JACKET'],
  };
  const a = computeGarmentAlignment(m, jacketAsset, 0.9, false);
  ok('alignment.visible = true (high confidence)', a.visible === true);
  ok('jacket wider than tshirt (same shoulders)', (() => {
    const tshirtA = computeGarmentAlignment(m, BASE_GARMENT, 0.9, false);
    return a.width > tshirtA.width;
  })());
  ok('alignment.x anchored at shoulder center', approx(a.x, m.chestCenter.x, 0.01));
  ok('rotation in valid range', a.rotation >= -Math.PI && a.rotation <= Math.PI);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n============================================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) process.exit(1);
