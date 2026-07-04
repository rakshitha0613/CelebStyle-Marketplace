import type {
  OverlayWorkerOutboundMessage,
  OverlayWorkerInboundMessage,
  GarmentAsset,
  PoseLandmark,
  GarmentOverlayConfig,
} from '../lib/ar/garment.types.js';
import {
  computeBodyMeasurements,
  computeGarmentAlignment,
} from '../lib/ar/garment-alignment.service.js';

// Cast self to avoid dom/webworker lib conflicts
const ctx = self as unknown as {
  addEventListener(type: string, handler: (e: MessageEvent) => void): void;
  postMessage(msg: unknown): void;
};

let visibilityThreshold = 0.5;

function post(msg: OverlayWorkerOutboundMessage): void {
  ctx.postMessage(msg);
}

ctx.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as OverlayWorkerInboundMessage;

  switch (msg.type) {
    case 'INIT':
      visibilityThreshold = msg.payload.visibilityThreshold;
      post({ type: 'READY' });
      break;

    case 'ALIGN_GARMENT':
      handleAlign(
        msg.payload.landmarks,
        msg.payload.garment,
        msg.payload.canvasWidth,
        msg.payload.canvasHeight,
        msg.payload.config,
      );
      break;

    case 'DESTROY':
      post({ type: 'DESTROYED' });
      break;
  }
});

function handleAlign(
  landmarks: PoseLandmark[],
  garment: GarmentAsset,
  canvasWidth: number,
  canvasHeight: number,
  config: GarmentOverlayConfig,
): void {
  try {
    const measurements = computeBodyMeasurements(
      landmarks,
      canvasWidth,
      canvasHeight,
      visibilityThreshold,
    );

    if (!measurements) {
      post({ type: 'INVISIBLE', payload: { reason: 'Shoulders not confidently detected' } });
      return;
    }

    const alignment = computeGarmentAlignment(
      measurements,
      garment,
      config.opacity,
      config.mirrored,
      visibilityThreshold,
    );

    if (!alignment.visible) {
      post({ type: 'INVISIBLE', payload: { reason: 'Landmark visibility below threshold' } });
      return;
    }

    post({ type: 'ALIGNMENT_RESULT', payload: { alignment, measurements } });
  } catch (err) {
    post({ type: 'ERROR', payload: { message: String(err) } });
  }
}
