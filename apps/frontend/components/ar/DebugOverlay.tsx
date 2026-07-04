'use client';

import type { FrameMetrics } from '@/lib/ar/types';

interface Props {
  metrics: FrameMetrics;
  status: string;
}

export function DebugOverlay({ metrics, status }: Props) {
  const fpsColor =
    metrics.fps >= 25 ? 'text-green-400' : metrics.fps >= 15 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div
      className="absolute top-3 left-3 bg-black/70 rounded-lg px-3 py-2 font-mono text-xs space-y-0.5 pointer-events-none"
      aria-label="AR performance metrics"
      role="status"
    >
      <div className={`font-bold ${fpsColor}`}>FPS {metrics.fps}</div>
      <div className="text-gray-300">Seg {metrics.segmentationMs.toFixed(1)} ms</div>
      <div className="text-gray-300">Render {metrics.renderMs.toFixed(1)} ms</div>
      <div className="text-gray-300">Latency {metrics.latencyMs.toFixed(1)} ms</div>
      {metrics.droppedFrames > 0 && (
        <div className="text-yellow-400">Dropped {metrics.droppedFrames}</div>
      )}
      <div className="text-gray-500 uppercase tracking-widest text-[10px]">{status}</div>
    </div>
  );
}
