'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PoseLandmark } from '@/lib/ar/garment.types';
import type { GarmentAsset } from '@/lib/ar/garment.types';
import type { Scene3DConfig, PhysicsConfig } from '@/lib/ar/three.types';
import { POSE_LANDMARKS } from '@/lib/ar/garment.types';
import { GarmentRigService } from '@/lib/ar/garment-rig.service';
import { GarmentPhysicsService } from '@/lib/ar/garment-physics.service';
import { buildGarmentMesh, FABRIC_PHYSICS, type ClothGarmentType } from '@/lib/ar/garment-mesh.factory';
import type { ClothAnchorIndices } from '@/lib/ar/garment-mesh.factory';

const MAX_DELTA = 0.033;
const DEFAULT_SHOULDER_WIDTH = 0.60;  // world units when landmarks not yet available

// ── Device capability detection ───────────────────────────────────────────────

type DeviceTier = 'HIGH' | 'MID' | 'LOW';

function detectDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'HIGH';
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);
  const cores = navigator.hardwareConcurrency ?? 4;
  // WebGL2 availability check
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return 'LOW';
  } catch { return 'LOW'; }
  if (isMobile && cores <= 4) return 'MID';
  if (cores <= 2) return 'MID';
  return 'HIGH';
}

// ── Skeleton debug helper ──────────────────────────────────────────────────────

