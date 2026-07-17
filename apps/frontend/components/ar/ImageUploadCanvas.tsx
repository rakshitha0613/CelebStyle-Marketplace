'use client';

import { useState, useRef, useCallback, useEffect, DragEvent } from 'react';
import type { GarmentAsset, GarmentOverlayConfig, PoseLandmark, GarmentType } from '@/lib/ar/garment.types';
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
import { generateAITryOn, AITryOnDeploymentError } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max display-canvas dimensions. The canvas is sized proportionally to fit. */
const MAX_CANVAS_W = 720;
const MAX_CANVAS_H = 960;

/** Max dimension for the image sent to the AI model. */
const AI_CAPTURE_MAX_DIM = 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

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

type AIPhase =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'done'; resultUrl: string }
  | { phase: 'error'; message: string; deploymentRequired?: boolean; instructions?: string[] };

// ── Module-level singletons ───────────────────────────────────────────────────

const renderer = new GarmentRenderer();
const assetLoader = new GarmentAssetLoader();
const poseService = new ImagePoseService();

// ── Helpers ───────────────────────────────────────────────────────────────────

function garmentTypeToVtonCategory(type: GarmentType): 'upper_body' | 'lower_body' | 'dresses' {
  if (type === 'DRESS' || type === 'SAREE' || type === 'LEHENGA') return 'dresses';
  return 'upper_body';
}

/**
 * Decodes a File into an EXIF-orientation-corrected ImageBitmap.
 * createImageBitmap with imageOrientation:'from-image' is supported in
 * Chrome 52+, Firefox 93+, Safari 15.4+.  Falls back to plain decode
 * (which may be rotated on very old Safari) when the option is rejected.
 */
async function decodeBitmapCorrected(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/**
 * Creates an HTMLImageElement from a corrected ImageBitmap.
 * The pose-detection service and garment renderer both need an HTMLImageElement;
 * this bridges from the EXIF-corrected bitmap.
 */
async function bitmapToImageEl(bitmap: ImageBitmap): Promise<HTMLImageElement> {
  const off = document.createElement('canvas');
  off.width = bitmap.width;
  off.height = bitmap.height;
  off.getContext('2d')!.drawImage(bitmap, 0, 0);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to create image element'));
    // Use a reasonable quality — this is only for display + pose detection
    img.src = off.toDataURL('image/jpeg', 0.92);
  });
}

/**
 * Captures the EXIF-corrected bitmap as a JPEG data-URI suitable for the
 * AI try-on API.  Scales down to AI_CAPTURE_MAX_DIM on the longest side to
 * keep the payload under the server's 5 MB body limit.
 */
