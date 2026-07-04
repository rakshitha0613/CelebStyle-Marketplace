export type BackgroundMode = 'NONE' | 'BLUR' | 'REPLACE' | 'TRANSPARENT';
export type ARTier = 'FULL' | 'MID' | 'LITE' | 'STATIC';
export type ModelType = 'portrait' | 'landscape';
export type InitStatus = 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'ERROR';

export interface MaskData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  confidence: number;
  timestamp: number;
}

export interface FrameMetrics {
  fps: number;
  latencyMs: number;
  segmentationMs: number;
  renderMs: number;
  droppedFrames: number;
}

export interface SegmentationConfig {
  modelType: ModelType;
  confidenceThreshold: number;
  smoothingFactor: number;
  runEveryNFrames: number;
}

export interface BackgroundConfig {
  mode: BackgroundMode;
  blurStrength: number;
  replacementImageUrl?: string;
  color?: string;
}

export interface ARConfig {
  segmentation: SegmentationConfig;
  background: BackgroundConfig;
  targetFPS: number;
  debugMode: boolean;
  tier: ARTier;
}

export type WorkerInboundMessage =
  | { type: 'INIT'; payload: SegmentationConfig }
  | { type: 'SEGMENT'; payload: { frame: ImageBitmap; timestamp: number } }
  | { type: 'DESTROY' };

export type WorkerOutboundMessage =
  | { type: 'READY' }
  | { type: 'MASK'; payload: { data: ArrayBuffer; width: number; height: number; timestamp: number; latencyMs: number } }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'DESTROYED' };
