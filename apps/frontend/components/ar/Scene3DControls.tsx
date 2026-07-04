'use client';

import type { Scene3DConfig, LightingPreset, EnvironmentPreset } from '@/lib/ar/three.types';

interface Props {
  config: Scene3DConfig;
  onChange: (patch: Partial<Scene3DConfig>) => void;
}

const LIGHTING_OPTIONS: { value: LightingPreset; label: string }[] = [
  { value: 'soft',     label: 'Soft'     },
  { value: 'neutral',  label: 'Neutral'  },
  { value: 'natural',  label: 'Natural'  },
  { value: 'dramatic', label: 'Dramatic' },
];

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreset; label: string }[] = [
  { value: 'studio',  label: 'Studio'  },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor',  label: 'Indoor'  },
  { value: 'night',   label: 'Night'   },
];

export function Scene3DControls({ config, onChange }: Props) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white/80 tracking-wide uppercase">
        3D Settings
      </h3>

      {/* ── Render mode toggle ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-white/50 mb-2">Render Mode</p>
        <div
          role="group"
          aria-label="Render mode"
          className="grid grid-cols-2 gap-1 bg-white/10 rounded-xl p-1"
        >
          {(['2D', '3D'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={config.renderMode === mode}
              onClick={() => onChange({ renderMode: mode })}
              className={`rounded-lg py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                config.renderMode === mode
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {mode === '2D' ? '2D Overlay' : '3D Garment'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lighting presets ────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="lighting-select"
          className="block text-xs text-white/50 mb-2"
        >
          Lighting
        </label>
        <select
          id="lighting-select"
          value={config.lighting}
          onChange={(e) => onChange({ lighting: e.target.value as LightingPreset })}
          aria-label="Lighting preset"
          className="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/40 appearance-none"
        >
          {LIGHTING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Environment presets ──────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="environment-select"
          className="block text-xs text-white/50 mb-2"
        >
          Environment
        </label>
        <select
          id="environment-select"
          value={config.environment}
          onChange={(e) => onChange({ environment: e.target.value as EnvironmentPreset })}
          aria-label="Environment preset"
          className="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/40 appearance-none"
        >
          {ENVIRONMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Toggles ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Toggle
          id="physics-toggle"
          label="Cloth Physics"
          description="Realistic fabric simulation"
          checked={config.physicsEnabled}
          onChange={(v) => onChange({ physicsEnabled: v })}
        />
        <Toggle
          id="skeleton-toggle"
          label="Debug Skeleton"
          description="Show rig joints in 3D view"
          checked={config.showSkeleton}
          onChange={(v) => onChange({ showSkeleton: v })}
        />
        <Toggle
          id="reduced-motion-toggle"
          label="Reduced Motion"
          description="Disable physics animation"
          checked={config.reducedMotion}
          onChange={(v) => onChange({ reducedMotion: v, physicsEnabled: v ? false : config.physicsEnabled })}
        />
      </div>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm text-white/80 cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked); } }}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
          checked ? 'bg-white/80' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