function captureJpegForAI(bitmap: ImageBitmap): string {
  const scale = Math.min(AI_CAPTURE_MAX_DIM / bitmap.width, AI_CAPTURE_MAX_DIM / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  tmp.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return tmp.toDataURL('image/jpeg', 0.90);
}

/**
 * Draws the garment overlay composite onto the canvas.
 * imageEl must already be EXIF-corrected (produced by bitmapToImageEl).
 * The canvas dimensions are set by the caller to match the image aspect ratio,
 * so the image always fills the canvas exactly — no black bars, no stretching.
 */
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

  // Draw base image filling the entire canvas (canvas is already aspect-ratio matched)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

  if (!garment || !garmentImg || !config.visible) return;

  // Landmarks from the pose service are 0–1 normalised relative to imageEl.
  // Since imageEl exactly fills the canvas, no additional scaling is needed.
  const measurements = computeBodyMeasurements(
    landmarks,
    canvas.width,
    canvas.height,
    config.visibilityThreshold,
  );
  if (!measurements) return;

  const alignment = computeEnhancedGarmentAlignment(
    measurements,
    garment,
    landmarks,
    canvas.width,
    canvas.height,
    config.opacity,
    config.mirrored,
    config.visibilityThreshold,
  );

  renderer.render(ctx, garmentImg, garment, alignment, config);

  if (config.debugLandmarks) {
    renderer.renderLandmarks(ctx, landmarks, canvas.width, canvas.height, 0.3);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageUploadCanvas({
  garment,
  config,
  garments,
  onGarmentChange,
  onLandmarks,
  className,
}: Props) {
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'EMPTY' });
  const [aiPhase, setAiPhase] = useState<AIPhase>({ phase: 'idle' });
  const [compareMode, setCompareMode] = useState(false);
  const [garmentImg, setGarmentImg] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [poseInitError, setPoseInitError] = useState(false);
  // Outfit IDs whose garment.webp failed to load (404 / decode failure) —
  // tracked per-outfit so the switcher strip and AI Generate gating never
  // fall back to a fake "?" placeholder, a source photo, or a celebrity image.
  const [notReadyIds, setNotReadyIds] = useState<Set<string>>(new Set());

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stores the EXIF-corrected ImageBitmap so we can capture it at high
  // quality for the AI call without re-reading the file.
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const isAIResult = aiPhase.phase === 'done';
  const isGenerating = aiPhase.phase === 'generating';

  // ── Initialise pose service ────────────────────────────────────────────────

  useEffect(() => {
    poseService.initialize().catch(() => setPoseInitError(true));
    return () => { poseService.destroy(); };
  }, []);

  // ── Load garment image ─────────────────────────────────────────────────────
  // assetLoader never rejects — on a real failure it resolves with the shared
  // "?" placeholder or a 1×1 blank image instead. Detect that here so this
  // component can show its own explicit not-ready state rather than silently
  // compositing a fake garment onto the canvas.

  useEffect(() => {
    if (!garment) { setGarmentImg(null); return; }
    let cancelled = false;
    assetLoader.loadImage(garment).then((img) => {
      if (cancelled) return;
      const failed = img.naturalWidth <= 1 || img.src.includes('/assets/garments/placeholder.png');
      setGarmentImg(failed ? null : img);
      setNotReadyIds((prev) => {
        if (failed === prev.has(garment.id)) return prev;
        const next = new Set(prev);
        if (failed) next.add(garment.id); else next.delete(garment.id);
        return next;
      });
    }).catch(() => setGarmentImg(null));
    return () => { cancelled = true; };
  }, [garment]);

  const garmentReady = garment !== null && !notReadyIds.has(garment.id);

  // ── Redraw overlay when garment / config changes ───────────────────────────

  useEffect(() => {
    if (uploadState.phase !== 'READY') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (compareMode) return;    // compare mode shows original — don't redraw with overlay
    if (isAIResult) return;     // AI result is shown instead of the overlay canvas
    drawComposite(canvas, uploadState.imageEl, garment, garmentImg, uploadState.landmarks, config);
  }, [uploadState, garment, garmentImg, config, compareMode, isAIResult]);

  // ── Pose detection ─────────────────────────────────────────────────────────

  const runPoseDetection = useCallback(async (imageEl: HTMLImageElement): Promise<PoseLandmark[]> => {
    if (!poseInitError) {
      try {
        if (!poseService.isReady) await poseService.initialize();
        const detected = poseService.detect(imageEl);
        if (detected && hasGoodUpperBodyLandmarks(detected)) return detected;
      } catch { /* fall through to heuristic */ }
    }
    return buildHeuristicLandmarks(imageEl.naturalWidth, imageEl.naturalHeight);
  }, [poseInitError]);

  // ── Image processing ───────────────────────────────────────────────────────

  const processImage = useCallback(async (file: File) => {
    setUploadState({ phase: 'LOADING_IMAGE' });
    setAiPhase({ phase: 'idle' });
    setCompareMode(false);

    // 1. Decode with EXIF orientation correction
    let bitmap: ImageBitmap;
    try {
      bitmap = await decodeBitmapCorrected(file);
    } catch {
      setUploadState({ phase: 'ERROR', message: 'Could not decode image. Please try a JPEG or PNG file.' });
      return;
    }
    bitmapRef.current = bitmap;

    // 2. Create HTMLImageElement for pose detection and garment rendering
    let imageEl: HTMLImageElement;
    try {
      imageEl = await bitmapToImageEl(bitmap);
    } catch {
      setUploadState({ phase: 'ERROR', message: 'Failed to process image.' });
      return;
    }

    // 3. Pose detection
    setUploadState({ phase: 'DETECTING_POSE', imageEl });
    const landmarks = await runPoseDetection(imageEl);
    const isHeuristic = !hasGoodUpperBodyLandmarks(landmarks);
    onLandmarks?.(landmarks);

    setUploadState({ phase: 'READY', imageEl, landmarks, isHeuristic });

    // 4. Draw to canvas — set canvas dimensions to match the corrected image
    //    aspect ratio (bounded by MAX_CANVAS_W × MAX_CANVAS_H).
    //    This eliminates stretching and correctly reflects the orientation.
    const canvas = canvasRef.current;
    if (canvas) {
      const scale = Math.min(MAX_CANVAS_W / bitmap.width, MAX_CANVAS_H / bitmap.height, 1);
      canvas.width  = Math.round(bitmap.width  * scale);
      canvas.height = Math.round(bitmap.height * scale);
      drawComposite(canvas, imageEl, garment, garmentImg, landmarks, config);
    }
  }, [runPoseDetection, garment, garmentImg, config, onLandmarks]);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadState({ phase: 'ERROR', message: 'Please upload an image file (JPEG, PNG, WEBP).' });
      return;
    }
    processImage(file).catch(() =>
      setUploadState({ phase: 'ERROR', message: 'Failed to process image. Please try another file.' }),
    );
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

  const handleDragOver  = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleReset = useCallback(() => {
    setUploadState({ phase: 'EMPTY' });
    setAiPhase({ phase: 'idle' });
    setCompareMode(false);
    bitmapRef.current = null;
    onLandmarks?.(null);
  }, [onLandmarks]);

  // ── Download (overlay canvas) ──────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || uploadState.phase !== 'READY') return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `celebstyle-overlay-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [uploadState]);

  // ── Compare toggle ─────────────────────────────────────────────────────────

  const handleCompareToggle = useCallback(() => {
    if (uploadState.phase !== 'READY') return;
    setCompareMode((prev) => {
      const next = !prev;
      const canvas = canvasRef.current;
      if (!canvas) return next;
      if (next) {
        // Show original (no overlay)
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(uploadState.imageEl, 0, 0, canvas.width, canvas.height);
      } else {
        drawComposite(canvas, uploadState.imageEl, garment, garmentImg, uploadState.landmarks, config);
      }
      return next;
    });
  }, [uploadState, garment, garmentImg, config]);

  // ── AI Virtual Try-On ──────────────────────────────────────────────────────

  const handleAIGenerate = useCallback(async () => {
    if (uploadState.phase !== 'READY') return;
    if (!garment) return;
    if (!garmentReady) return;
    if (!bitmapRef.current) return;

    setAiPhase({ phase: 'generating' });
    setCompareMode(false);

    const userImageBase64 = captureJpegForAI(bitmapRef.current);
    if (!userImageBase64) {
      setAiPhase({ phase: 'error', message: 'Could not capture image from canvas.' });
      return;
    }

    // The backend fetches this server-side and must be able to reach it —
    // garment.imageUrl is a path on THIS frontend origin (Next.js public/),
    // not the API origin, so it must be resolved to an absolute URL here.
    const absoluteGarmentUrl = new URL(garment.imageUrl, window.location.origin).toString();

    try {
      const result = await generateAITryOn({
        userImageBase64,
        garmentImageUrl: absoluteGarmentUrl,
        category: garmentTypeToVtonCategory(garment.type),
        garmentDescription: garment.name,
      });
      setAiPhase({ phase: 'done', resultUrl: result.resultUrl });
    } catch (err: unknown) {
      if (err instanceof AITryOnDeploymentError) {
        setAiPhase({
          phase: 'error',
          message: err.message,
          deploymentRequired: true,
          instructions: err.instructions,
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setAiPhase({ phase: 'error', message: msg });
      }
    }
  }, [uploadState, garment, garmentReady]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const showCanvas = uploadState.phase === 'READY' && !isAIResult;

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>

      {/* ── Main viewport ───────────────────────────────────────────────────── */}
      <div
        className={`relative overflow-hidden bg-black rounded-2xl w-full ${
          // Fixed aspect ratio only while no image is loaded; once an image is
          // ready the canvas or AI image sets the natural height.
          uploadState.phase !== 'READY' ? 'aspect-[3/4]' : ''
        } ${isDragging ? 'ring-2 ring-white/60' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="region"
        aria-label="Image Upload Try-On"
      >
        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {uploadState.phase === 'EMPTY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl">🖼️</div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Upload a Photo</p>
              <p className="text-white/50 text-sm mt-1">Full-body photo works best</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2.5 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 transition-colors"
            >
              Choose Photo
            </button>
            <p className="text-white/30 text-xs">or drag &amp; drop here</p>
          </div>
        )}

        {/* ── Loading / pose detection ─────────────────────────────────────── */}
        {(uploadState.phase === 'LOADING_IMAGE' || uploadState.phase === 'DETECTING_POSE') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
            <div className="w-10 h-10 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">
              {uploadState.phase === 'LOADING_IMAGE' ? 'Loading image…' : 'Detecting body pose…'}
            </p>
            {uploadState.phase === 'DETECTING_POSE' && (
              <p className="text-white/40 text-xs">Powered by on-device AI</p>
            )}
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────────── */}
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

        {/* ── Overlay canvas ───────────────────────────────────────────────── */}
        {/* Always rendered so the ref stays attached; hidden when AI result or
            not yet loaded. CSS width:100%/height:auto lets the canvas control
            its own aspect ratio — no CSS stretching. */}
        <canvas
          ref={canvasRef}
          className="block w-full"
          style={{
            height: 'auto',
            display: showCanvas ? 'block' : 'none',
          }}
          aria-label="Garment overlay preview"
        />

        {/* Heuristic warning badge */}
        {uploadState.phase === 'READY' && uploadState.isHeuristic && showCanvas && !compareMode && (
          <div className="absolute top-3 left-3 bg-yellow-500/90 text-black text-xs font-medium px-2 py-1 rounded-lg">
            Auto-fitted (no pose detected)
          </div>
        )}

        {/* Garment not Try-On ready — never fall back to the "?" placeholder,
            a source photo, or a celebrity/banner image. */}
        {uploadState.phase === 'READY' && garment && !garmentReady && showCanvas && !compareMode && (
          <div className="absolute inset-x-3 bottom-3 bg-black/80 backdrop-blur-sm text-white/90 text-xs font-medium px-3 py-2 rounded-lg text-center">
            This outfit does not yet have a Virtual Try-On ready garment image.
          </div>
        )}

        {compareMode && showCanvas && (
          <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
              Original
            </span>
          </div>
        )}

        {/* ── AI Result image ──────────────────────────────────────────────── */}
        {/* Replaces the overlay canvas when generation succeeds. */}
        {isAIResult && aiPhase.phase === 'done' && (
          <img
            src={aiPhase.resultUrl}
            alt={`AI Virtual Try-On wearing ${garment?.name ?? 'outfit'}`}
            className="block w-full"
            style={{ height: 'auto' }}
          />
        )}

        {/* AI result badge */}
        {isAIResult && (
          <div className="absolute top-3 left-3">
            <span className="bg-purple-600/90 text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1">
              ✨ IDM-VTON Result
            </span>
          </div>
        )}

        {/* ── Generating overlay ───────────────────────────────────────────── */}
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 backdrop-blur-sm">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
              <div className="absolute inset-1 border-2 border-transparent border-b-pink-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <div className="text-center px-6">
              <p className="text-white font-semibold text-sm">Generating AI Try-On…</p>
              <p className="text-white/50 text-xs mt-1">IDM-VTON diffusion model · 30–90 s</p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleInputChange}
          aria-label="Upload photo"
        />
      </div>

      {/* ── Action bar ──────────────────────────────────────────────────────── */}
      {uploadState.phase === 'READY' && (
        <div className="flex gap-2 flex-wrap">
          {isAIResult && aiPhase.phase === 'done' ? (
            /* ── AI result mode actions ─────────────────────────────────────── */
            <>
              <button
                onClick={() => setAiPhase({ phase: 'idle' })}
                className="flex-1 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                ← Overlay Preview
              </button>
              <a
                href={aiPhase.resultUrl}
                download={`celebstyle-ai-tryon-${Date.now()}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-xs font-medium bg-white text-black rounded-xl text-center hover:bg-white/90 transition-colors"
              >
                ↓ Download
              </a>
              <button
                onClick={() => {
                  if (aiPhase.phase !== 'done') return;
                  try {
                    const key = 'celebstyle-tryon-history';
                    const raw = localStorage.getItem(key);
                    const history = raw ? JSON.parse(raw) : [];
                    const entry = {
                      id: `${Date.now()}`,
                      outfitId: garment?.id ?? '',
                      outfitName: garment?.name ?? 'Outfit',
                      outfitImage: garment?.imageUrl ?? '',
                      tryOnImage: aiPhase.resultUrl,
                      timestamp: Date.now(),
                    };
                    history.unshift(entry);
                    localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
                    alert('Saved to My Wardrobe!');
                  } catch {}
                }}
                className="flex-1 py-2 text-xs font-medium bg-pink-600/30 hover:bg-pink-600/50 text-pink-200 border border-pink-500/30 rounded-xl transition-colors"
              >
                ♥ Save
              </button>
              <button
                onClick={() => { void handleAIGenerate(); }}
                disabled={isGenerating}
                className="flex-1 py-2 text-xs font-medium bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 rounded-xl transition-colors disabled:opacity-40"
              >
                Regenerate
              </button>
            </>
          ) : (
            /* ── Overlay mode actions ─────────────────────────────────────── */
            <>
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
            </>
          )}

          {/* ── AI Generate button — always visible unless showing result ─── */}
          {!isAIResult && (
            <button
              onClick={() => { void handleAIGenerate(); }}
              disabled={isGenerating || !garment || !garmentReady}
              className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-all border
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isGenerating
                  ? 'bg-purple-600/20 border-purple-500/30 text-purple-300 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 border-purple-500/40 text-purple-200 hover:text-white'
                }`}
              aria-label={
                isGenerating
                  ? 'Generating…'
                  : !garmentReady
                  ? 'AI Generate unavailable — no Try-On ready garment image for this outfit'
                  : 'Generate AI Virtual Try-On'
              }
              title={!garmentReady ? 'This outfit does not yet have a Virtual Try-On ready garment image.' : undefined}
            >
              {isGenerating
                ? '⏳ Generating AI Try-On… (30–90 s)'
                : !garmentReady
                ? '✨ AI Generate — Unavailable'
                : '✨ AI Generate — IDM-VTON'}
            </button>
          )}
        </div>
      )}

      {/* ── AI error panel ────────────────────────────────────────────────── */}
      {uploadState.phase === 'READY' && aiPhase.phase === 'error' && (
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">AI Try-On Error</span>
            <button
              onClick={() => setAiPhase({ phase: 'idle' })}
              className="text-white/40 hover:text-white text-xs transition-colors"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {aiPhase.deploymentRequired ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🖥️</span>
                  <div>
                    <p className="text-white text-sm font-semibold">GPU Deployment Required</p>
                    <p className="text-white/50 text-xs mt-1">
                      IDM-VTON needs a cloud GPU. Configure Replicate (~2 min setup):
                    </p>
                  </div>
                </div>
                {aiPhase.instructions && (
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    {aiPhase.instructions.map((line, i) => (
                      <p key={i} className="text-white/60 text-xs font-mono leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 shrink-0">⚠</span>
                  <p className="text-red-400 text-sm">{aiPhase.message}</p>
                </div>
                <button
                  onClick={() => { void handleAIGenerate(); }}
                  disabled={isGenerating}
                  className="w-full py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-40"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Outfit switcher strip ──────────────────────────────────────────── */}
      {uploadState.phase === 'READY' && garments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {garments.slice(0, 12).map((g) => {
            const thumbNotReady = notReadyIds.has(g.id);
            return (
              <button
                key={g.id}
                onClick={() => {
                  onGarmentChange?.(g);
                  // Switching outfits resets the AI result so the user can
                  // generate a fresh try-on with the newly selected garment.
                  if (isAIResult) setAiPhase({ phase: 'idle' });
                }}
                title={thumbNotReady ? `${g.name} — Try-On preview not yet available` : g.name}
                className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                  garment?.id === g.id
                    ? 'border-white scale-110'
                    : 'border-white/20 hover:border-white/50'
                }`}
              >
                {thumbNotReady ? (
                  <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/30 text-[9px] font-medium text-center leading-tight px-1">
                    Not ready
                  </div>
                ) : (
                  <img
                    src={g.imageUrl}
                    alt={g.name}
                    className="w-full h-full object-cover"
                    onError={() => {
                      setNotReadyIds((prev) => (prev.has(g.id) ? prev : new Set(prev).add(g.id)));
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
