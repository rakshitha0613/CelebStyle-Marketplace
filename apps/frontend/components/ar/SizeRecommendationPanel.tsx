'use client';

import type { PhysicalMeasurements, SizeRecommendation } from '@/lib/ar/fit.types';
import { FitIndicator } from './FitIndicator';

interface Props {
  measurements: PhysicalMeasurements | null;
  recommendation: SizeRecommendation | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  highContrast?: boolean;
}

function MeasurementRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex justify-between text-xs text-white/70">
      <span>{label}</span>
      <span className="text-white font-medium tabular-nums">
        {value.toFixed(1)}<span className="text-white/50 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

export function SizeRecommendationPanel({
  measurements,
  recommendation,
  isCollapsed = false,
  onToggleCollapse,
  highContrast = false,
}: Props) {
  return (
    <section
      className="bg-white/5 rounded-2xl overflow-hidden"
      aria-labelledby="size-rec-heading"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-expanded={!isCollapsed}
        aria-controls="size-rec-body"
        onClick={onToggleCollapse}
      >
        <h3
          id="size-rec-heading"
          className="text-sm font-semibold text-white/80 tracking-wide uppercase"
        >
          Size &amp; Fit
        </h3>
        <div className="flex items-center gap-2">
          {recommendation && (
            <span className="text-white font-bold text-lg">{recommendation.size}</span>
          )}
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
        <div id="size-rec-body" className="px-4 pb-4 space-y-4">
          {!measurements && (
            <p className="text-xs text-white/40 text-center py-2">
              Stand facing the camera to detect your measurements.
            </p>
          )}

          {measurements && (
            <>
              {/* Size badge */}
              {recommendation && (
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{recommendation.size}</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {Math.round(recommendation.confidence * 100)}% confidence
                    </div>
                  </div>
                  {recommendation.alternativeSize && (
                    <div className="text-center text-white/60">
                      <div className="text-xs mb-0.5">Also fits</div>
                      <div className="text-xl font-semibold text-white/70">
                        {recommendation.alternativeSize}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fit indicator */}
              {recommendation && (
                <FitIndicator
                  overallFit={recommendation.fitAnalysis.overallFit}
                  issues={recommendation.fitAnalysis.issues}
                  confidence={recommendation.fitAnalysis.confidence}
                  highContrast={highContrast}
                />
              )}

              {/* Measurements table */}
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-white/40 uppercase tracking-wide">Detected measurements</p>
                <MeasurementRow label="Shoulder"  value={measurements.shoulderWidth}       unit="cm" />
                <MeasurementRow label="Chest"     value={measurements.chestCircumference}  unit="cm" />
                <MeasurementRow label="Waist"     value={measurements.waistWidth}          unit="cm" />
                <MeasurementRow label="Hip"       value={measurements.hipWidth}            unit="cm" />
                <MeasurementRow label="Sleeve"    value={measurements.sleeveLength}        unit="cm" />
                <MeasurementRow label="Height est."value={measurements.estimatedHeight}    unit="cm" />
              </div>

              {/* Brand size grid */}
              {recommendation?.brandSizes && Object.keys(recommendation.brandSizes).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-white/40 uppercase tracking-wide">Brand sizes</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(recommendation.brandSizes).map(([brand, size]) => (
                      <div
                        key={brand}
                        className="flex justify-between bg-white/5 rounded-lg px-2 py-1"
                      >
                        <span className="text-xs text-white/50 capitalize">{brand}</span>
                        <span className="text-xs text-white font-medium">{size}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {recommendation?.notes && recommendation.notes.length > 0 && (
                <ul className="space-y-1" aria-label="Sizing notes">
                  {recommendation.notes.map((note, i) => (
                    <li key={i} className="text-xs text-white/50 flex gap-1.5">
                      <span aria-hidden="true" className="text-white/30">ℹ</span>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
