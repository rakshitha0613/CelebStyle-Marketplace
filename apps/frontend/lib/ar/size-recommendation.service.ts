import type { GarmentType } from './garment.types.js';
import type {
  PhysicalMeasurements,
  ClothingSize,
  SizeChart,
  SizeRange,
  SizeRecommendation,
  FitAnalysis,
} from './fit.types.js';
import {
  ALL_SIZES,
  STANDARD_SIZE_CHART,
  BRAND_SCALE_FACTORS,
} from './fit.types.js';
import { GarmentFitService } from './garment-fit.service.js';

// ── Fit tolerance (cm) ────────────────────────────────────────────────────────
const FIT_TOLERANCE = 3;  // within ±3cm of range = "perfect"

export class SizeRecommendationService {
  private readonly charts: Map<string, SizeChart>;
  private readonly fitService: GarmentFitService;

  constructor() {
    this.charts = new Map([['standard', STANDARD_SIZE_CHART]]);
    this.fitService = new GarmentFitService();
  }

  addChart(chart: SizeChart): void {
    this.charts.set(chart.brand, chart);
  }

  /**
   * Returns the recommended size for the given measurements and garment type.
   *
   * Primary dimension: chestCircumference
   * Secondary:         shoulderWidth
   * When near a size boundary, the larger size is recommended for comfort.
   */
  getRecommendedSize(
    measurements: PhysicalMeasurements,
    _garmentType: GarmentType,
    brand?: string,
  ): SizeRecommendation {
    const chart     = this.charts.get(brand ?? 'standard') ?? STANDARD_SIZE_CHART;
    const scaledMes = this._scaleForBrand(measurements, chart.scaleFactor);

    const { size, confidence, alternativeSize } = this._findBestSize(
      scaledMes.chestCircumference,
      scaledMes.shoulderWidth,
      chart,
    );

    const fitAnalysis: FitAnalysis = this.fitService.analyzeFit(
      scaledMes, chart, size,
    );

    const brandSizes = this._computeBrandSizes(measurements);
    const notes = this._generateNotes(measurements, size, confidence, fitAnalysis);

    return {
      size,
      confidence,
      fitAnalysis,
      alternativeSize,
      brandSizes,
      notes,
    };
  }

  private _findBestSize(
    chestCm: number,
    shoulderCm: number,
    chart: SizeChart,
  ): { size: ClothingSize; confidence: number; alternativeSize: ClothingSize | null } {
    // Try to find a range that fully contains the chest measurement
    for (const s of ALL_SIZES) {
      const range = chart.sizes[s];
      if (chestCm >= range.chest[0] && chestCm <= range.chest[1]) {
        const confidence = this._rangeConfidence(chestCm, range.chest);
        // Near top boundary → suggest one size up as alternative
        const rangeWidth = range.chest[1] - range.chest[0];
        const distToTop  = range.chest[1] - chestCm;
        const alt = distToTop < rangeWidth * 0.25
          ? this._nextSize(s, 1)
          : distToTop > rangeWidth * 0.75 ? this._nextSize(s, -1) : null;
        return { size: s, confidence, alternativeSize: alt };
      }
    }

    // No exact range: return closest size
    let bestSize: ClothingSize = 'M';
    let minDist = Infinity;
    for (const s of ALL_SIZES) {
      const range = chart.sizes[s];
      const mid   = (range.chest[0] + range.chest[1]) / 2;
      const dist  = Math.abs(chestCm - mid);
      if (dist < minDist) { minDist = dist; bestSize = s; }
    }
    const range = chart.sizes[bestSize];
    const confidence = Math.max(0, 1 - minDist / ((range.chest[1] - range.chest[0]) * 2));

    // Verify shoulder match, bias larger if shoulder says go up
    const sRange = chart.sizes[bestSize];
    if (shoulderCm > sRange.shoulder[1] + FIT_TOLERANCE) {
      const up = this._nextSize(bestSize, 1);
      if (up) return { size: up, confidence: confidence * 0.8, alternativeSize: bestSize };
    }

    return { size: bestSize, confidence, alternativeSize: this._nextSize(bestSize, 1) };
  }

  /** Confidence = how centered the measurement is within the range (1.0 = exact center) */
  private _rangeConfidence(value: number, range: [number, number]): number {
    const mid  = (range[0] + range[1]) / 2;
    const half = (range[1] - range[0]) / 2;
    return half > 0 ? Math.max(0, 1 - Math.abs(value - mid) / half) : 1;
  }

  private _nextSize(size: ClothingSize, delta: 1 | -1): ClothingSize | null {
    const idx = ALL_SIZES.indexOf(size) + delta;
    return (idx >= 0 && idx < ALL_SIZES.length) ? ALL_SIZES[idx] : null;
  }

  private _scaleForBrand(
    m: PhysicalMeasurements,
    scaleFactor: number,
  ): PhysicalMeasurements {
    if (scaleFactor === 1.0) return m;
    return {
      ...m,
      chestCircumference: m.chestCircumference / scaleFactor,
      shoulderWidth:      m.shoulderWidth / scaleFactor,
    };
  }

  private _computeBrandSizes(m: PhysicalMeasurements): Partial<Record<string, ClothingSize>> {
    const result: Partial<Record<string, ClothingSize>> = {};
    for (const [brand, factor] of Object.entries(BRAND_SCALE_FACTORS)) {
      const fakeChart: SizeChart = {
        ...STANDARD_SIZE_CHART,
        brand,
        scaleFactor: factor,
      };
      const { size } = this._findBestSize(
        m.chestCircumference / factor,
        m.shoulderWidth / factor,
        fakeChart,
      );
      result[brand] = size;
    }
    return result;
  }

  private _generateNotes(
    m: PhysicalMeasurements,
    size: ClothingSize,
    confidence: number,
    fit: FitAnalysis,
  ): string[] {
    const notes: string[] = [];
    if (confidence < 0.5) notes.push('Move to better lighting for improved accuracy.');
    if (m.confidence < 0.7) notes.push('Stand upright facing the camera for best results.');
    if (fit.issues.includes('SLEEVE_TOO_SHORT')) notes.push('Sleeves may run slightly short.');
    if (fit.issues.includes('SLEEVE_TOO_LONG'))  notes.push('Sleeves may be slightly long.');
    if (fit.issues.includes('CHEST_TOO_TIGHT'))  notes.push('Consider sizing up for comfort.');
    if (size === 'XXL') notes.push('If between sizes, XXL is recommended.');
    return notes;
  }
}
