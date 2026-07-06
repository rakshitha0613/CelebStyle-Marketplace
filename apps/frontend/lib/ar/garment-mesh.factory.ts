import type { ConstraintData } from './three.types.js';

export type ClothGarmentType = 'T_SHIRT' | 'SHIRT' | 'JACKET' | 'HOODIE' | 'DRESS';

export interface ClothAnchorIndices {
  leftShoulder: number[];
  rightShoulder: number[];
  neckLine: number[];
  chest: number[];
  waist: number[];
  leftHip: number[];
  rightHip: number[];
  leftSleeveEnd: number[];
  rightSleeveEnd: number[];
}

export interface ClothMesh {
  /** x,y,z per vertex in canonical unit space: torso width=1, top y=0, bottom y=-torsoHeight */
  positions: Float32Array;
  triangles: Uint32Array;
  uvs: Float32Array;
  constraints: ConstraintData[];
  pinnedIndices: number[];
  anchors: ClothAnchorIndices;
  vertexCount: number;
}

interface GarmentSpec {
  torsoCols: number;
  torsoRows: number;
  torsoHeight: number;    // relative to width=1.0
  widthFlare: number;     // bottom width multiplier (>1 = skirt flare, 1 = straight)
  hasSleeves: boolean;
  sleeveCols: number;
  sleeveRows: number;
  sleeveLength: number;
  sleeveWidth: number;
  sleeveAngle: number;    // radians below horizontal
}

const SPECS: Record<ClothGarmentType, GarmentSpec> = {
  T_SHIRT: {
    torsoCols: 7,  torsoRows: 8,  torsoHeight: 1.1,  widthFlare: 1.0,
    hasSleeves: true,  sleeveCols: 4, sleeveRows: 3,
    sleeveLength: 0.28, sleeveWidth: 0.12, sleeveAngle: Math.PI / 6,
  },
  SHIRT: {
    torsoCols: 7,  torsoRows: 10, torsoHeight: 1.25, widthFlare: 1.0,
    hasSleeves: true,  sleeveCols: 4, sleeveRows: 6,
    sleeveLength: 0.52, sleeveWidth: 0.10, sleeveAngle: Math.PI / 4,
  },
  HOODIE: {
    torsoCols: 8,  torsoRows: 10, torsoHeight: 1.28, widthFlare: 1.05,
    hasSleeves: true,  sleeveCols: 5, sleeveRows: 6,
    sleeveLength: 0.56, sleeveWidth: 0.13, sleeveAngle: Math.PI / 4,
  },
  JACKET: {
    torsoCols: 8,  torsoRows: 10, torsoHeight: 1.32, widthFlare: 1.02,
    hasSleeves: true,  sleeveCols: 5, sleeveRows: 6,
    sleeveLength: 0.60, sleeveWidth: 0.12, sleeveAngle: Math.PI / 4,
  },
  DRESS: {
    torsoCols: 9,  torsoRows: 14, torsoHeight: 2.20, widthFlare: 1.60,
    hasSleeves: false, sleeveCols: 0, sleeveRows: 0,
    sleeveLength: 0,   sleeveWidth: 0,  sleeveAngle: 0,
  },
};

