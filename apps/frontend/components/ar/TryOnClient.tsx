'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ARConfig, BackgroundMode, FrameMetrics } from '@/lib/ar/types';
import type { GarmentAsset, GarmentOverlayConfig, PoseLandmark } from '@/lib/ar/garment.types';
import type { Scene3DConfig } from '@/lib/ar/three.types';
import type { ClothingSize, PhysicalMeasurements, SizeRecommendation, OutfitItem, OutfitSlot, OutfitScore, WishlistEntry, Outfit } from '@/lib/ar/fit.types';
import { DEFAULT_SCENE_CONFIG } from '@/lib/ar/three.types';
import { getOutfits, logARSession } from '@/lib/api';
import { outfitsToGarments } from '@/lib/ar/outfit-to-garment';
import { BodyMeasurementService } from '@/lib/ar/body-measurement.service';
import { SizeRecommendationService } from '@/lib/ar/size-recommendation.service';
import { OutfitComposerService } from '@/lib/ar/outfit-composer.service';
import { OutfitScoringService } from '@/lib/ar/outfit-scoring.service';
import { WishlistOverlayService } from '@/lib/ar/wishlist-overlay.service';
import { ARCanvas } from './ARCanvas';
import { BackgroundControls } from './BackgroundControls';
import { ARControls } from './ARControls';
import { GarmentControls } from './GarmentControls';
import { GarmentOverlay } from './GarmentOverlay';
import { Scene3DControls } from './Scene3DControls';
import { ThreeGarmentOverlay } from './ThreeGarmentOverlay';
import { SizeRecommendationPanel } from './SizeRecommendationPanel';
import { OutfitComposer } from './OutfitComposer';
import { WishlistPanel } from './WishlistPanel';

const DEFAULT_AR_CONFIG: ARConfig = {
  segmentation: {
    modelType: 'portrait',
    confidenceThreshold: 0.7,
    smoothingFactor: 0.5,
    runEveryNFrames: 2,
  },
  background: {
    mode: 'BLUR',
    blurStrength: 10,
  },
  targetFPS: 30,
  debugMode: false,
  tier: 'FULL',
};

const DEFAULT_OVERLAY_CONFIG: GarmentOverlayConfig = {
  opacity: 0.85,
  visible: true,
  debugLandmarks: false,
  highContrast: false,
  mirrored: false,
  visibilityThreshold: 0.5,
};

function garmentAssetToItem(asset: GarmentAsset, slot: OutfitSlot, size: ClothingSize = 'M'): OutfitItem {
  return {
    slot,
    garmentId:   asset.id,
    garmentName: asset.name,
    garmentType: asset.type,
    size,
    imageUrl:    asset.imageUrl,
  };
}

interface TryOnClientProps {
  preloadOutfitId?: string;
}

