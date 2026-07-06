'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { ARConfig, FrameMetrics, MaskData } from '@/lib/ar/types';
import type { LightingPreset, EnvironmentPreset } from '@/lib/ar/three.types';
import { RenderPipeline } from '@/lib/ar/render-pipeline';
import { buildVideoConstraints, stopStream, classifyCameraError } from '@/lib/ar/camera.utils';
import { SceneRenderer } from './SceneRenderer';
import { DebugOverlay } from './DebugOverlay';

type ARStatus = 'IDLE' | 'REQUESTING' | 'INITIALIZING' | 'RUNNING' | 'ERROR' | 'DENIED';

interface Props {
  config: ARConfig;
  onMetrics?: (metrics: FrameMetrics) => void;
  onMask?: (mask: MaskData) => void;
  /** Called once when the camera video element is playing and ready for consumers */
  onVideoReady?: (video: HTMLVideoElement) => void;
  /** R3F children injected into the 3D scene (e.g. ThreeGarmentOverlay) */
  sceneChildren?: React.ReactNode;
  lighting?: LightingPreset;
  environment?: EnvironmentPreset;
  className?: string;
  /** Which camera to use — 'user' (selfie) or 'environment' (rear). Default 'user'. */
  facingMode?: 'user' | 'environment';
  /** Mirror the video horizontally — useful when facingMode is 'user'. Default false. */
  mirrorMode?: boolean;
}

export function ARCanvas({ config, onMetrics, onMask, onVideoReady, sceneChildren, lighting, environment, className, facingMode = 'user', mirrorMode = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const configRef = useRef(config);

  const [status, setStatus] = useState<ARStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);

  // Keep config ref current so the init closure uses latest values
  useEffect(() => { configRef.current = config; }, [config]);

  // Propagate config changes to running pipeline
  useEffect(() => {
    pipelineRef.current?.updateConfig(config);
  }, [config]);

  const stopAll = useCallback(() => {
    pipelineRef.current?.destroy();
    pipelineRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!videoRef.current || !canvasRef.current) return;
      setStatus('REQUESTING');
      setErrorMsg(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: buildVideoConstraints(facingMode, 1280, 720),
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        setStatus('INITIALIZING');

        const pipeline = new RenderPipeline(configRef.current, {
          onMetrics: (m) => { if (!cancelled) { setMetrics(m); onMetrics?.(m); } },
          onError: (err) => {
            if (!cancelled) {
              setStatus('ERROR');
              setErrorMsg(err.message);
            }
          },
          onFrame: (_ctx, state) => {
            if (!cancelled && state.lastMask) onMask?.(state.lastMask);
          },
        });

        await pipeline.initialize(video, canvas);
        if (cancelled) { pipeline.destroy(); return; }

        pipelineRef.current = pipeline;
        pipeline.start();
        setStatus('RUNNING');
        onVideoReady?.(video);
      } catch (err) {
        if (cancelled) return;
        const code = classifyCameraError(err);
        if (code === 'PERMISSION_DENIED') {
          setStatus('DENIED');
          setErrorMsg('Camera permission denied. Allow access in your browser settings.');
        } else if (code === 'NO_CAMERA') {
          setStatus('ERROR');
          setErrorMsg('No camera detected on this device.');
        } else {
          setStatus('ERROR');
          setErrorMsg('Failed to start camera. Please try again.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      stopAll();
    };
    // onMetrics/onMask intentionally omitted — stable via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll]);

  const retry = useCallback(() => {
    stopAll();
    setStatus('IDLE');
    // Re-trigger by remounting — parent can key this component
    window.location.reload();
  }, [stopAll]);

  return (
    <div
      className={`relative overflow-hidden bg-black rounded-2xl ${className ?? ''}`}
      role="region"
      aria-label="AR Virtual Try-On"
    >
      {/* Camera source (hidden) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
      />

      {/* 2D compositing canvas — mirrored when using selfie camera */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={mirrorMode ? { transform: 'scaleX(-1)' } : undefined}
        aria-label="Camera preview with AR segmentation"
      />

      {/* 3D R3F overlay — transparent background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <SceneRenderer lighting={lighting} environment={environment}>
          {sceneChildren}
        </SceneRenderer>
      </div>

      {/* Debug overlay */}
      {config.debugMode && metrics && status === 'RUNNING' && (
        <DebugOverlay metrics={metrics} status={status} />
      )}

      {/* Status overlays */}
      {(status === 'REQUESTING' || status === 'INITIALIZING') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
          <div className="w-10 h-10 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
          <p className="text-white font-medium">
            {status === 'REQUESTING' ? 'Requesting camera…' : 'Loading AR…'}
          </p>
        </div>
      )}

      {(status === 'ERROR' || status === 'DENIED') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 gap-4 text-center">
          <p className="text-white font-medium max-w-xs">{errorMsg ?? 'Something went wrong'}</p>
          {status === 'ERROR' && (
            <button
              onClick={retry}
              className="px-6 py-2.5 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
