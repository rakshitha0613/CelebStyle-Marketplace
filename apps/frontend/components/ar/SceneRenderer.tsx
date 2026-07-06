'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import type { LightingPreset, EnvironmentPreset } from '@/lib/ar/three.types';
import { LIGHTING_PRESETS, ENHANCED_LIGHTING_PRESETS, ENVIRONMENT_PRESETS } from '@/lib/ar/three.types';

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
  const lightCfg  = LIGHTING_PRESETS[lighting];
  const enhanced  = ENHANCED_LIGHTING_PRESETS[lighting];
  const envPreset = ENVIRONMENT_PRESETS[environment] as 'studio' | 'sunset' | 'apartment' | 'night';

  return (
    <Canvas
      gl={{ alpha: true, antialias: true, toneMappingExposure: enhanced.exposure.exposure }}
      style={{ background: 'transparent' }}
      dpr={[1, 2]}
      shadows
    >
      <Suspense fallback={null}>
        <PerspectiveCamera makeDefault position={[0, 0, 2]} fov={60} near={0.01} far={100} />

        <ambientLight intensity={lightCfg.ambientIntensity} />

        {/* Key light */}
        <directionalLight
          position={lightCfg.directionalPosition}
          intensity={lightCfg.directionalIntensity}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Fill light — softens shadows, improves garment shading realism */}
        <directionalLight
          position={enhanced.fillLight.position}
          intensity={enhanced.fillLight.intensity}
          color={enhanced.fillLight.color}
        />

        {/* Rim / back light for depth separation */}
        <directionalLight position={[-2, 0, -2]} intensity={0.4} />
        <pointLight position={[0, 2, 1]} intensity={0.5} />

        <Environment preset={envPreset} />

        {children}
      </Suspense>
    </Canvas>
  );
}
