export type EnvironmentPreset = 'studio' | 'outdoor' | 'indoor' | 'night';
export type LightingPreset = 'soft' | 'dramatic' | 'neutral' | 'natural';
export type LODLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RenderMode = '2D' | '3D';

/** Poly-count upper bounds that trigger LOD downgrade */
export const LOD_POLY_THRESHOLDS = {
  MEDIUM: 50_000,
  LOW:   150_000,
} as const;

/** Camera-distance bounds (metres) that trigger LOD downgrade */
export const LOD_DISTANCE_THRESHOLDS = {
  MEDIUM: 2.0,
  LOW:    4.0,
} as const;

export interface LoadedModel {
  id: string;
  url: string;
  polyCount: number;
  lodLevel: LODLevel;
  hasAnimations: boolean;
  hasSkeleton: boolean;
  loadedAt: number;
  lastAccessed: number;
}

export interface PhysicsConfig {
  gravity: number;      // m/s² — default 9.8
  damping: number;      // 0–1 energy retention per step — default 0.98
  stiffness: number;    // spring stiffness — default 50
  iterations: number;   // constraint solver passes per step — default 5
  windEnabled: boolean;
  windDirection: { x: number; y: number; z: number };
  windStrength: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 9.8,
  damping: 0.98,
  stiffness: 50,
  iterations: 5,
  windEnabled: false,
  windDirection: { x: 1, y: 0, z: 0 },
  windStrength: 0,
};

export interface ConstraintData {
  indexA: number;
  indexB: number;
  restLength: number; // metres
  stiffness: number;  // 0–1 compliance factor
}

export interface BoneTransform {
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number }; // unit vector parent → child
  length: number;   // metres
}

export interface BoneMapping {
  boneName: string;
  landmarkIndex: number;
  parentBoneName: string | null;
  parentLandmarkIndex: number | null;
}

/** Mixamo-compatible bone names mapped to BlazePose landmark indices */
export const UPPER_BODY_BONE_MAP: BoneMapping[] = [
  { boneName: 'Spine',        landmarkIndex: 11, parentBoneName: null,           parentLandmarkIndex: null },
  { boneName: 'LeftArm',      landmarkIndex: 11, parentBoneName: 'Spine',        parentLandmarkIndex: 12  },
  { boneName: 'RightArm',     landmarkIndex: 12, parentBoneName: 'Spine',        parentLandmarkIndex: 11  },
  { boneName: 'LeftForeArm',  landmarkIndex: 13, parentBoneName: 'LeftArm',      parentLandmarkIndex: 11  },
  { boneName: 'RightForeArm', landmarkIndex: 14, parentBoneName: 'RightArm',     parentLandmarkIndex: 12  },
  { boneName: 'LeftHand',     landmarkIndex: 15, parentBoneName: 'LeftForeArm',  parentLandmarkIndex: 13  },
  { boneName: 'RightHand',    landmarkIndex: 16, parentBoneName: 'RightForeArm', parentLandmarkIndex: 14  },
];

export interface LightingPresetConfig {
  ambientIntensity: number;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
}

export const LIGHTING_PRESETS: Record<LightingPreset, LightingPresetConfig> = {
  soft:     { ambientIntensity: 0.8, directionalIntensity: 0.5, directionalPosition: [5,  10,  5] },
  dramatic: { ambientIntensity: 0.3, directionalIntensity: 1.5, directionalPosition: [2,   8,  2] },
  neutral:  { ambientIntensity: 0.6, directionalIntensity: 0.8, directionalPosition: [5,  10,  5] },
  natural:  { ambientIntensity: 0.9, directionalIntensity: 0.6, directionalPosition: [-5, 10,  3] },
};

export const ENVIRONMENT_PRESETS: Record<EnvironmentPreset, string> = {
  studio:  'studio',
  outdoor: 'sunset',
  indoor:  'apartment',
  night:   'night',
};

export interface Scene3DConfig {
  environment: EnvironmentPreset;
  lighting: LightingPreset;
  showSkeleton: boolean;
  physicsEnabled: boolean;
  renderMode: RenderMode;
  reducedMotion: boolean;
}

export const DEFAULT_SCENE_CONFIG: Scene3DConfig = {
  environment: 'studio',
  lighting: 'soft',
  showSkeleton: false,
  physicsEnabled: true,
  renderMode: '2D',
  reducedMotion: false,
};

// ── Physics worker message contracts ──────────────────────────────────────────

export type PhysicsWorkerInboundMessage =
  | { type: 'INIT'; payload: { config: PhysicsConfig } }
  | { type: 'SET_VERTICES'; payload: { positions: Float32Array; pinnedIndices: number[]; constraints: ConstraintData[] } }
  | { type: 'SET_BONE_POSITIONS'; payload: { bonePositions: Float32Array; pinnedIndices: number[] } }
  | { type: 'STEP'; payload: { deltaTime: number } }
  | { type: 'SET_WIND'; payload: { direction: { x: number; y: number; z: number }; strength: number } }
  | { type: 'UPDATE_CONFIG'; payload: { config: Partial<PhysicsConfig> } }
  | { type: 'DESTROY' };

export type PhysicsWorkerOutboundMessage =
  | { type: 'READY' }
  | { type: 'STEP_RESULT'; payload: { positions: Float32Array; energy: number } }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'DESTROYED' };
