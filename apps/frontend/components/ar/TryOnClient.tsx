'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ARConfig, BackgroundMode, FrameMetrics } from '@/lib/ar/types';
import type { GarmentAsset, GarmentOverlayConfig, PoseLandmark } from '@/lib/ar/garment.types';
import type { Scene3DConfig } from '@/lib/ar/three.types';
import type { ClothingSize, PhysicalMeasurements, SizeRecommendation, OutfitItem, OutfitSlot, OutfitScore, WishlistEntry, Outfit } from '@/lib/ar/fit.types';
import { DEFAULT_SCENE_CONFIG } from '@/lib/ar/three.types';
import { getOutfits } from '@/lib/api';
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

  // ── Service singletons ─────────────────────────────────────────────────────
  const bodyMeasSvc = useRef(new BodyMeasurementService());
  const sizeRecSvc  = useRef(new SizeRecommendationService());
  const composerSvc = useRef(new OutfitComposerService());
  const scoringSvc  = useRef(new OutfitScoringService());
  const wishlistSvc = useRef(new WishlistOverlayService());

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
            <div className="relative">
              <ARCanvas
                config={arConfig}
                onMetrics={setMetrics}
                onVideoReady={setVideo}
                lighting={sceneConfig.lighting}
                environment={sceneConfig.environment}
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
