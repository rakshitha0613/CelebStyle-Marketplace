import type { ConstraintData, PhysicsConfig } from './three.types.js';
import { DEFAULT_PHYSICS_CONFIG } from './three.types.js';

export class GarmentPhysicsService {
  private vertexCount   = 0;
  private positions     = new Float32Array(0);
  private prevPositions = new Float32Array(0);
  private pinned        = new Uint8Array(0);
  private constraints: ConstraintData[] = [];
  private wind         = { x: 0, y: 0, z: 0 };
  private windStrength = 0;
  private _initialized = false;

  // ── Phase 4: inertia + animated wind ──────────────────────────────────────
  private windPhase         = 0;           // radians — advances each tickAnimatedWind call
  private bodyVelocity      = { x: 0, y: 0, z: 0 };
  private prevBodyCenter    = { x: 0, y: 0, z: 0 };
  private bodyCenterInitialized = false;

  get isInitialized(): boolean { return this._initialized; }
  get vertCount(): number       { return this.vertexCount; }

  /**
   * Set up the simulation with `vertexCount` particles.
   * `initialPositions` must be length vertexCount × 3 (x,y,z per vertex).
   * `constraints` define spring edges between vertex pairs.
   */
  initialize(
    vertexCount: number,
    initialPositions: Float32Array,
    constraints: ConstraintData[],
  ): void {
    this.vertexCount  = vertexCount;
    this.positions    = new Float32Array(initialPositions);
    this.prevPositions = new Float32Array(initialPositions);
    this.pinned       = new Uint8Array(vertexCount);
    this.constraints  = constraints;
    this.wind         = { x: 0, y: 0, z: 0 };
    this.windStrength = 0;
    this._initialized = true;
  }

  pinVertex(index: number): void {
    this.pinned[index] = 1;
  }

  unpinVertex(index: number): void {
    this.pinned[index] = 0;
  }

  /**
   * Teleports a vertex and zeroes its velocity (sets prevPos = curPos).
   * Used to anchor pinned bone-attached vertices each frame.
   */
  setVertexPosition(index: number, x: number, y: number, z: number): void {
    const i = index * 3;
    this.positions[i]     = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = z;
    this.prevPositions[i]     = x;
    this.prevPositions[i + 1] = y;
    this.prevPositions[i + 2] = z;
  }

  setWind(direction: { x: number; y: number; z: number }, strength: number): void {
    this.wind = direction;
    this.windStrength = strength;
  }

  /**
   * Advance the simulation by `dt` seconds using Verlet integration.
   *
   * Each step:
   *   1. Verlet integrate all unpinned vertices (gravity + wind)
   *   2. Project spring constraints `config.iterations` times
   */
  step(dt: number, config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG): void {
    if (!this._initialized || this.vertexCount === 0) return;

    const dt2     = dt * dt;
    const damping = config.damping;

    // ── Verlet integration ──────────────────────────────────────────────────
    for (let i = 0; i < this.vertexCount; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;

      const vx = (this.positions[j]     - this.prevPositions[j])     * damping;
      const vy = (this.positions[j + 1] - this.prevPositions[j + 1]) * damping;
      const vz = (this.positions[j + 2] - this.prevPositions[j + 2]) * damping;

      this.prevPositions[j]     = this.positions[j];
      this.prevPositions[j + 1] = this.positions[j + 1];
      this.prevPositions[j + 2] = this.positions[j + 2];

      const windX = config.windEnabled ? this.wind.x * this.windStrength : 0;
      const windZ = config.windEnabled ? this.wind.z * this.windStrength : 0;

      this.positions[j]     += vx + windX * dt2;
      this.positions[j + 1] += vy - config.gravity * dt2; // gravity pulls -Y
      this.positions[j + 2] += vz + windZ * dt2;
    }

    // ── Spring constraint projection ────────────────────────────────────────
    const invIter = 1 / config.iterations;
    for (let iter = 0; iter < config.iterations; iter++) {
      for (const c of this.constraints) {
        const ia = c.indexA * 3;
        const ib = c.indexB * 3;

        const dx = this.positions[ib]     - this.positions[ia];
        const dy = this.positions[ib + 1] - this.positions[ia + 1];
        const dz = this.positions[ib + 2] - this.positions[ia + 2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-9) continue;

        const error      = (dist - c.restLength) / dist;
        const correction = error * 0.5 * c.stiffness * invIter;

        if (!this.pinned[c.indexA]) {
          this.positions[ia]     += dx * correction;
          this.positions[ia + 1] += dy * correction;
          this.positions[ia + 2] += dz * correction;
        }
        if (!this.pinned[c.indexB]) {
          this.positions[ib]     -= dx * correction;
          this.positions[ib + 1] -= dy * correction;
          this.positions[ib + 2] -= dz * correction;
        }
      }
    }
  }

  /**
   * Approximate total system energy (kinetic + gravitational potential).
   * Useful for stability monitoring.
   */
  computeEnergy(config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG): number {
    let energy = 0;
    for (let i = 0; i < this.vertexCount; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;
      const vx = this.positions[j]     - this.prevPositions[j];
      const vy = this.positions[j + 1] - this.prevPositions[j + 1];
      const vz = this.positions[j + 2] - this.prevPositions[j + 2];
      const ke = 0.5 * (vx * vx + vy * vy + vz * vz);
      const pe = config.gravity * Math.max(0, this.positions[j + 1]); // height
      energy += ke + pe;
    }
    return energy;
  }

  getPositions(): Float32Array { return this.positions; }
  getPrevPositions(): Float32Array { return this.prevPositions; }
  isPinned(index: number): boolean { return this.pinned[index] === 1; }

