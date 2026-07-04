import type {
  PhysicalMeasurements,
  ClothingSize,
  SizeChart,
  FitStatus,
  FitIssue,
  FitAnalysis,
} from './fit.types.js';
import { ALL_SIZES } from './fit.types.js';

const PERFECT_TOLERANCE = 4;  // cm — within this range of chart bounds = perfect
const LOOSE_THRESHOLD   = 8;  // cm — more than this over = too loose

function classifyFit(value: number, range: [number, number]): FitStatus {
  if (value < range[0] - PERFECT_TOLERANCE) return 'TOO_TIGHT';
  if (value > range[1] + LOOSE_THRESHOLD)   return 'TOO_LOOSE';
  return 'PERFECT';
}

export class GarmentFitService {
  /**
   * Analyses how well a user's physical measurements match the given size in
   * the provided chart. Returns per-dimension fit status and a list of issues.
   */
  analyzeFit(
    measurements: PhysicalMeasurements,
    chart: SizeChart,
    size: ClothingSize,
  ): FitAnalysis {
    const range = chart.sizes[size];
    const issues: FitIssue[] = [];

    // ── Chest ─────────────────────────────────────────────────────────────────
    const chestFit = classifyFit(measurements.chestCircumference, range.chest);
    if (chestFit === 'TOO_TIGHT') issues.push('CHEST_TOO_TIGHT');
    if (chestFit === 'TOO_LOOSE') issues.push('CHEST_TOO_LOOSE');

    // ── Shoulder ──────────────────────────────────────────────────────────────
    const shoulderFit = classifyFit(measurements.shoulderWidth, range.shoulder);
    if (shoulderFit === 'TOO_TIGHT') issues.push('SHOULDERS_TOO_NARROW');
    if (shoulderFit === 'TOO_LOOSE') issues.push('SHOULDERS_TOO_WIDE');

    // ── Sleeve ────────────────────────────────────────────────────────────────
    let sleeveFit: FitStatus = 'PERFECT';
    if (range.sleeveLength) {
      sleeveFit = classifyFit(measurements.sleeveLength, range.sleeveLength);
      if (sleeveFit === 'TOO_TIGHT') issues.push('SLEEVE_TOO_SHORT');
      if (sleeveFit === 'TOO_LOOSE') issues.push('SLEEVE_TOO_LONG');
    }

    // ── Torso length (no direct chart value; compare to estimated garment length) ──
    // Approximate garment length based on torso being ~30% of estimated height
    const estimatedGarmentLength = measurements.estimatedHeight * 0.38;
    const torsoFit = classifyFit(measurements.torsoLength, [
      estimatedGarmentLength - 8,
      estimatedGarmentLength + 8,
    ]);
    if (torsoFit === 'TOO_TIGHT') issues.push('LENGTH_TOO_SHORT');
    if (torsoFit === 'TOO_LOOSE') issues.push('LENGTH_TOO_LONG');

    // ── Overall ───────────────────────────────────────────────────────────────
    const fitValues: FitStatus[] = [chestFit, shoulderFit, sleeveFit];
    const overallFit: FitStatus =
      fitValues.every((f) => f === 'PERFECT') ? 'PERFECT' :
      fitValues.filter((f) => f === 'TOO_TIGHT').length > fitValues.filter((f) => f === 'TOO_LOOSE').length
        ? 'TOO_TIGHT'
        : 'TOO_LOOSE';

    return {
      overallFit,
      chestFit,
      shoulderFit,
      sleeveFit,
      issues,
      confidence: measurements.confidence,
      recommendedSize: size,
    };
  }

  /** Checks if sizing up one step would improve fit */
  suggestAlternative(
    measurements: PhysicalMeasurements,
    chart: SizeChart,
    currentSize: ClothingSize,
  ): ClothingSize | null {
    const currentFit = this.analyzeFit(measurements, chart, currentSize);
    if (currentFit.overallFit === 'PERFECT') return null;

    const currentIdx = ALL_SIZES.indexOf(currentSize);
    const delta = currentFit.overallFit === 'TOO_TIGHT' ? 1 : -1;
    const altIdx = currentIdx + delta;

    if (altIdx < 0 || altIdx >= ALL_SIZES.length) return null;
    return ALL_SIZES[altIdx];
  }
}