/** Euclidean distance between two flat-array positions at local vertex indices */
function restLen(pos: number[], a: number, b: number): number {
  const ax = pos[a * 3], ay = pos[a * 3 + 1];
  const bx = pos[b * 3], by = pos[b * 3 + 1];
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Build a grid section of cloth vertices + constraints.
 * xFn / yFn take (row, col) and return canonical position.
 * vertexOffset is the global vertex index where this section starts.
 */
function buildGrid(
  rows: number,
  cols: number,
  xFn: (r: number, c: number) => number,
  yFn: (r: number, c: number) => number,
  vertexOffset: number,
): { pos: number[]; uvs: number[]; tris: number[]; cons: ConstraintData[] } {
  const pos: number[] = [];
  const uvs: number[] = [];
  const tris: number[] = [];
  const cons: ConstraintData[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pos.push(xFn(r, c), yFn(r, c), 0);
      uvs.push(
        cols > 1 ? c / (cols - 1) : 0.5,
        rows > 1 ? 1 - r / (rows - 1) : 0.5,
      );
    }
  }

  const g = (r: number, c: number) => vertexOffset + r * cols + c;
  const l = (r: number, c: number) => r * cols + c;

  // Triangles
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = g(r, c), tr = g(r, c + 1);
      const bl = g(r + 1, c), br = g(r + 1, c + 1);
      tris.push(tl, bl, tr, bl, br, tr);
    }
  }

  // Structural horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++)
      cons.push({ indexA: g(r, c), indexB: g(r, c + 1), restLength: restLen(pos, l(r, c), l(r, c + 1)), stiffness: 1.0 });
  }
  // Structural vertical
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++)
      cons.push({ indexA: g(r, c), indexB: g(r + 1, c), restLength: restLen(pos, l(r, c), l(r + 1, c)), stiffness: 1.0 });
  }
  // Shear
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      cons.push({ indexA: g(r, c), indexB: g(r + 1, c + 1), restLength: restLen(pos, l(r, c), l(r + 1, c + 1)), stiffness: 0.8 });
      cons.push({ indexA: g(r, c + 1), indexB: g(r + 1, c), restLength: restLen(pos, l(r, c + 1), l(r + 1, c)), stiffness: 0.8 });
    }
  }
  // Bend (skip-one) horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 2; c++)
      cons.push({ indexA: g(r, c), indexB: g(r, c + 2), restLength: restLen(pos, l(r, c), l(r, c + 2)), stiffness: 0.3 });
  }
  // Bend (skip-one) vertical
  for (let r = 0; r < rows - 2; r++) {
    for (let c = 0; c < cols; c++)
      cons.push({ indexA: g(r, c), indexB: g(r + 2, c), restLength: restLen(pos, l(r, c), l(r + 2, c)), stiffness: 0.3 });
  }

  return { pos, uvs, tris, cons };
}

/**
 * Build a canonical cloth mesh for the given garment type.
 *
 * Coordinate space: torso width = 1.0, x ∈ [-0.5, 0.5], y ∈ [0, -torsoHeight].
 * Scale by body dimensions in initializeGarment() before physics simulation.
 */
