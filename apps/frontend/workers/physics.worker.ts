import type {
  PhysicsWorkerInboundMessage,
  PhysicsWorkerOutboundMessage,
  PhysicsConfig,
  ConstraintData,
} from '../lib/ar/three.types.js';
import { DEFAULT_PHYSICS_CONFIG } from '../lib/ar/three.types.js';

// Avoid dom/webworker lib conflicts — same pattern as segmentation.worker.ts
const ctx = self as unknown as {
  addEventListener(type: string, handler: (e: MessageEvent) => void): void;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};

// ── Inline Verlet cloth physics (no Three.js dependency) ──────────────────────

let vertexCount = 0;
let positions    = new Float32Array(0);
let prevPositions = new Float32Array(0);
let pinned        = new Uint8Array(0);
let constraints: ConstraintData[] = [];
let wind = { x: 0, y: 0, z: 0 };
let windStrength = 0;
let config: PhysicsConfig = { ...DEFAULT_PHYSICS_CONFIG };
let initialized = false;

function setVertices(
  inPositions: Float32Array,
  pinnedIndices: number[],
  inConstraints: ConstraintData[],
): void {
  vertexCount   = inPositions.length / 3;
  positions     = new Float32Array(inPositions);
  prevPositions = new Float32Array(inPositions);
  pinned        = new Uint8Array(vertexCount);
  constraints   = inConstraints;
  for (const idx of pinnedIndices) pinned[idx] = 1;
  initialized   = true;
}

function applyBonePositions(bonePositions: Float32Array, pinnedIndices: number[]): void {
  for (let k = 0; k < pinnedIndices.length; k++) {
    const vi = pinnedIndices[k];
    const bi = k * 3;
    const pi = vi * 3;
    positions[pi]     = bonePositions[bi];
    positions[pi + 1] = bonePositions[bi + 1];
    positions[pi + 2] = bonePositions[bi + 2];
    prevPositions[pi]     = bonePositions[bi];
    prevPositions[pi + 1] = bonePositions[bi + 1];
    prevPositions[pi + 2] = bonePositions[bi + 2];
  }
}

function step(dt: number): number {
  if (!initialized || vertexCount === 0) return 0;

  const dt2     = dt * dt;
  const damping = config.damping;

  for (let i = 0; i < vertexCount; i++) {
    if (pinned[i]) continue;
    const j = i * 3;

    const vx = (positions[j]     - prevPositions[j])     * damping;
    const vy = (positions[j + 1] - prevPositions[j + 1]) * damping;
    const vz = (positions[j + 2] - prevPositions[j + 2]) * damping;

    prevPositions[j]     = positions[j];
    prevPositions[j + 1] = positions[j + 1];
    prevPositions[j + 2] = positions[j + 2];

    const wx = config.windEnabled ? wind.x * windStrength : 0;
    const wz = config.windEnabled ? wind.z * windStrength : 0;

    positions[j]     += vx + wx * dt2;
    positions[j + 1] += vy - config.gravity * dt2;
    positions[j + 2] += vz + wz * dt2;
  }

  const invIter = 1 / config.iterations;
  for (let iter = 0; iter < config.iterations; iter++) {
    for (const c of constraints) {
      const ia = c.indexA * 3;
      const ib = c.indexB * 3;

      const dx = positions[ib]     - positions[ia];
      const dy = positions[ib + 1] - positions[ia + 1];
      const dz = positions[ib + 2] - positions[ia + 2];
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1e-9) continue;

      const error      = (dist - c.restLength) / dist;
      const correction = error * 0.5 * c.stiffness * invIter;

      if (!pinned[c.indexA]) {
        positions[ia]     += dx * correction;
        positions[ia + 1] += dy * correction;
        positions[ia + 2] += dz * correction;
      }
      if (!pinned[c.indexB]) {
        positions[ib]     -= dx * correction;
        positions[ib + 1] -= dy * correction;
        positions[ib + 2] -= dz * correction;
      }
    }
  }

  // Approximate kinetic energy
  let energy = 0;
  for (let i = 0; i < vertexCount; i++) {
    if (pinned[i]) continue;
    const j = i * 3;
    const vx = positions[j]     - prevPositions[j];
    const vy = positions[j + 1] - prevPositions[j + 1];
    const vz = positions[j + 2] - prevPositions[j + 2];
    energy += vx * vx + vy * vy + vz * vz;
  }
  return energy * 0.5;
}

function post(msg: PhysicsWorkerOutboundMessage, transfer?: Transferable[]): void {
  ctx.postMessage(msg, transfer);
}

// ── Message handler ────────────────────────────────────────────────────────────

ctx.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as PhysicsWorkerInboundMessage;

  switch (msg.type) {
    case 'INIT':
      config = { ...DEFAULT_PHYSICS_CONFIG, ...msg.payload.config };
      initialized = false;
      post({ type: 'READY' });
      break;

    case 'SET_VERTICES': {
      const { positions: pos, pinnedIndices, constraints: cons } = msg.payload;
      setVertices(pos, pinnedIndices, cons);
      break;
    }

    case 'SET_BONE_POSITIONS':
      applyBonePositions(msg.payload.bonePositions, msg.payload.pinnedIndices);
      break;

    case 'STEP': {
      const energy = step(msg.payload.deltaTime);
      // Transfer the buffer for zero-copy performance
      const out = new Float32Array(positions);
      post(
        { type: 'STEP_RESULT', payload: { positions: out, energy } },
        [out.buffer],
      );
      break;
    }

    case 'SET_WIND':
      wind         = msg.payload.direction;
      windStrength = msg.payload.strength;
      config.windEnabled = msg.payload.strength > 0;
      break;

    case 'UPDATE_CONFIG':
      config = { ...config, ...msg.payload.config };
      break;

    case 'DESTROY':
      vertexCount   = 0;
      positions     = new Float32Array(0);
      prevPositions = new Float32Array(0);
      pinned        = new Uint8Array(0);
      constraints   = [];
      initialized   = false;
      post({ type: 'DESTROYED' });
      break;
  }
});
