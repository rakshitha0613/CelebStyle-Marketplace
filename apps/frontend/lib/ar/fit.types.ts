import type { GarmentType } from './garment.types.js';

// ── Clothing sizes ─────────────────────────────────────────────────────────────

export type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export const ALL_SIZES: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// ── Physical body measurements (real-world cm) ─────────────────────────────────

export interface PhysicalMeasurements {
  shoulderWidth: number;        // cm — shoulder point to shoulder point
  chestCircumference: number;   // cm — full chest girth estimate
  waistWidth: number;           // cm — estimated waist width
  hipWidth: number;             // cm — hip width
  torsoLength: number;          // cm — shoulder mid to hip mid
  sleeveLength: number;         // cm — shoulder to wrist (one side)
  estimatedHeight: number;      // cm — proportional estimate
  confidence: number;           // 0–1 — weighted landmark visibility
}

// ── Size charts ────────────────────────────────────────────────────────────────

export interface SizeRange {
  chest: [number, number];      // [min, max] cm full circumference
  shoulder: [number, number];   // [min, max] cm
  waist?: [number, number];
  sleeveLength?: [number, number];
}

export interface SizeChart {
  brand: string;
  sizes: Record<ClothingSize, SizeRange>;
  /** Multiplier applied to all measurements — >1 means brand runs small */
  scaleFactor: number;
}

/** Standard international unisex size chart */
export const STANDARD_SIZE_CHART: SizeChart = {
  brand: 'standard',
  scaleFactor: 1.0,
  sizes: {
    XS:  { chest: [80,  86],  shoulder: [36, 39], waist: [63, 68],  sleeveLength: [56, 59] },
    S:   { chest: [87,  92],  shoulder: [40, 42], waist: [69, 74],  sleeveLength: [59, 62] },
    M:   { chest: [93,  98],  shoulder: [43, 45], waist: [75, 80],  sleeveLength: [62, 65] },
    L:   { chest: [99,  104], shoulder: [46, 48], waist: [81, 86],  sleeveLength: [65, 68] },
    XL:  { chest: [105, 110], shoulder: [49, 51], waist: [87, 92],  sleeveLength: [68, 71] },
    XXL: { chest: [111, 117], shoulder: [52, 55], waist: [93, 100], sleeveLength: [71, 74] },
  },
};

/** Brand-specific scale factors */
export const BRAND_SCALE_FACTORS: Record<string, number> = {
  european: 0.95,
  american: 1.05,
  asian:    0.88,
  uk:       0.97,
};

// ── Fit analysis ───────────────────────────────────────────────────────────────

export type FitStatus = 'TOO_TIGHT' | 'PERFECT' | 'TOO_LOOSE';

export type FitIssue =
  | 'SLEEVE_TOO_SHORT'
  | 'SLEEVE_TOO_LONG'
  | 'SHOULDERS_TOO_NARROW'
  | 'SHOULDERS_TOO_WIDE'
  | 'CHEST_TOO_TIGHT'
  | 'CHEST_TOO_LOOSE'
  | 'LENGTH_TOO_SHORT'
  | 'LENGTH_TOO_LONG';

export interface FitAnalysis {
  overallFit: FitStatus;
  chestFit: FitStatus;
  shoulderFit: FitStatus;
  sleeveFit: FitStatus;
  issues: FitIssue[];
  confidence: number;
  recommendedSize: ClothingSize;
}

export interface SizeRecommendation {
  size: ClothingSize;
  confidence: number;  // 0–1
  fitAnalysis: FitAnalysis;
  alternativeSize: ClothingSize | null;  // next size up/down if near boundary
  brandSizes: Partial<Record<string, ClothingSize>>;
  notes: string[];
}

// ── Outfit composition ─────────────────────────────────────────────────────────

export type OutfitSlot = 'top' | 'bottom' | 'jacket' | 'shoes' | 'accessory';

export const REQUIRED_SLOTS: OutfitSlot[] = ['top'];
export const ALL_SLOTS: OutfitSlot[] = ['top', 'bottom', 'jacket', 'shoes', 'accessory'];

export interface OutfitItem {
  slot: OutfitSlot;
  garmentId: string;
  garmentName: string;
  garmentType: GarmentType | 'BOTTOM' | 'SHOES' | 'ACCESSORY';
  size: ClothingSize;
  imageUrl: string;
  price?: number;
  color?: string;
}

export interface Outfit {
  id: string;
  name: string;
  items: OutfitItem[];
  createdAt: number;
  updatedAt: number;
}

// ── Outfit scoring ─────────────────────────────────────────────────────────────

export interface OutfitScore {
  overall: number;        // 0–100 weighted average
  colorHarmony: number;   // 0–100
  styleCompat: number;    // 0–100
  seasonScore: number;    // 0–100
  trendingScore: number;  // 0–100
  occasionScore: number;  // 0–100
  personalScore: number;  // 0–100
  celebritySimilarity: number; // 0–100
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Occasion = 'casual' | 'formal' | 'sport' | 'party' | 'business';

export const SCORE_WEIGHTS: Record<keyof OutfitScore, number> = {
  overall:             0,    // derived
  colorHarmony:        0.25,
  styleCompat:         0.20,
  seasonScore:         0.15,
  trendingScore:       0.15,
  occasionScore:       0.15,
  personalScore:       0.05,
  celebritySimilarity: 0.05,
};

// ── Wishlist ───────────────────────────────────────────────────────────────────

export interface WishlistEntry {
  id: string;
  outfit: Outfit;
  addedAt: number;
  notes: string;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