export function buildGarmentMesh(type: ClothGarmentType): ClothMesh {
  const spec = SPECS[type];
  const { torsoCols: tc, torsoRows: tr, torsoHeight: th, widthFlare } = spec;

  const allPos: number[] = [];
  const allUVs: number[] = [];
  const allTris: number[] = [];
  const allCons: ConstraintData[] = [];
  const pinned: number[] = [];

  // ── Torso ─────────────────────────────────────────────────────────────────
  // Width interpolates from 1.0 at top to widthFlare at bottom for flared garments
  const torso = buildGrid(
    tr, tc,
    (r, c) => {
      const s = tr > 1 ? r / (tr - 1) : 0;
      const w = 1.0 + (widthFlare - 1.0) * s;    // width envelope
      return (-0.5 + (tc > 1 ? c / (tc - 1) : 0.5)) * w;
    },
    (r) => -(tr > 1 ? r / (tr - 1) : 0) * th,
    0,
  );
  allPos.push(...torso.pos);
  allUVs.push(...torso.uvs);
  allTris.push(...torso.tris);
  allCons.push(...torso.cons);

  // Pin entire shoulder row (row 0)
  for (let c = 0; c < tc; c++) pinned.push(c);

  // ── Anchor indices (torso-only) ───────────────────────────────────────────
  const leftShoulderAnchors = [0, 1];
  const rightShoulderAnchors = [tc - 1, tc - 2];
  const neckAnchors = [Math.floor(tc / 2)];
  const chestRow = Math.floor(tr * 0.30);
  const chestAnchors = [chestRow * tc + Math.floor(tc / 2)];
  const waistRow = Math.floor(tr * 0.60);
  const waistAnchors = Array.from({ length: tc }, (_, i) => waistRow * tc + i);
  const hipRow = Math.floor(tr * 0.80);
  const leftHipAnchors = [hipRow * tc];
  const rightHipAnchors = [hipRow * tc + tc - 1];

  let leftSleeveEnd: number[] = [];
  let rightSleeveEnd: number[] = [];

  // ── Sleeves ───────────────────────────────────────────────────────────────
  if (spec.hasSleeves) {
    const { sleeveCols: sc, sleeveRows: sr, sleeveLength: sl, sleeveWidth: sw, sleeveAngle: sa } = spec;
    const leftOffset  = tr * tc;
    const rightOffset = leftOffset + sr * sc;

    // Left sleeve: arm axis points left + down
    const lAx = -Math.cos(sa), lAy = -Math.sin(sa);
    const lPx = -lAy,          lPy =  lAx;  // perpendicular

    const leftSleeve = buildGrid(
      sr, sc,
      (r, c) => {
        const s = sr > 1 ? r / (sr - 1) : 0;
        const t = sc > 1 ? c / (sc - 1) : 0.5;
        return (-0.5 + lAx * sl * s) + lPx * sw * (t - 0.5);
      },
      (r, c) => {
        const s = sr > 1 ? r / (sr - 1) : 0;
        const t = sc > 1 ? c / (sc - 1) : 0.5;
        return (lAy * sl * s) + lPy * sw * (t - 0.5);
      },
      leftOffset,
    );
    allPos.push(...leftSleeve.pos);
    allUVs.push(...leftSleeve.uvs);
    allTris.push(...leftSleeve.tris);
    allCons.push(...leftSleeve.cons);

    // Pin left sleeve top row (attachment to torso)
    for (let c = 0; c < sc; c++) pinned.push(leftOffset + c);

    leftSleeveEnd = Array.from({ length: sc }, (_, i) => leftOffset + (sr - 1) * sc + i);

    // Soft-attach rightmost sleeve column to torso top-left
    const sleeveTopRight = leftOffset + (sc - 1);
    const torsoTopLeft   = 0;
    const ax = allPos[torsoTopLeft * 3],  ay = allPos[torsoTopLeft * 3 + 1];
    const bx = allPos[sleeveTopRight * 3], by = allPos[sleeveTopRight * 3 + 1];
    allCons.push({ indexA: torsoTopLeft, indexB: sleeveTopRight, restLength: Math.hypot(bx - ax, by - ay), stiffness: 0.9 });

    // Right sleeve: arm axis points right + down
    const rAx =  Math.cos(sa), rAy = -Math.sin(sa);
    const rPx = -rAy,          rPy =  rAx;

    const rightSleeve = buildGrid(
      sr, sc,
      (r, c) => {
        const s = sr > 1 ? r / (sr - 1) : 0;
        const t = sc > 1 ? c / (sc - 1) : 0.5;
        return (0.5 + rAx * sl * s) + rPx * sw * (t - 0.5);
      },
      (r, c) => {
        const s = sr > 1 ? r / (sr - 1) : 0;
        const t = sc > 1 ? c / (sc - 1) : 0.5;
        return (rAy * sl * s) + rPy * sw * (t - 0.5);
      },
      rightOffset,
    );
    allPos.push(...rightSleeve.pos);
    allUVs.push(...rightSleeve.uvs);
    allTris.push(...rightSleeve.tris);
    allCons.push(...rightSleeve.cons);

    // Pin right sleeve top row
    for (let c = 0; c < sc; c++) pinned.push(rightOffset + c);

    rightSleeveEnd = Array.from({ length: sc }, (_, i) => rightOffset + (sr - 1) * sc + i);

    // Soft-attach leftmost sleeve column to torso top-right
    const rightSleeveTopLeft = rightOffset;
    const torsoTopRight      = tc - 1;
    const cx = allPos[torsoTopRight * 3],      cy = allPos[torsoTopRight * 3 + 1];
    const dx = allPos[rightSleeveTopLeft * 3], dy = allPos[rightSleeveTopLeft * 3 + 1];
    allCons.push({ indexA: torsoTopRight, indexB: rightSleeveTopLeft, restLength: Math.hypot(dx - cx, dy - cy), stiffness: 0.9 });
  }

  return {
    positions:    new Float32Array(allPos),
    triangles:    new Uint32Array(allTris),
    uvs:          new Float32Array(allUVs),
    constraints:  allCons,
    pinnedIndices: pinned,
    anchors: {
      leftShoulder:  leftShoulderAnchors,
      rightShoulder: rightShoulderAnchors,
      neckLine:      neckAnchors,
      chest:         chestAnchors,
      waist:         waistAnchors,
      leftHip:       leftHipAnchors,
      rightHip:      rightHipAnchors,
      leftSleeveEnd,
      rightSleeveEnd,
    },
    vertexCount: allPos.length / 3,
  };
}

/** Fabric-specific physics presets (damping, gravity, stiffness tuned per material) */
export const FABRIC_PHYSICS: Record<ClothGarmentType, { gravity: number; damping: number; iterations: number }> = {
  T_SHIRT: { gravity: 3.5, damping: 0.982, iterations: 6 },
  SHIRT:   { gravity: 3.8, damping: 0.980, iterations: 6 },
  HOODIE:  { gravity: 4.5, damping: 0.975, iterations: 7 },
  JACKET:  { gravity: 5.0, damping: 0.970, iterations: 8 },
  DRESS:   { gravity: 3.0, damping: 0.988, iterations: 6 },
};
