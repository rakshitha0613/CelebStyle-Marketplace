'use client';

export default function TryOnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-4xl">⚠️</div>
      <div className="text-center max-w-lg">
        <p className="text-white font-semibold text-lg mb-2">Try-On failed to load</p>
        <p className="text-red-400 text-sm font-mono bg-black/40 rounded-xl px-4 py-3 text-left break-all">
          {error.message}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-white text-black rounded-xl font-medium text-sm hover:bg-white/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
