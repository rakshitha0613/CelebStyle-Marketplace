export type CameraFacingMode = 'user' | 'environment';
export type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'CAMERA_IN_USE'
  | 'CONSTRAINT_ERROR'
  | 'UNKNOWN';

export function isGetUserMediaSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export function isOffscreenCanvasSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function detectARTier(): 'FULL' | 'MID' | 'LITE' | 'STATIC' {
  if (!isGetUserMediaSupported()) return 'STATIC';
  if (!isWebGLSupported()) return 'LITE';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 2) return 'LITE';
  const cores = navigator.hardwareConcurrency ?? 2;
  if (cores < 4) return 'MID';
  return 'FULL';
}

export function buildVideoConstraints(
  facingMode: CameraFacingMode,
  targetWidth = 1280,
  targetHeight = 720,
): MediaTrackConstraints {
  return {
    facingMode,
    width: { ideal: targetWidth },
    height: { ideal: targetHeight },
    frameRate: { ideal: 30, max: 60 },
  };
}

export function detectOptimalFacingMode(): CameraFacingMode {
  return 'user';
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function getVideoResolution(video: HTMLVideoElement): { width: number; height: number } {
  return {
    width: video.videoWidth || video.width,
    height: video.videoHeight || video.height,
  };
}

export function classifyCameraError(error: unknown): CameraErrorCode {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'PERMISSION_DENIED';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'NO_CAMERA';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'CAMERA_IN_USE';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'CONSTRAINT_ERROR';
      default:
        return 'UNKNOWN';
    }
  }
  return 'UNKNOWN';
}