function SkeletonPoints({ landmarks }: { landmarks: PoseLandmark[] }) {
  const indices = [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
  ];
  return (
    <>
      {indices.map((idx) => {
        const lm = landmarks[idx];
        if (!lm || lm.visibility < 0.3) return null;
        return (
          <mesh key={idx} position={[(lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#00ff64" transparent opacity={lm.visibility} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Build Three.js BufferGeometry from cloth mesh ─────────────────────────────

function buildClothGeometry(
  positions: Float32Array,
  triangles: Uint32Array,
  uvs: Float32Array,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // Use a dynamic buffer for position since it gets updated every frame
  const posAttr = new THREE.BufferAttribute(positions.slice(), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setIndex(new THREE.BufferAttribute(triangles, 1));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

// ── Bilinear mesh warping ─────────────────────────────────────────────────────

/**
 * Warp shoulder row positions so they smoothly interpolate from the detected
 * left shoulder to the right shoulder landmark.
 * Called once per garment-change to set the initial cloth pose.
 */
function warpShoulderRow(
  physics: GarmentPhysicsService,
  anchors: ClothAnchorIndices,
  leftWorld: { x: number; y: number; z: number },
  rightWorld: { x: number; y: number; z: number },
  torsoColCount: number,
): void {
  for (let c = 0; c < torsoColCount; c++) {
    const t = torsoColCount > 1 ? c / (torsoColCount - 1) : 0.5;
    const x = leftWorld.x + t * (rightWorld.x - leftWorld.x);
    const y = leftWorld.y + t * (rightWorld.y - leftWorld.y);
    const z = leftWorld.z + t * (rightWorld.z - leftWorld.z);
    physics.setVertexPosition(c, x, y, z);
  }
  // Also warp sleeve attachment rows to match shoulder
  for (const idx of anchors.leftShoulder) physics.setVertexPosition(idx, leftWorld.x, leftWorld.y, leftWorld.z);
  for (const idx of anchors.rightShoulder) physics.setVertexPosition(idx, rightWorld.x, rightWorld.y, rightWorld.z);
}

// ── Wrinkle normals ───────────────────────────────────────────────────────────

/**
 * Perturb geometry normals where cloth is compressed to simulate wrinkles.
 * Only modifies the normal attribute — no vertex positions changed.
 */
function applyWrinkleNormals(
  geo: THREE.BufferGeometry,
  physics: GarmentPhysicsService,
): void {
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;
  if (!normAttr) return;
  const positions = physics.getPositions();
  const prevPositions = physics.getPrevPositions();
  const n = normAttr.count;
  for (let i = 0; i < n; i++) {
    const vx = positions[i * 3]     - prevPositions[i * 3];
    const vy = positions[i * 3 + 1] - prevPositions[i * 3 + 1];
    const speed = Math.hypot(vx, vy);
    if (speed > 0.0005) {
      // Tilt normal toward velocity direction when cloth is moving fast (wrinkle effect)
      const nx = normAttr.getX(i) + vx * 2.0;
      const ny = normAttr.getY(i) + vy * 2.0;
      const nz = normAttr.getZ(i);
      const len = Math.hypot(nx, ny, nz) || 1;
      normAttr.setXYZ(i, nx / len, ny / len, nz / len);
    }
  }
  normAttr.needsUpdate = true;
}

// ── Cloth garment component ────────────────────────────────────────────────────

interface ClothProps {
  garment:   GarmentAsset;
  landmarks: PoseLandmark[] | null;
  config:    Scene3DConfig;
  deviceTier: DeviceTier;
}

function Garment3DCloth({ garment, landmarks, config, deviceTier }: ClothProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const meshRef     = useRef<THREE.Mesh>(null);
  const physicsRef  = useRef(new GarmentPhysicsService());
  const rigRef      = useRef(new GarmentRigService());
  const anchorsRef  = useRef<ClothAnchorIndices | null>(null);
  const geoRef      = useRef<THREE.BufferGeometry | null>(null);
  const physCfgRef  = useRef<PhysicsConfig | null>(null);

  // Build cloth mesh and initialize physics when garment changes
  const [geoVersion, setGeoVersion] = useState(0);
  const prevGarmentId = useRef<string | null>(null);

  useEffect(() => {
    if (prevGarmentId.current === garment.id) return;
    prevGarmentId.current = garment.id;

    const physics = physicsRef.current;
    physics.destroy();

    const type = garment.type as ClothGarmentType;
    const fabric = FABRIC_PHYSICS[type];

    // Determine initial shoulder width from current landmarks if available
    let shoulderWidth = DEFAULT_SHOULDER_WIDTH;
    let cx = 0, cy = 0;
    if (landmarks) {
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
      if (ls && rs && ls.visibility > 0.5 && rs.visibility > 0.5) {
        const rig = rigRef.current;
        const lw  = rig.computeLandmarkToWorld(ls);
        const rw  = rig.computeLandmarkToWorld(rs);
        shoulderWidth = Math.max(0.3, Math.hypot(rw.x - lw.x, rw.y - lw.y));
        cx = (lw.x + rw.x) * 0.5;
        cy = (lw.y + rw.y) * 0.5;
      }
    }

    const anchors = physics.initializeGarment(type, shoulderWidth, cx, cy);
    anchorsRef.current = anchors;

    // Build per-fabric physics config
    physCfgRef.current = {
      gravity:      fabric.gravity,
      damping:      fabric.damping,
      stiffness:    50,
      iterations:   deviceTier === 'LOW' ? 3 : deviceTier === 'MID' ? 5 : fabric.iterations,
      windEnabled:  true,
      windDirection: { x: 1, y: 0, z: 0 },
      windStrength: 0.2,
    };
    physics.setWind({ x: 1, y: 0, z: 0 }, 0.2);

    // If landmarks available, warp initial cloth to body
    if (landmarks) {
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
      if (ls && rs && ls.visibility > 0.5 && rs.visibility > 0.5) {
        const rig = rigRef.current;
        const lw  = rig.computeLandmarkToWorld(ls);
        const rw  = rig.computeLandmarkToWorld(rs);
        const mesh = buildGarmentMesh(type);
        warpShoulderRow(physics, anchors, lw, rw, mesh.anchors.neckLine.length > 0 ? mesh.anchors.waist.length : 7);
      }
    }

    // Build Three.js geometry from scaled positions
    const positions = physics.getPositions();
    const mesh      = buildGarmentMesh(type);
    // Re-scale triangles/uvs from canonical mesh (positions already scaled by initializeGarment)
    const geo = buildClothGeometry(positions, mesh.triangles, mesh.uvs);
    geoRef.current?.dispose();
    geoRef.current = geo;
    setGeoVersion((v) => v + 1);

    return () => {
      geo.dispose();
      physics.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garment.id]);

  // Per-frame: bind landmarks → physics → geometry
  useFrame((_, delta) => {
    if (!physicsRef.current.isInitialized || !geoRef.current || config.renderMode !== '3D') return;
    if (deviceTier === 'LOW') return; // graceful fallback: no physics on low-end

    const dt      = Math.min(delta, MAX_DELTA);
    const physics = physicsRef.current;
    const rig     = rigRef.current;
    const anchors = anchorsRef.current;
    const physCfg = physCfgRef.current;
    if (!physCfg || !anchors) return;

    // ── Anchor binding ─────────────────────────────────────────────────────
    if (landmarks) {
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

      if (ls && rs && ls.visibility > 0.4 && rs.visibility > 0.4) {
        const lw = rig.computeLandmarkToWorld(ls);
        const rw = rig.computeLandmarkToWorld(rs);

        // Pin shoulder anchor vertices to landmark world positions (bilinear interp across top row)
        for (const idx of anchors.leftShoulder) {
          physics.setVertexPosition(idx, lw.x, lw.y, lw.z);
        }
        for (const idx of anchors.rightShoulder) {
          physics.setVertexPosition(idx, rw.x, rw.y, rw.z);
        }
        // Neck/chest area: interpolate between shoulders
        for (const idx of anchors.neckLine) {
          physics.setVertexPosition(idx, (lw.x + rw.x) * 0.5, (lw.y + rw.y) * 0.5, (lw.z + rw.z) * 0.5);
        }

        physics.updateBodyCenter((lw.x + rw.x) * 0.5, (lw.y + rw.y) * 0.5, (lw.z + rw.z) * 0.5, dt);
      }

      // Optional waist/hip anchors when landmarks are visible
      const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
      const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];
      if (lh && rh && lh.visibility > 0.5 && rh.visibility > 0.5) {
        const lhw = rig.computeLandmarkToWorld(lh);
        const rhw = rig.computeLandmarkToWorld(rh);
        // Blend waist toward midpoint between shoulders and hips (50/50)
        const ls2 = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rs2 = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (ls2 && rs2) {
          const lsw = rig.computeLandmarkToWorld(ls2);
          const rsw = rig.computeLandmarkToWorld(rs2);
          for (const idx of anchors.leftHip) {
            physics.setVertexPosition(idx, lhw.x, lhw.y, lhw.z);
          }
          for (const idx of anchors.rightHip) {
            physics.setVertexPosition(idx, rhw.x, rhw.y, rhw.z);
          }
          // Chest anchor: midpoint between shoulders
          for (const idx of anchors.chest) {
            physics.setVertexPosition(idx,
              (lsw.x + rsw.x) * 0.5,
              (lsw.y + rsw.y) * 0.5 - 0.15,
              (lsw.z + rsw.z) * 0.5,
            );
          }
        }
      }

      // Sleeve elbow tracking
      const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
      const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
      if (le && le.visibility > 0.5 && anchors.leftSleeveEnd.length > 0) {
        const lew = rig.computeLandmarkToWorld(le);
        const n   = anchors.leftSleeveEnd.length;
        for (let i = 0; i < n; i++) {
          const t = n > 1 ? i / (n - 1) : 0.5;
          const ls3 = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
          if (ls3) {
            const lsw3 = rig.computeLandmarkToWorld(ls3);
            // Blend from shoulder to elbow position across sleeve end
            const bx = lsw3.x * (1 - t) + lew.x * t;
            const by = lsw3.y * (1 - t) + lew.y * t;
            physics.setVertexPosition(anchors.leftSleeveEnd[i], bx, by, lew.z);
          }
        }
      }
      if (re && re.visibility > 0.5 && anchors.rightSleeveEnd.length > 0) {
        const rew = rig.computeLandmarkToWorld(re);
        const n   = anchors.rightSleeveEnd.length;
        for (let i = 0; i < n; i++) {
          const t = n > 1 ? i / (n - 1) : 0.5;
          const rs3 = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
          if (rs3) {
            const rsw3 = rig.computeLandmarkToWorld(rs3);
            const bx = rsw3.x * (1 - t) + rew.x * t;
            const by = rsw3.y * (1 - t) + rew.y * t;
            physics.setVertexPosition(anchors.rightSleeveEnd[i], bx, by, rew.z);
          }
        }
      }
    }

    // ── Physics step ───────────────────────────────────────────────────────
    if (config.physicsEnabled && !config.reducedMotion) {
      physics.tickAnimatedWind(dt, 0.3);
      physics.stepWithInertia(dt, physCfg);
    }

    // ── Apply physics positions to geometry ────────────────────────────────
    const posAttr = geoRef.current.attributes.position as THREE.BufferAttribute;
    (posAttr.array as Float32Array).set(physics.getPositions());
    posAttr.needsUpdate = true;

    // Recompute normals for lighting (cheap at these vertex counts)
    geoRef.current.computeVertexNormals();

    // Wrinkle normal perturbation where cloth is moving fast
    if (config.physicsEnabled && !config.reducedMotion && deviceTier === 'HIGH') {
      applyWrinkleNormals(geoRef.current, physics);
    }

    // ── Body occlusion: shift garment depth behind landmark plane ──────────
    // Vertices near the torso centre get a slight negative Z to appear behind
    // the body silhouette in the composite. The segmentation canvas sits on
    // top of the R3F transparent overlay, providing the final occlusion.
    if (groupRef.current && landmarks) {
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
      if (ls && rs) {
        const avgZ = ((ls.z ?? 0) + (rs.z ?? 0)) * 0.5;
        groupRef.current.position.z = -0.05 + avgZ * 0.5;
      }
    }
  });

  const color =
    garment.type === 'JACKET' ? '#111827' :
    garment.type === 'HOODIE' ? '#6b7280' :
    garment.type === 'SHIRT'  ? '#1e40af' :
    garment.type === 'DRESS'  ? '#9f7aea' :
                                '#f8f8f8'; // T_SHIRT

  // Use primitive to attach the ref-managed geometry imperatively
  return (
    <group ref={groupRef}>
      {geoVersion > 0 && geoRef.current && (
        <mesh ref={meshRef} castShadow receiveShadow>
          <primitive object={geoRef.current} attach="geometry" />
          <meshStandardMaterial
            color={color}
            roughness={0.80}
            metalness={0.00}
            transparent
            opacity={0.90}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {config.showSkeleton && landmarks && <SkeletonPoints landmarks={landmarks} />}
    </group>
  );
}

// ── Static GLB model with physics-driven motion ───────────────────────────────

function Garment3DModel({
  url,
  garment,
  landmarks,
  config,
}: {
  url: string;
  garment: GarmentAsset;
  landmarks: PoseLandmark[] | null;
  config: Scene3DConfig;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGLTF } = require('@react-three/drei') as { useGLTF: (url: string) => { scene: THREE.Group } };
  const { scene } = useGLTF(url);
  const groupRef   = useRef<THREE.Group>(null);
  const physicsRef = useRef(new GarmentPhysicsService());
  const rigRef     = useRef(new GarmentRigService());

  // Initialize lightweight physics for motion inertia when garment loads
  useEffect(() => {
    const type    = garment.type as ClothGarmentType;
    const physics = physicsRef.current;
    physics.initializeGarment(type, DEFAULT_SHOULDER_WIDTH);
    return () => physics.destroy();
  }, [garment.id, garment.type]);

  useFrame((_, delta) => {
    if (!groupRef.current || config.renderMode !== '3D') return;
    const dt = Math.min(delta, MAX_DELTA);

    if (landmarks) {
      const transforms = rigRef.current.computeBoneTransforms(landmarks);
      const spine       = transforms.get('Spine');
      if (spine) {
        groupRef.current.position.set(spine.position.x, spine.position.y - 0.35, spine.position.z - 2.0);
      }
      const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
      if (ls && rs) {
        physicsRef.current.updateBodyCenter(
          (ls.x + rs.x) * 0.5,
          (ls.y + rs.y) * 0.5,
          (ls.z + rs.z) * 0.5,
          dt,
        );
      }
    }

    if (config.physicsEnabled && !config.reducedMotion) {
      physicsRef.current.tickAnimatedWind(dt, 0.3);
      physicsRef.current.stepWithInertia(dt, {
        gravity: 4.0, damping: 0.98, stiffness: 50, iterations: 3,
        windEnabled: true, windDirection: { x: 1, y: 0, z: 0 }, windStrength: 0.2,
      });
      // Apply subtle inertia swing to the group
      const bv = physicsRef.current.getBodyVelocity();
      if (groupRef.current) {
        groupRef.current.rotation.z += (-bv.x * 0.004 - groupRef.current.rotation.z) * 0.08;
        groupRef.current.rotation.x += (-bv.y * 0.002 - groupRef.current.rotation.x) * 0.08;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} castShadow receiveShadow />
      {config.showSkeleton && landmarks && <SkeletonPoints landmarks={landmarks} />}
    </group>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

interface Props {
  garment:   GarmentAsset | null;
  landmarks: PoseLandmark[] | null;
  config:    Scene3DConfig;
}

/**
 * R3F component — renders a physics-driven cloth mesh OR a loaded GLB model.
 * Must be mounted inside a <Canvas> (i.e. as a child of SceneRenderer).
 */
export function ThreeGarmentOverlay({ garment, landmarks, config }: Props) {
  const deviceTier = useMemo(() => detectDeviceTier(), []);

  if (!garment || config.renderMode !== '3D') return null;

  // On LOW-tier devices without WebGL2, skip 3D entirely
  if (deviceTier === 'LOW') return null;

  return (
    <>
      {garment.modelUrl ? (
        <Garment3DModel url={garment.modelUrl} garment={garment} landmarks={landmarks} config={config} />
      ) : (
        <Garment3DCloth garment={garment} landmarks={landmarks} config={config} deviceTier={deviceTier} />
      )}
    </>
  );
}
