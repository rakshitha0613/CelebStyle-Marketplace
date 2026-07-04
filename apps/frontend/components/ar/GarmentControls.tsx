'use client';

import type { GarmentAsset, GarmentOverlayConfig } from '@/lib/ar/garment.types';

interface Props {
  garments: GarmentAsset[];
  selected: GarmentAsset | null;
  onSelect: (garment: GarmentAsset) => void;
  config: GarmentOverlayConfig;
  onConfigChange: (patch: Partial<GarmentOverlayConfig>) => void;
}

const TYPE_LABEL: Record<string, string> = {
  T_SHIRT: 'T-Shirt',
  SHIRT:   'Shirt',
  JACKET:  'Jacket',
  HOODIE:  'Hoodie',
};

export function GarmentControls({
  garments,
  selected,
  onSelect,
  config,
  onConfigChange,
}: Props) {
  return (
    <section
      className="bg-white/10 rounded-xl p-4 space-y-4"
      aria-labelledby="garment-controls-heading"
    >
      <h2 id="garment-controls-heading" className="text-white font-semibold text-sm">
        Virtual Try-On
      </h2>

      {/* Garment picker */}
      <div
        className="grid grid-cols-1 gap-2"
        role="listbox"
        aria-label="Select garment"
      >
        {garments.map((g) => (
          <button
            key={g.id}
            role="option"
            aria-selected={selected?.id === g.id}
            onClick={() => onSelect(g)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(g);
            }}
            className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 text-left ${
              selected?.id === g.id
                ? 'bg-white text-black font-medium'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span className="text-xs opacity-60 uppercase tracking-wide w-14 flex-shrink-0">
              {TYPE_LABEL[g.type] ?? g.type}
            </span>
            <span>{g.name}</span>
          </button>
        ))}
      </div>

      {/* Show / hide toggle */}
      <div className="flex items-center justify-between">
        <span className="text-white/70 text-sm">Show overlay</span>
        <button
          role="switch"
          aria-checked={config.visible}
          onClick={() => onConfigChange({ visible: !config.visible })}
          className={`relative w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            config.visible ? 'bg-white' : 'bg-white/20'
          }`}
          aria-label="Toggle garment overlay"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
              config.visible ? 'bg-black translate-x-5' : 'bg-white/60'
            }`}
          />
        </button>
      </div>

      {/* Opacity slider */}
      <div className="space-y-1">
        <label className="text-white/70 text-xs flex justify-between">
          <span>Opacity</span>
          <span>{Math.round(config.opacity * 100)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.opacity}
          onChange={(e) => onConfigChange({ opacity: Number(e.target.value) })}
          className="w-full accent-white"
          aria-label="Garment opacity"
        />
      </div>

      {/* Debug / high-contrast */}
      <div className="flex gap-2">
        <button
          aria-pressed={config.debugLandmarks}
          onClick={() => onConfigChange({ debugLandmarks: !config.debugLandmarks })}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            config.debugLandmarks
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          Landmarks
        </button>

        <button
          aria-pressed={config.highContrast}
          onClick={() => onConfigChange({ highContrast: !config.highContrast })}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            config.highContrast
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          Hi-Contrast
        </button>
      </div>

      {/* Reset */}
      <button
        onClick={() => onConfigChange({ opacity: 0.85, visible: true, debugLandmarks: false, highContrast: false })}
        className="w-full py-2 bg-white/5 text-white/50 text-xs rounded-lg hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Reset overlay settings"
      >
        Reset Alignment
      </button>
    </section>
  );
}
