'use client';

import { useRef, useEffect } from 'react';
import type { PoseLandmark } from '@/lib/ar/garment.types';
import { GarmentRenderer } from '@/lib/ar/garment-renderer';

interface Props {
  landmarks: PoseLandmark[] | null;
  canvasWidth: number;
  canvasHeight: number;
  className?: string;
}

const renderer = new GarmentRenderer();

export function LandmarkOverlay({ landmarks, canvasWidth, canvasHeight, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (landmarks?.length) {
      renderer.renderLandmarks(ctx, landmarks, canvasWidth, canvasHeight);
    }
  }, [landmarks, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className={`w-full h-full pointer-events-none ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}
