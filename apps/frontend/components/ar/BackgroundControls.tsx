'use client';

import type { BackgroundMode } from '@/lib/ar/types';

interface Props {
  mode: BackgroundMode;
  blurStrength?: number;
  onChange: (mode: BackgroundMode, blurStrength?: number) => void;
}

const MODES: { value: BackgroundMode; label: string }[] = [
  { value: 'NONE', label: 'Off' },
  { value: 'BLUR', label: 'Blur' },
  { value: 'REPLACE', label: 'Replace' },
  { value: 'TRANSPARENT', label: 'Transparent' },
];

export function BackgroundControls({ mode, blurStrength = 10, onChange }: Props) {
  return (
    <section
      className="bg-white/10 rounded-xl p-4 space-y-4"
      aria-labelledby="bg-controls-heading"
    >
      <h2 id="bg-controls-heading" className="text-white font-semibold text-sm">
        Background
      </h2>

      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Background mode"
      >
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={mode === value}
            onClick={() => onChange(value, blurStrength)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onChange(value, blurStrength);
            }}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              mode === value
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'BLUR' && (
        <div className="space-y-2">
          <label className="text-white/70 text-xs flex justify-between">
            <span>Blur strength</span>
            <span>{blurStrength}px</span>
          </label>
          <input
            type="range"
            min={1}
            max={25}
            step={1}
            value={blurStrength}
            onChange={(e) => onChange(mode, Number(e.target.value))}
            className="w-full accent-white"
            aria-label="Blur strength"
          />
        </div>
      )}
    </section>
  );
}
