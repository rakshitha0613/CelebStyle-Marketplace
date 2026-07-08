'use client';

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react';
import type { GarmentAsset, GarmentOverlayConfig, PoseLandmark } from '@/lib/ar/garment.types';
import { GarmentRenderer } from '@/lib/ar/garment-renderer';
import { GarmentAssetLoader } from '@/lib/ar/garment-asset.loader';
import {
  computeBodyMeasurements,
  computeEnhancedGarmentAlignment,
} from '@/lib/ar/garment-alignment.service';
import {
  ImagePoseService,
  buildHeuristicLandmarks,
  hasGoodUpperBodyLandmarks,
} from '@/lib/ar/image-pose.service';

interface Props {
  garment: GarmentAsset | null;
  config: GarmentOverlayConfig;
  garments: GarmentAsset[];
  onGarmentChange?: (garment: GarmentAsset) => void;
  onLandmarks?: (landmarks: PoseLandmark[] | null) => void;
  className?: string;
}

type UploadState =
  | { phase: 'EMPTY' }
  | { phase: 'LOADING_IMAGE' }
  | { phase: 'DETECTING_POSE'; imageEl: HTMLImageElement }
  | { phase: 'READY'; imageEl: HTMLImageElement; landmarks: PoseLandmark[]; isHeuristic: boolean }
  | { phase: 'ERROR'; message: string };

const renderer = new GarmentRenderer();
const assetLoader = new GarmentAssetLoader();
const poseService = new ImagePoseService();

function drawComposite(
  canvas: HTMLCanvasElement,
  imageEl: HTMLImageElement,
  garment: GarmentAsset | null,
  garmentImg: HTMLImageElement | null,
  landmarks: PoseLandmark[],
  config: GarmentOverlayConfig,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Always fit image into canvas maintaining aspect ratio
  const iw = imageEl.naturalWidth;
  const ih = imageEl.naturalHeight;
  const scale = Math.min(canvas.width / iw, canvas.height / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const offsetX = (canvas.width - drawW) / 2;
  const offsetY = (canvas.height - drawH) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageEl, offsetX, offsetY, drawW, drawH);

  if (!garment || !garmentImg || !config.visible) return;

  // Scale landmarks to the drawn image rect
  const scaledLandmarks = landmarks.map((lm) => ({
    x: offsetX / canvas.width  + lm.x * (drawW / canvas.width),
    y: offsetY / canvas.height + lm.y * (drawH / canvas.height),
    z: lm.z,
    visibility: lm.visibility,
  }));

  const measurements = computeBodyMeasurements(
    scaledLandmarks,
    canvas.width,
    canvas.height,
    config.visibilityThreshold,
  );
  if (!measurements) return;

  const alignment = computeEnhancedGarmentAlignment(
    measurements,
    garment,
    scaledLandmarks,
    canvas.width,
    canvas.height,
    config.opacity,
    config.mirrored,
    config.visibilityThreshold,
  );

  renderer.render(ctx, garmentImg, garment, alignment, config);

  if (config.debugLandmarks) {
    renderer.renderLandmarks(ctx, scaledLandmarks, canvas.width, canvas.height, 0.3);
  }
}

