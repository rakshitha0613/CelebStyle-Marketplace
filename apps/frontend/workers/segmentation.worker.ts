import type { SegmentationConfig, WorkerOutboundMessage } from '../lib/ar/types.js';

const MEDIAPIPE_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/image_segmenter';

// Cast self to the worker scope — avoids dom/webworker lib conflicts in tsconfig
const ctx = self as unknown as {
  addEventListener(type: string, handler: (e: MessageEvent) => void): void;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenter: any = null;
let ready = false;
let config: SegmentationConfig | null = null;

function post(msg: WorkerOutboundMessage, transfer?: Transferable[]): void {
  ctx.postMessage(msg, transfer);
}

ctx.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data as { type: string; payload: unknown };
  switch (type) {
    case 'INIT': void handleInit(payload as SegmentationConfig); break;
    case 'SEGMENT': void handleSegment(payload as { frame: ImageBitmap; timestamp: number }); break;
    case 'DESTROY': handleDestroy(); break;
  }
});

async function handleInit(cfg: SegmentationConfig): Promise<void> {
  config = cfg;
  try {
    const { ImageSegmenter, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);

    const modelUrl = cfg.modelType === 'landscape'
      ? `${MODEL_BASE}/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite`
      : `${MODEL_BASE}/selfie_segmenter/float16/latest/selfie_segmenter.tflite`;

    segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      outputCategoryMask: false,
      outputConfidenceMasks: true,
      runningMode: 'VIDEO',
    });

    ready = true;
    post({ type: 'READY' });
  } catch (err) {
    post({ type: 'ERROR', payload: { message: String(err) } });
  }
}

async function handleSegment({
  frame,
  timestamp,
}: {
  frame: ImageBitmap;
  timestamp: number;
}): Promise<void> {
  if (!ready || !segmenter || !config) {
    frame.close();
    return;
  }

  const start = Date.now();
  try {
    const result = segmenter.segmentForVideo(frame, timestamp);
    const masks = result.confidenceMasks;

    if (!masks?.length) {
      frame.close();
      result.close?.();
      return;
    }

    const cm = masks[0];
    const { width, height } = cm;
    const raw = cm.getAsFloat32Array() as Float32Array;

    const maskData = new Uint8ClampedArray(raw.length);
    const threshold = config.confidenceThreshold;
    for (let i = 0; i < raw.length; i++) {
      maskData[i] = raw[i] >= threshold ? 255 : 0;
    }

    cm.close?.();
    result.close?.();
    frame.close();

    post(
      { type: 'MASK', payload: { data: maskData.buffer, width, height, timestamp, latencyMs: Date.now() - start } },
      [maskData.buffer],
    );
  } catch (err) {
    frame.close();
    post({ type: 'ERROR', payload: { message: String(err) } });
  }
}

function handleDestroy(): void {
  segmenter?.close?.();
  segmenter = null;
  ready = false;
  post({ type: 'DESTROYED' });
}