export default function TryOnClient({ preloadOutfitId }: TryOnClientProps) {
  const [arConfig, setArConfig]           = useState<ARConfig>(DEFAULT_AR_CONFIG);
  const [overlayConfig, setOverlayConfig] = useState<GarmentOverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [sceneConfig, setSceneConfig]     = useState<Scene3DConfig>(DEFAULT_SCENE_CONFIG);
  const [metrics, setMetrics]             = useState<FrameMetrics | null>(null);
  const [garments, setGarments]           = useState<GarmentAsset[]>([]);
  const [garmentsLoading, setGarmentsLoading] = useState(true);
  const [garmentsError, setGarmentsError] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<GarmentAsset | null>(null);
  const [video, setVideo]       = useState<HTMLVideoElement | null>(null);
  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);

  // ── Fit / size state ───────────────────────────────────────────────────────
  const [measurements, setMeasurements] = useState<PhysicalMeasurements | null>(null);
  const [sizeRec, setSizeRec]           = useState<SizeRecommendation | null>(null);

  // ── Outfit composer state ──────────────────────────────────────────────────
  const [composerSlots, setComposerSlots]     = useState<Map<OutfitSlot, OutfitItem>>(new Map());
  const [composerIsComplete, setComposerIsComplete] = useState(false);
  const [composerName, setComposerName]       = useState('My Outfit');
  const [composerScore, setComposerScore]     = useState<OutfitScore | null>(null);

  // ── Wishlist state ─────────────────────────────────────────────────────────
  const [wishlist, setWishlist]           = useState<WishlistEntry[]>([]);
  const [savedOutfits, setSavedOutfits]   = useState<Outfit[]>([]);

  // ── Panel collapse state ───────────────────────────────────────────────────
  const [sizeCollapsed, setSizeCollapsed]         = useState(false);
  const [composerCollapsed, setComposerCollapsed] = useState(false);
  const [wishlistCollapsed, setWishlistCollapsed] = useState(true);

  // ── Phase 6: UX enhancements ───────────────────────────────────────────────
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [mirrorMode, setMirrorMode]     = useState(false);
  const [facingMode, setFacingMode]     = useState<'user' | 'environment'>('user');
  const [cameraKey, setCameraKey]       = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // ── Service singletons ─────────────────────────────────────────────────────
  const bodyMeasSvc = useRef(new BodyMeasurementService());
  const sizeRecSvc  = useRef(new SizeRecommendationService());
  const composerSvc = useRef(new OutfitComposerService());
  const scoringSvc  = useRef(new OutfitScoringService());
  const wishlistSvc = useRef(new WishlistOverlayService());

  // ── AR session analytics refs ───────────────────────────────────────────────
  const sessionStartRef       = useRef<number>(Date.now());
  const wasAddedToCartRef     = useRef<boolean>(false);
  const selectedGarmentRef    = useRef<GarmentAsset | null>(null);

  // Keep selectedGarmentRef current so the unmount cleanup reads the right value
  useEffect(() => {
    selectedGarmentRef.current = selectedGarment;
  }, [selectedGarment]);

  // Log the session when the component unmounts
  useEffect(() => {
    sessionStartRef.current = Date.now();
    return () => {
      const productId = selectedGarmentRef.current?.id;
      if (!productId) return;
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      // Skip sub-second sessions (avoids React Strict Mode double-invoke noise in dev)
      if (durationSeconds < 1) return;
      void logARSession({
        productId,
        durationSeconds,
        wasAddedToCart: wasAddedToCartRef.current,
        platform: 'web',
        deviceType:
          typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
            ? 'mobile'
            : 'desktop',
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate wishlist/saved from storage on mount
  useEffect(() => {
    setWishlist(wishlistSvc.current.getWishlist());
    setSavedOutfits(wishlistSvc.current.loadSavedOutfits());
  }, []);

  // ── Load real outfits from API and convert to GarmentAssets ───────────────
  useEffect(() => {
    let cancelled = false;

    async function loadGarments() {
      setGarmentsLoading(true);
      setGarmentsError(false);
      try {
        const outfits = await getOutfits();
        if (cancelled) return;
        const converted = outfitsToGarments(outfits);
        setGarments(converted);

        // Pre-select the deep-linked outfit or fall back to the first garment
        const preload = preloadOutfitId
          ? converted.find((g) => g.id === preloadOutfitId) ?? converted[0]
          : converted[0];
        if (preload) setSelectedGarment(preload);
      } catch {
        if (!cancelled) setGarmentsError(true);
      } finally {
        if (!cancelled) setGarmentsLoading(false);
      }
    }

    void loadGarments();
    return () => { cancelled = true; };
  }, [preloadOutfitId]);

  // ── Landmark → measurements → size rec ────────────────────────────────────
  useEffect(() => {
    if (!landmarks || landmarks.length === 0 || !selectedGarment) return;
    // Use a standard 640×480 reference; measurements are proportional
    const m = bodyMeasSvc.current.estimateMeasurements(landmarks, 640, 480);
    if (!m || m.confidence < 0.3) return;
    setMeasurements(m);
    const rec = sizeRecSvc.current.getRecommendedSize(m, selectedGarment.type);
    setSizeRec(rec);
  }, [landmarks, selectedGarment]);

  // ── Composer sync ──────────────────────────────────────────────────────────
  const syncComposer = useCallback(() => {
    const svc = composerSvc.current;
    setComposerSlots(new Map(svc.getFilledSlots().map((s) => [s, svc.getItem(s)!])));
    setComposerIsComplete(svc.isComplete());
    const items = svc.getFilledSlots().map((s) => svc.getItem(s)!);
    setComposerScore(items.length > 0 ? scoringSvc.current.scoreOutfit(items) : null);
  }, []);

  const handleRemoveItem = useCallback((slot: OutfitSlot) => {
    composerSvc.current.removeItem(slot);
    syncComposer();
  }, [syncComposer]);

  const handleSetName = useCallback((name: string) => {
    composerSvc.current.setName(name);
    setComposerName(name);
  }, []);

  const handleAddCurrentGarment = useCallback(() => {
    if (!selectedGarment) return;
    wasAddedToCartRef.current = true;
    const item = garmentAssetToItem(selectedGarment, 'top', sizeRec?.size ?? 'M');
    composerSvc.current.addItem(item);
    syncComposer();
  }, [selectedGarment, sizeRec, syncComposer]);

  const handleBuildOutfit = useCallback(() => {
    const outfit = composerSvc.current.buildOutfit();
    if (!outfit) return;
    wishlistSvc.current.saveOutfit(outfit);
    setSavedOutfits(wishlistSvc.current.loadSavedOutfits());
    composerSvc.current.clearOutfit();
    syncComposer();
  }, [syncComposer]);

  const handleClear = useCallback(() => {
    composerSvc.current.clearOutfit();
    syncComposer();
  }, [syncComposer]);

  // ── Wishlist actions ───────────────────────────────────────────────────────
  const handleRemoveFromWishlist = useCallback((entryId: string) => {
    wishlistSvc.current.removeFromWishlist(entryId);
    setWishlist(wishlistSvc.current.getWishlist());
  }, []);

  const handleDeleteSaved = useCallback((outfitId: string) => {
    wishlistSvc.current.deleteSavedOutfit(outfitId);
    setSavedOutfits(wishlistSvc.current.loadSavedOutfits());
  }, []);

  const handleAddAllToCart = useCallback((outfit: Outfit) => {
    wasAddedToCartRef.current = true;
    wishlistSvc.current.addAllToCart(outfit);
  }, []);

  const handleShare = useCallback((outfit: Outfit) => {
    const url = wishlistSvc.current.generateShareableUrl(outfit);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    }
  }, []);

  // ── Standard controls ──────────────────────────────────────────────────────
  const updateBackground = (mode: BackgroundMode, blurStrength?: number) => {
    setArConfig((c) => ({
      ...c,
      background: { ...c.background, mode, ...(blurStrength !== undefined ? { blurStrength } : {}) },
    }));
  };

  const toggleDebug = () => setArConfig((c) => ({ ...c, debugMode: !c.debugMode }));

  const updateOverlay = useCallback((patch: Partial<GarmentOverlayConfig>) => {
    setOverlayConfig((c) => ({ ...c, ...patch }));
  }, []);

  const updateScene = useCallback((patch: Partial<Scene3DConfig>) => {
    setSceneConfig((c) => ({ ...c, ...patch }));
  }, []);

  const is3D = sceneConfig.renderMode === '3D';

  // ── Phase 6: screenshot ────────────────────────────────────────────────────
  const handleScreenshot = useCallback(() => {
    if (!viewportRef.current) return;
    const canvases = viewportRef.current.querySelectorAll('canvas');
    if (canvases.length === 0) return;

    const first = canvases[0] as HTMLCanvasElement;
    const comp  = document.createElement('canvas');
    comp.width  = first.width  || 1280;
    comp.height = first.height || 720;
    const ctx   = comp.getContext('2d');
    if (!ctx) return;

    canvases.forEach((c) => {
      try { ctx.drawImage(c as HTMLCanvasElement, 0, 0, comp.width, comp.height); } catch { /* tainted canvas */ }
    });

    const a  = document.createElement('a');
    a.href   = comp.toDataURL('image/png');
    a.download = `celebstyle-tryon-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Phase 6: countdown capture ─────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdown !== null) return; // already running
    setCountdown(3);
    let remaining = 3;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        handleScreenshot();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [countdown, handleScreenshot]);

  // ── Phase 6: camera switch ─────────────────────────────────────────────────
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    setCameraKey((k) => k + 1); // remount ARCanvas with new facing mode
  }, []);

  // ── Phase 6: fullscreen ────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Sync fullscreen state with browser API (handles Esc key exit)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Mirror mode → keep overlayConfig.mirrored in sync
  useEffect(() => {
    updateOverlay({ mirrored: mirrorMode });
  }, [mirrorMode, updateOverlay]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white">Virtual Try-On</h1>
          <p className="mt-2 text-white/50">
            Try on celebrity looks live — powered by on-device AI
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* AR viewport + garment overlay */}
          <div className="lg:col-span-2">
            <div ref={viewportRef} className="relative">
              <ARCanvas
                key={cameraKey}
                config={arConfig}
                onMetrics={setMetrics}
                onVideoReady={setVideo}
                lighting={sceneConfig.lighting}
                environment={sceneConfig.environment}
                facingMode={facingMode}
                mirrorMode={mirrorMode}
                sceneChildren={
                  is3D ? (
                    <ThreeGarmentOverlay
                      garment={selectedGarment}
                      landmarks={landmarks}
                      config={sceneConfig}
                    />
                  ) : undefined
                }
                className="aspect-[4/3] w-full"
              />

              {/* 2D garment overlay — hidden in 3D mode */}
              {!is3D && video && overlayConfig.visible && (
                <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
                  <GarmentOverlay
                    video={video}
                    garment={selectedGarment}
                    config={overlayConfig}
                    onLandmarks={setLandmarks}
                    className="object-cover"
                  />
                </div>
              )}

              {/* In 3D mode, run GarmentOverlay offscreen just for landmark detection */}
              {is3D && video && (
                <div className="sr-only" aria-hidden="true">
                  <GarmentOverlay
                    video={video}
                    garment={null}
                    config={{ ...overlayConfig, visible: false }}
                    onLandmarks={setLandmarks}
                  />
                </div>
              )}

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-live="assertive">
                  <span className="text-9xl font-bold text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] select-none">
                    {countdown}
                  </span>
                </div>
              )}

              {/* Camera control bar */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                {/* Mirror toggle */}
                <button
                  onClick={() => setMirrorMode((v) => !v)}
                  title="Mirror"
                  aria-label={mirrorMode ? 'Disable mirror' : 'Enable mirror'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${mirrorMode ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  ⇆
                </button>

                {/* Countdown capture */}
                <button
                  onClick={startCountdown}
                  disabled={countdown !== null}
                  title="Capture with countdown"
                  aria-label="Take photo with 3-second countdown"
                  className="w-12 h-12 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center font-bold text-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {countdown !== null ? countdown : '◎'}
                </button>

                {/* Quick screenshot */}
                <button
                  onClick={handleScreenshot}
                  title="Screenshot"
                  aria-label="Download screenshot"
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  ↓
                </button>

                {/* Camera switch */}
                <button
                  onClick={switchCamera}
                  title="Switch camera"
                  aria-label="Switch between front and rear camera"
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  ⟳
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  {isFullscreen ? '⊡' : '⊞'}
                </button>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {garmentsLoading ? (
              <div className="bg-white/10 rounded-xl p-4 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span className="text-white/50 text-sm">Loading outfits…</span>
              </div>
            ) : garmentsError ? (
              <div className="bg-white/10 rounded-xl p-4 text-sm text-red-400">
                Failed to load outfits. Please refresh to retry.
              </div>
            ) : (
              <GarmentControls
                garments={garments}
                selected={selectedGarment}
                onSelect={setSelectedGarment}
                config={overlayConfig}
                onConfigChange={updateOverlay}
              />
            )}

            {/* Add to outfit quick action */}
            <button
              onClick={handleAddCurrentGarment}
              disabled={!selectedGarment}
              className="w-full rounded-xl py-2 text-sm font-medium bg-white/8 hover:bg-white/12 text-white/70 hover:text-white transition-colors border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add to Outfit Composer
            </button>

            <SizeRecommendationPanel
              measurements={measurements}
              recommendation={sizeRec}
              isCollapsed={sizeCollapsed}
              onToggleCollapse={() => setSizeCollapsed((v) => !v)}
              highContrast={overlayConfig.highContrast}
            />

            <OutfitComposer
              slots={composerSlots}
              score={composerScore}
              isComplete={composerIsComplete}
              outfitName={composerName}
              onRemoveItem={handleRemoveItem}
              onSetName={handleSetName}
              onBuildOutfit={handleBuildOutfit}
              onClear={handleClear}
              isCollapsed={composerCollapsed}
              onToggleCollapse={() => setComposerCollapsed((v) => !v)}
            />

            <WishlistPanel
              wishlist={wishlist}
              savedOutfits={savedOutfits}
              wishlistCount={wishlist.length}
              onRemoveFromWishlist={handleRemoveFromWishlist}
              onDeleteSavedOutfit={handleDeleteSaved}
              onAddAllToCart={handleAddAllToCart}
              onShare={handleShare}
              isCollapsed={wishlistCollapsed}
              onToggleCollapse={() => setWishlistCollapsed((v) => !v)}
            />

            <Scene3DControls
              config={sceneConfig}
              onChange={updateScene}
            />

            <BackgroundControls
              mode={arConfig.background.mode}
              blurStrength={arConfig.background.blurStrength}
              onChange={updateBackground}
            />

            <ARControls
              onToggleDebug={toggleDebug}
              debugMode={arConfig.debugMode}
            />

            {metrics && arConfig.debugMode && (
              <div className="bg-white/5 rounded-xl p-4 font-mono text-xs space-y-1 text-white/60">
                <div className="text-white/80 font-semibold mb-2">Live Metrics</div>
                <div>FPS: <span className="text-white">{metrics.fps}</span></div>
                <div>Segmentation: <span className="text-white">{metrics.segmentationMs.toFixed(1)}ms</span></div>
                <div>Render: <span className="text-white">{metrics.renderMs.toFixed(1)}ms</span></div>
                <div>Dropped: <span className="text-white">{metrics.droppedFrames}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
