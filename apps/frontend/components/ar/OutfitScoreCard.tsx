'use client';

import type { OutfitScore } from '@/lib/ar/fit.types';

interface Props {
  score: OutfitScore;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SCORE_LABELS: Record<keyof OutfitScore, string> = {
  overall:           'Overall',
  colorHarmony:      'Color Harmony',
  styleCompat:       'Style Match',
  seasonScore:       'Season',
  trendingScore:     'Trending',
  occasionScore:     'Occasion',
  personalScore:     'Personal',
  celebritySimilarity: 'Celeb Style',
};

const DIMENSION_KEYS: Array<keyof OutfitScore> = [
  'colorHarmony', 'styleCompat', 'seasonScore',
  'trendingScore', 'occasionScore', 'personalScore', 'celebritySimilarity',
];

function scoreColor(value: number): string {
  if (value >= 85) return 'bg-green-400';
  if (value >= 70) return 'bg-yellow-400';
  return 'bg-red-400';
}

function scoreLabel(value: number): string {
  if (value >= 85) return 'Great';
  if (value >= 70) return 'Good';
  return 'Low';
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80 tabular-nums">{value}</span>
      </div>
      <div
        className="h-1 rounded-full bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value} out of 100`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${scoreColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function OutfitScoreCard({ score, isCollapsed = false, onToggleCollapse }: Props) {
  const ring = scoreColor(score.overall).replace('bg-', 'border-');

  return (
    <section
      className="bg-white/5 rounded-2xl overflow-hidden"
      aria-labelledby="score-card-heading"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-expanded={!isCollapsed}
        aria-controls="score-card-body"
        onClick={onToggleCollapse}
      >
        <h3
          id="score-card-heading"
          className="text-sm font-semibold text-white/80 tracking-wide uppercase"
        >
          Outfit Score
        </h3>
        <div className="flex items-center gap-3">
          {/* Donut badge */}
          <div
            className={`w-10 h-10 rounded-full border-2 ${ring} flex items-center justify-center`}
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-white">{score.overall}</span>
          </div>
          <span className="text-xs text-white/40">{scoreLabel(score.overall)}</span>
          <span
            className={`text-white/40 text-xs transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            aria-hidden="true"
          >
            ▲
          </span>
        </div>
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div id="score-card-body" className="px-4 pb-4 space-y-2">
          {DIMENSION_KEYS.map((key) => (
            <ProgressBar
              key={key}
              label={SCORE_LABELS[key]}
              value={score[key]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
