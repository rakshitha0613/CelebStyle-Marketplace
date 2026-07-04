'use client';

interface Props {
  onToggleDebug: () => void;
  debugMode: boolean;
  onSnapshot?: () => void;
}

export function ARControls({ onToggleDebug, debugMode, onSnapshot }: Props) {
  return (
    <section
      className="bg-white/10 rounded-xl p-4 space-y-3"
      aria-labelledby="ar-controls-heading"
    >
      <h2 id="ar-controls-heading" className="text-white font-semibold text-sm">
        Controls
      </h2>

      <div className="flex flex-col gap-2">
        {onSnapshot && (
          <button
            onClick={onSnapshot}
            className="w-full py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Take snapshot"
          >
            Take Snapshot
          </button>
        )}

        <button
          onClick={onToggleDebug}
          aria-pressed={debugMode}
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
            debugMode
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {debugMode ? 'Debug On' : 'Debug Off'}
        </button>
      </div>

      <p className="text-white/40 text-xs">
        Camera frames are processed locally and never leave your device.
      </p>
    </section>
  );
}
