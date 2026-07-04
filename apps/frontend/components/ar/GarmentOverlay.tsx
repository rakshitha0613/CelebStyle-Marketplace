'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { GarmentAsset, GarmentOverlayConfig, PoseLandmark } from '@/lib/ar/garment.types';
import { GarmentOverlayService } from '@/lib/ar/garment-overlay.service';

interface Props {
  video: HTMLVideoElement;
  garment: GarmentAsset | null;
  config: GarmentOverlayConfig;
  /** Called each frame with the latest detected landmarks (or null if none) */
  onLandmarks?: (landmarks: PoseLandmark[] | null) => void;
  className?: string;
}

export function GarmentOverlay({ video, garment, config, onLandmarks, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<GarmentOverlayService | null>(null);
  const rafRef = useRef<number | null>(null);
  const configRef = useRef(config);
  const garmentRef = useRef(garment);

  // Keep refs current so the RAF closure always reads fresh values
  useEffect(() => { configRef.current = config; serviceRef.current?.updateConfig(config); }, [config]);
  useEffect(() => {
    garmentRef.current = garment;
    if (garment && serviceRef.current?.isInitialized) {
      void serviceRef.current.setGarment(garment);
    }
  }, [garment]);

  const onLandmarksRef = useRef(onLandmarks);
  useEffect(() => { onLandmarksRef.current = onLandmarks; }, [onLandmarks]);

  const tick = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const service = serviceRef.current;
    if (!canvas || !service) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      service.processFrame(ctx, video, timestamp, canvas.width, canvas.height);
    }

    onLandmarksRef.current?.(service.getLastLandmarks());

    rafRef.current = requestAnimationFrame(tick);
  }, [video]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = video.videoWidth  > 0 ? video.videoWidth  : 1280;
    canvas.height = video.videoHeight > 0 ? video.videoHeight : 720;

    const service = new GarmentOverlayService(configRef.current);
    serviceRef.current = service;

    let cancelled = false;

    async function init() {
      try {
        await service.initialize();
        if (cancelled) return;
        if (garmentRef.current) await service.setGarment(garmentRef.current);
        if (cancelled) return;
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('[GarmentOverlay] init error:', err);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      service.destroy();
      serviceRef.current = null;
    };
    // tick is stable (useCallback with [video]); video never changes during component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, tick]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className ?? ''}`}
      aria-label="Garment overlay"
      role="img"
    />
  );
}
