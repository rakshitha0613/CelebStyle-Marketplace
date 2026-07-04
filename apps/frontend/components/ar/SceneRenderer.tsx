'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import type { LightingPreset, EnvironmentPreset } from '@/lib/ar/three.types';
import { LIGHTING_PRESETS, ENVIRONMENT_PRESETS } from '@/lib/ar/three.types';

interface Props {
  children?:    React.ReactNode;
  lighting?:    LightingPreset;
  environment?: EnvironmentPreset;
}

export function SceneRenderer({
  children,
  lighting    = 'soft',
  environment = 'studio',
}: Props) {
  const lightCfg = LIGHTING_PRESETS[lighting];
  const envPreset = ENVIRONMENT_PRESETS[environment] as 'studio' | 'sunset' | 'apartment' | 'night';

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
      dpr={[1, 2]}
      shadows
    >
      <Suspense fallback={null}>
        <PerspectiveCamera makeDefault position={[0, 0, 2]} fov={60} near={0.01} far={100} />

        <ambientLight intensity={lightCfg.ambientIntensity} />
        <directionalLight
          position={lightCfg.directionalPosition}
          intensity={lightCfg.directionalIntensity}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-2, 0, -2]} intensity={0.4} />
        <pointLight position={[0, 2, 1]} intensity={0.5} />

        <Environment preset={envPreset} />

        {children}
      </Suspense>
    </Canvas>
  );
}
