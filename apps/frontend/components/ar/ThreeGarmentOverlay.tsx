'use client';

import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PoseLandmark } from '@/lib/ar/garment.types';
import type { GarmentAsset } from '@/lib/ar/garment.types';
import type { Scene3DConfig } from '@/lib/ar/three.types';
import { DEFAULT_PHYSICS_CONFIG } from '@/lib/ar/three.types';
import { POSE_LANDMARKS } from '@/lib/ar/garment.types';
import { GarmentRigService } from '@/lib/ar/garment-rig.service';
import { GarmentPhysicsService } from '@/lib/ar/garment-physics.service';

const MAX_DELTA = 0.033; // cap at ~30 fps minimum

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
          <mesh
            key={idx}
            position={[(lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, 0]}
          >
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#00ff64" transparent opacity={lm.visibility} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Placeholder geometry when no GLB is available ─────────────────────────────

interface SharedProps {
  landmarks:      PoseLandmark[] | null;
  config:         Scene3DConfig;
  rigService:     GarmentRigService;
  physicsService: GarmentPhysicsService;
}

function Garment3DPlaceholder({
  garment,
  landmarks,
  config,
  rigService,
  physicsService,
}: SharedProps & { garment: GarmentAsset }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current || config.renderMode !== '3D') return;

    if (landmarks) {
      const transforms = rigService.computeBoneTransforms(landmarks);
      const spine = transforms.get('Spine');
      if (spine) {
        groupRef.current.position.set(
          spine.position.x,
          spine.position.y - 0.35,
          spine.position.z - 2.0,
        );
      }
    }

    if (config.physicsEnabled && !config.reducedMotion) {
      const dt = Math.min(delta, MAX_DELTA);
      physicsService.tickAnimatedWind(dt, 0.5);
      if (landmarks) {
        const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (ls && rs) {
          physicsService.updateBodyCenter(
            (ls.x + rs.x) * 0.5,
            (ls.y + rs.y) * 0.5,
            (ls.z + rs.z) * 0.5,
            dt,
          );
        }
      }
      physicsService.stepWithInertia(dt, DEFAULT_PHYSICS_CONFIG);
    }
  });

  const color =
    garment.type === 'JACKET'  ? '#111827' :
    garment.type === 'HOODIE'  ? '#6b7280' :
    garment.type === 'SHIRT'   ? '#1e40af' :
                                 '#f8f8f8'; // T_SHIRT

  return (
    <group ref={groupRef}>
      {/* Torso panel */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.65, 0.06]} />
        <meshStandardMaterial
          color={color}
          roughness={0.75}
          metalness={0.0}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Left sleeve */}
      <mesh
        position={[-0.36, 0.06, 0]}
        rotation={[0, 0, Math.PI / 9]}
        castShadow
      >
        <boxGeometry args={[0.14, 0.36, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.75} transparent opacity={0.88} />
      </mesh>

      {/* Right sleeve */}
      <mesh
        position={[0.36, 0.06, 0]}
        rotation={[0, 0, -Math.PI / 9]}
        castShadow
      >
        <boxGeometry args={[0.14, 0.36, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.75} transparent opacity={0.88} />
      </mesh>

      {/* Collar strip */}
      <mesh position={[0, 0.35, 0.04]}>
        <boxGeometry args={[0.18, 0.08, 0.01]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {config.showSkeleton && landmarks && (
        <SkeletonPoints landmarks={landmarks} />
      )}
    </group>
  );
}

// ── Real GLB model (loaded via useGLTF) ───────────────────────────────────────

function Garment3DModel({
  url,
  garment,
  landmarks,
  config,
  rigService,
  physicsService,
}: SharedProps & { url: string; garment: GarmentAsset }) {
  // Lazy-load useGLTF to keep this component out of the initial bundle
  // useGLTF is called at component level — safe because this component only
  // mounts when modelUrl is truthy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGLTF } = require('@react-three/drei') as { useGLTF: (url: string) => { scene: THREE.Group } };
  const { scene } = useGLTF(url);
  const groupRef  = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current || config.renderMode !== '3D') return;

    if (landmarks) {
      const transforms = rigService.computeBoneTransforms(landmarks);
      const spine = transforms.get('Spine');
      if (spine) {
        groupRef.current.position.set(
          spine.position.x,
          spine.position.y - 0.35,
          spine.position.z - 2.0,
        );
      }
    }

    if (config.physicsEnabled && !config.reducedMotion) {
      const dt = Math.min(delta, MAX_DELTA);
      physicsService.tickAnimatedWind(dt, 0.5);
      if (landmarks) {
        const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (ls && rs) {
          physicsService.updateBodyCenter(
            (ls.x + rs.x) * 0.5,
            (ls.y + rs.y) * 0.5,
            (ls.z + rs.z) * 0.5,
            dt,
          );
        }
      }
      physicsService.stepWithInertia(dt, DEFAULT_PHYSICS_CONFIG);
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
 * R3F component — must be rendered inside a <Canvas> (i.e. as a child of
 * SceneRenderer). Switches between a placeholder geometry and a loaded GLB
 * depending on whether garment.modelUrl is set.
 */
export function ThreeGarmentOverlay({ garment, landmarks, config }: Props) {
  const rigRef     = useRef(new GarmentRigService());
  const physicsRef = useRef(new GarmentPhysicsService());

  // Hooks must be called unconditionally — early return comes after
  if (!garment || config.renderMode !== '3D') return null;

  const sharedProps: SharedProps = {
    landmarks,
    config,
    rigService:     rigRef.current,
    physicsService: physicsRef.current,
  };

  return (
    <Suspense fallback={null}>
      {garment.modelUrl ? (
        <Garment3DModel url={garment.modelUrl} garment={garment} {...sharedProps} />
      ) : (
        <Garment3DPlaceholder garment={garment} {...sharedProps} />
      )}
    </Suspense>
  );
}
