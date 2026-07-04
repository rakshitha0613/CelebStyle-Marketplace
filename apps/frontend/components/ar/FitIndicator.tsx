'use client';

import type { FitStatus, FitIssue } from '@/lib/ar/fit.types';

interface Props {
  overallFit: FitStatus;
  issues: FitIssue[];
  confidence: number;
  highContrast?: boolean;
}

const FIT_LABELS: Record<FitStatus, string> = {
  TOO_TIGHT: 'Too Tight',
  PERFECT:   'Perfect Fit',
  TOO_LOOSE: 'Too Loose',
};

const FIT_COLORS: Record<FitStatus, string> = {
  TOO_TIGHT: 'text-red-400   bg-red-400/15   border-red-400/30',
  PERFECT:   'text-green-400 bg-green-400/15 border-green-400/30',
  TOO_LOOSE: 'text-blue-400  bg-blue-400/15  border-blue-400/30',
};

const FIT_HC: Record<FitStatus, string> = {
  TOO_TIGHT: 'text-black bg-red-400   border-red-600',
  PERFECT:   'text-black bg-green-400 border-green-600',
  TOO_LOOSE: 'text-black bg-blue-400  border-blue-600',
};

const ISSUE_LABELS: Record<FitIssue, string> = {
  SLEEVE_TOO_SHORT:    'Sleeves too short',
  SLEEVE_TOO_LONG:     'Sleeves too long',
  SHOULDERS_TOO_NARROW:'Shoulders too narrow',
  SHOULDERS_TOO_WIDE:  'Shoulders too wide',
  CHEST_TOO_TIGHT:     'Chest too tight',
  CHEST_TOO_LOOSE:     'Chest too loose',
  LENGTH_TOO_SHORT:    'Length too short',
  LENGTH_TOO_LONG:     'Length too long',
};

export function FitIndicator({ overallFit, issues, confidence, highContrast = false }: Props) {
  const colorClass = highContrast ? FIT_HC[overallFit] : FIT_COLORS[overallFit];
  const confPct    = Math.round(confidence * 100);

  return (
    <div
      className={`rounded-xl border px-3 py-2 space-y-2 ${colorClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Fit status: ${FIT_LABELS[overallFit]}, ${confPct}% confidence`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{FIT_LABELS[overallFit]}</span>
        <span className="text-xs opacity-70">{confPct}% confidence</span>
      </div>

      {issues.length > 0 && (
        <ul className="text-xs space-y-0.5 opacity-80" aria-label="Fit issues">
          {issues.map((issue) => (
            <li key={issue} className="flex items-center gap-1">
              <span aria-hidden="true">•</span>
              {ISSUE_LABELS[issue]}
            </li>
          ))}
        </ul>
      )}

      {issues.length === 0 && (
        <p className="text-xs opacity-70">No fit issues detected</p>
      )}
    </div>
  );
}