export function ImageUploadCanvas({
  garment,
  config,
  garments,
  onGarmentChange,
  onLandmarks,
  className,
}: Props) {
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'EMPTY' });
  const [compareMode, setCompareMode] = useState(false);
  const [garmentImg, setGarmentImg] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [poseInitError, setPoseInitError] = useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CANVAS_W = 720;
  const CANVAS_H = 960;

  // Load the pose model in background
  useEffect(() => {
    poseService.initialize().catch(() => {
      setPoseInitError(true);
    });
    return () => { poseService.destroy(); };
  }, []);

  // Load garment image whenever garment changes
  useEffect(() => {
    if (!garment) { setGarmentImg(null); return; }
    assetLoader.loadImage(garment).then(setGarmentImg).catch(() => setGarmentImg(null));
  }, [garment]);

  // Re-draw canvas whenever garment, garmentImg, or config changes
  useEffect(() => {
    if (uploadState.phase !== 'READY') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (compareMode) return; // compare mode shows original
    drawComposite(canvas, uploadState.imageEl, garment, garmentImg, uploadState.landmarks, config);
  }, [uploadState, garment, garmentImg, config, compareMode]);

  const runPoseDetection = useCallback(async (imageEl: HTMLImageElement): Promise<PoseLandmark[]> => {
    let detected: PoseLandmark[] | null = null;

    if (!poseInitError) {
      try {
        if (!poseService.isReady) await poseService.initialize();
        detected = poseService.detect(imageEl);
      } catch {
        detected = null;
      }
    }

    const heuristic = buildHeuristicLandmarks(imageEl.naturalWidth, imageEl.naturalHeight);

    if (detected && hasGoodUpperBodyLandmarks(detected)) {
      return detected;
    }
    return heuristic;
  }, [poseInitError]);

  const processImage = useCallback(async (file: File) => {
    setUploadState({ phase: 'LOADING_IMAGE' });

    const url = URL.createObjectURL(file);
    const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    }).catch((e) => { throw e; });

    URL.revokeObjectURL(url);

    setUploadState({ phase: 'DETECTING_POSE', imageEl });

    const landmarks = await runPoseDetection(imageEl);
    const isHeuristic = !hasGoodUpperBodyLandmarks(landmarks);

    onLandmarks?.(landmarks);

    setUploadState({ phase: 'READY', imageEl, landmarks, isHeuristic });

    // Draw immediately
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      drawComposite(canvas, imageEl, garment, garmentImg, landmarks, config);
    }
  }, [runPoseDetection, garment, garmentImg, config, onLandmarks]);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadState({ phase: 'ERROR', message: 'Please upload an image file (JPEG, PNG, WEBP).' });
      return;
    }
    processImage(file).catch(() => {
      setUploadState({ phase: 'ERROR', message: 'Failed to process image. Please try another file.' });
    });
  }, [processImage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = '';
  }, [handleFile]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  }, [handleFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || uploadState.phase !== 'READY') return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `celebstyle-tryon-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [uploadState]);

  const handleCompareToggle = useCallback(() => {
    if (uploadState.phase !== 'READY') return;
    setCompareMode((prev) => {
      const next = !prev;
      const canvas = canvasRef.current;
      if (!canvas) return next;

      if (next) {
        // Show original image
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { imageEl } = uploadState;
          const iw = imageEl.naturalWidth;
          const ih = imageEl.naturalHeight;
          const scale = Math.min(CANVAS_W / iw, CANVAS_H / ih);
          const drawW = iw * scale;
          const drawH = ih * scale;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imageEl, (CANVAS_W - drawW) / 2, (CANVAS_H - drawH) / 2, drawW, drawH);
        }
      } else {
        // Show with garment
        drawComposite(canvas, uploadState.imageEl, garment, garmentImg, uploadState.landmarks, config);
      }
      return next;
    });
  }, [uploadState, garment, garmentImg, config]);

  const handleReset = useCallback(() => {
    setUploadState({ phase: 'EMPTY' });
    setCompareMode(false);
    onLandmarks?.(null);
  }, [onLandmarks]);

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      {/* Main canvas / upload area */}
      <div
        className={`relative overflow-hidden bg-black rounded-2xl aspect-[3/4] w-full ${isDragging ? 'ring-2 ring-white/60' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="region"
        aria-label="Image Upload Try-On"
      >
        {/* Empty state */}
        {uploadState.phase === 'EMPTY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl">
              🖼️
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Upload a Photo</p>
              <p className="text-white/50 text-sm mt-1">
                Full-body photo works best
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 transition-colors"
            >
              Choose Photo
            </button>
            <p className="text-white/30 text-xs">or drag & drop here</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleInputChange}
              aria-label="Upload photo for try-on"
            />
          </div>
        )}

        {/* Loading image */}
        {uploadState.phase === 'LOADING_IMAGE' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
            <div className="w-10 h-10 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Loading image…</p>
          </div>
        )}

        {/* Detecting pose */}
        {uploadState.phase === 'DETECTING_POSE' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
            <div className="w-10 h-10 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Detecting body…</p>
            <p className="text-white/40 text-xs">Powered by on-device AI</p>
          </div>
        )}

        {/* Canvas (shown in READY state) */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            uploadState.phase === 'READY' ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Try-on preview"
        />

        {/* Heuristic warning badge */}
        {uploadState.phase === 'READY' && uploadState.isHeuristic && !compareMode && (
          <div className="absolute top-3 left-3 bg-yellow-500/90 text-black text-xs font-medium px-2 py-1 rounded-lg">
            Auto-fitted (no pose detected)
          </div>
        )}

        {/* Compare mode badge */}
        {uploadState.phase === 'READY' && compareMode && (
          <div className="absolute top-3 left-0 right-0 flex justify-center">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
              Original
            </span>
          </div>
        )}

        {/* Error state */}
        {uploadState.phase === 'ERROR' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
            <p className="text-red-400 text-sm">{uploadState.message}</p>
            <button
              onClick={handleReset}
              className="px-5 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Hidden file input for reset state */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleInputChange}
          aria-label="Upload photo"
        />
      </div>

      {/* Action bar — shown only when READY */}
      {uploadState.phase === 'READY' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            Change Photo
          </button>
          <button
            onClick={handleCompareToggle}
            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-colors ${
              compareMode
                ? 'bg-white text-black'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {compareMode ? 'Show Outfit' : 'Compare'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            ↓ Download
          </button>
        </div>
      )}

      {/* Outfit switcher strip */}
      {uploadState.phase === 'READY' && garments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {garments.slice(0, 12).map((g) => (
            <button
              key={g.id}
              onClick={() => onGarmentChange?.(g)}
              title={g.name}
              className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                garment?.id === g.id
                  ? 'border-white scale-110'
                  : 'border-white/20 hover:border-white/50'
              }`}
            >
              <img
                src={g.imageUrl}
                alt={g.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://via.placeholder.com/56x56/222/555?text=👗';
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