  reset(): void {
    this.positions.set(this.prevPositions);
  }

  destroy(): void {
    this.vertexCount          = 0;
    this.positions            = new Float32Array(0);
    this.prevPositions        = new Float32Array(0);
    this.pinned               = new Uint8Array(0);
    this.constraints          = [];
    this._initialized         = false;
    this.windPhase            = 0;
    this.bodyVelocity         = { x: 0, y: 0, z: 0 };
    this.prevBodyCenter       = { x: 0, y: 0, z: 0 };
    this.bodyCenterInitialized = false;
  }

  // ── Phase 4: animated wind ────────────────────────────────────────────────

  /**
   * Advance the wind oscillation phase by dt seconds and update `windStrength`.
   * Call once per RAF tick (before step/stepWithInertia) to get natural cloth sway.
   *
   * @param dt         Time delta in seconds (typically 1/60)
   * @param baseStrength  Desired average wind strength (same unit as PhysicsConfig.windStrength)
   */
  tickAnimatedWind(dt: number, baseStrength: number): void {
    this.windPhase += dt * 0.9; // ~0.9 Hz primary oscillation
    const primary  = Math.sin(this.windPhase) * 0.40 + 0.60; // 0.20–1.00
    const gust     = Math.sin(this.windPhase * 2.7) * 0.12;   // faster gust layer
    this.windStrength = Math.max(0, baseStrength * (primary + gust));
  }

  // ── Phase 4: body inertia ─────────────────────────────────────────────────

  /**
   * Track the body centre position each frame to estimate velocity.
   * The derived velocity is used in stepWithInertia to push cloth opposite to body motion.
   *
   * @param cx  Body-centre x (canvas pixels or normalised — units must be consistent)
   * @param cy  Body-centre y
   * @param cz  Body-centre z
   * @param dt  Time delta in seconds
   */
  updateBodyCenter(cx: number, cy: number, cz: number, dt: number): void {
    if (!this.bodyCenterInitialized) {
      this.prevBodyCenter       = { x: cx, y: cy, z: cz };
      this.bodyCenterInitialized = true;
      return;
    }

    const invDt = dt > 1e-6 ? 1 / dt : 0;
    const rawVx = (cx - this.prevBodyCenter.x) * invDt;
    const rawVy = (cy - this.prevBodyCenter.y) * invDt;
    const rawVz = (cz - this.prevBodyCenter.z) * invDt;

    // Low-pass EMA on velocity to avoid impulsive spikes
    this.bodyVelocity.x = this.bodyVelocity.x * 0.75 + rawVx * 0.25;
    this.bodyVelocity.y = this.bodyVelocity.y * 0.75 + rawVy * 0.25;
    this.bodyVelocity.z = this.bodyVelocity.z * 0.75 + rawVz * 0.25;

    this.prevBodyCenter = { x: cx, y: cy, z: cz };
  }

  /** Expose the current body velocity (for external inertia consumers). */
  getBodyVelocity(): { x: number; y: number; z: number } {
    return { ...this.bodyVelocity };
  }

  // ── Phase 4: inertia-aware step ───────────────────────────────────────────

  /**
   * Verlet step with body-movement inertia: cloth swings opposite to body motion.
   * Identical constraint projection to step(), but adds inertia impulse to free vertices.
   */
  stepWithInertia(dt: number, config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG): void {
    if (!this._initialized || this.vertexCount === 0) return;

    const dt2    = dt * dt;
    const damp   = config.damping;

    for (let i = 0; i < this.vertexCount; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;

      const vx = (this.positions[j]     - this.prevPositions[j])     * damp;
      const vy = (this.positions[j + 1] - this.prevPositions[j + 1]) * damp;
      const vz = (this.positions[j + 2] - this.prevPositions[j + 2]) * damp;

      this.prevPositions[j]     = this.positions[j];
      this.prevPositions[j + 1] = this.positions[j + 1];
      this.prevPositions[j + 2] = this.positions[j + 2];

      const windX = config.windEnabled ? this.wind.x * this.windStrength : 0;
      const windZ = config.windEnabled ? this.wind.z * this.windStrength : 0;

      // Inertia: body moving right → cloth lags leftward
      const inertiaScale = 0.012;
      const inertiaX = -this.bodyVelocity.x * inertiaScale;
      const inertiaZ = -this.bodyVelocity.z * inertiaScale;

      this.positions[j]     += vx + (windX + inertiaX) * dt2;
      this.positions[j + 1] += vy - config.gravity * dt2;
      this.positions[j + 2] += vz + (windZ + inertiaZ) * dt2;
    }

    // Spring constraint projection (identical to step())
    const invIter = 1 / config.iterations;
    for (let iter = 0; iter < config.iterations; iter++) {
      for (const c of this.constraints) {
        const ia = c.indexA * 3;
        const ib = c.indexB * 3;

        const dx = this.positions[ib]     - this.positions[ia];
        const dy = this.positions[ib + 1] - this.positions[ia + 1];
        const dz = this.positions[ib + 2] - this.positions[ia + 2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-9) continue;

        const error      = (dist - c.restLength) / dist;
        const correction = error * 0.5 * c.stiffness * invIter;

        if (!this.pinned[c.indexA]) {
          this.positions[ia]     += dx * correction;
          this.positions[ia + 1] += dy * correction;
          this.positions[ia + 2] += dz * correction;
        }
        if (!this.pinned[c.indexB]) {
          this.positions[ib]     -= dx * correction;
          this.positions[ib + 1] -= dy * correction;
          this.positions[ib + 2] -= dz * correction;
        }
      }
    }
  }
}
