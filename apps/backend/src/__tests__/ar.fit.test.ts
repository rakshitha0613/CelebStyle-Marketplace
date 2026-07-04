/**
 * @ar6.5.celebstyle.fit — Sprint 6.5 Size Recommendation & Outfit Composer Tests
 * Self-contained Node.js. No browser APIs required.
 */

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓  ${label}`); passed++; }
  else           { console.error(`  ✗  ${label}`); failed++; }
}

function approx(a: number, b: number, tol = 0.5): boolean {
  return Math.abs(a - b) <= tol;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline types
// ─────────────────────────────────────────────────────────────────────────────

type ClothingSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
const ALL_SIZES: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

type FitStatus = 'TOO_TIGHT' | 'PERFECT' | 'TOO_LOOSE';
type FitIssue  =
  | 'SLEEVE_TOO_SHORT' | 'SLEEVE_TOO_LONG'
  | 'SHOULDERS_TOO_NARROW' | 'SHOULDERS_TOO_WIDE'
  | 'CHEST_TOO_TIGHT'  | 'CHEST_TOO_LOOSE'
  | 'LENGTH_TOO_SHORT' | 'LENGTH_TOO_LONG';

type Season   = 'spring' | 'summer' | 'autumn' | 'winter';
type Occasion = 'casual' | 'formal' | 'sport' | 'party' | 'business';
type GarmentType = 'T_SHIRT' | 'SHIRT' | 'JACKET' | 'HOODIE';
type OutfitSlot  = 'top' | 'bottom' | 'jacket' | 'shoes' | 'accessory';

const REQUIRED_SLOTS: OutfitSlot[] = ['top'];
const ALL_SLOTS:      OutfitSlot[] = ['top', 'bottom', 'jacket', 'shoes', 'accessory'];

interface SizeRange {
  chest:    [number, number];
  shoulder: [number, number];
  waist?:   [number, number];
  sleeveLength?: [number, number];
}

interface SizeChart {
  brand: string;
  sizes: Record<ClothingSize, SizeRange>;
  scaleFactor: number;
}

interface PhysicalMeasurements {
  shoulderWidth: number;
  chestCircumference: number;
  waistWidth: number;
  hipWidth: number;
  torsoLength: number;
  sleeveLength: number;
  estimatedHeight: number;
  confidence: number;
}

interface FitAnalysis {
  overallFit: FitStatus;
  chestFit:   FitStatus;
  shoulderFit:FitStatus;
  sleeveFit:  FitStatus;
  issues:     FitIssue[];
  confidence: number;
  recommendedSize: ClothingSize;
}

interface SizeRecommendation {
  size: ClothingSize;
  confidence: number;
  fitAnalysis: FitAnalysis;
  alternativeSize: ClothingSize | null;
  brandSizes: Partial<Record<string, ClothingSize>>;
  notes: string[];
}

interface PoseLandmark { x: number; y: number; z: number; visibility: number; }

interface OutfitItem {
  slot: OutfitSlot;
  garmentId: string;
  garmentName: string;
  garmentType: string;
  size: ClothingSize;
  imageUrl: string;
  price?: number;
  color?: string;
}

interface Outfit {
  id: string;
  name: string;
  items: OutfitItem[];
  createdAt: number;
  updatedAt: number;
}

interface WishlistEntry {
  id: string;
  outfit: Outfit;
  addedAt: number;
  notes: string;
}

interface StorageAdapter {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

interface OutfitScore {
  overall:           number;
  colorHarmony:      number;
  styleCompat:       number;
  seasonScore:       number;
  trendingScore:     number;
  occasionScore:     number;
  personalScore:     number;
  celebritySimilarity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants
// ─────────────────────────────────────────────────────────────────────────────

const STANDARD_SIZE_CHART: SizeChart = {
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

const BRAND_SCALE_FACTORS: Record<string, number> = {
  european: 0.95,
  american: 1.05,
  asian:    0.88,
  uk:       0.97,
};

const PERFECT_TOLERANCE = 4;
const LOOSE_THRESHOLD   = 8;

const SCORE_WEIGHTS: Record<keyof OutfitScore, number> = {
  overall: 0, colorHarmony: 0.25, styleCompat: 0.20, seasonScore: 0.15,
  trendingScore: 0.15, occasionScore: 0.15, personalScore: 0.05, celebritySimilarity: 0.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline implementations
// ─────────────────────────────────────────────────────────────────────────────

// ── BodyMeasurementService ──────────────────────────────────────────────────

const REFERENCE_SHOULDER_CM = 43;
const SHOULDER_TO_HEIGHT = 0.259;
const TORSO_TO_HEIGHT    = 0.306;
const ARM_TO_HEIGHT      = 0.221;
const HIP_OFFSET         = 0.10;
const WAIST_OF_HIP       = 0.82;

function pxDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function estimateMeasurements(
  landmarks: PoseLandmark[],
  canvasW: number,
  canvasH: number,
  threshold = 0.5,
): PhysicalMeasurements | null {
  const ls = landmarks[11], rs = landmarks[12];
  if (!ls || !rs) return null;
  if (ls.visibility < threshold || rs.visibility < threshold) return null;

  const lsX = ls.x * canvasW, lsY = ls.y * canvasH;
  const rsX = rs.x * canvasW, rsY = rs.y * canvasH;
  const shoulderWidthPx = pxDist(lsX, lsY, rsX, rsY);
  if (shoulderWidthPx < 1) return null;

  const scaleFactor = REFERENCE_SHOULDER_CM / shoulderWidthPx;
  const shoulderWidth = REFERENCE_SHOULDER_CM;
  const estimatedHeight = Math.round(shoulderWidth / SHOULDER_TO_HEIGHT);

  const lh = landmarks[23], rh = landmarks[24];
  const hipVisible = lh && rh && lh.visibility >= threshold && rh.visibility >= threshold;
  let torsoLength: number, hipWidthCm: number;
  if (hipVisible) {
    const lhX = lh!.x * canvasW, lhY = lh!.y * canvasH;
    const rhX = rh!.x * canvasW, rhY = rh!.y * canvasH;
    const smX = (lsX + rsX) / 2, smY = (lsY + rsY) / 2;
    const hmX = (lhX + rhX) / 2, hmY = (lhY + rhY) / 2;
    torsoLength = pxDist(smX, smY, hmX, hmY) * scaleFactor;
    hipWidthCm  = pxDist(lhX, lhY, rhX, rhY) * scaleFactor;
  } else {
    torsoLength = estimatedHeight * TORSO_TO_HEIGHT;
    hipWidthCm  = shoulderWidth * (1 + HIP_OFFSET);
  }

  const le = landmarks[13], re = landmarks[14];
  const lw = landmarks[15], rw = landmarks[16];
  const armVisible = le && re && lw && rw &&
    le.visibility >= threshold && re.visibility >= threshold &&
    lw.visibility >= threshold && rw.visibility >= threshold;
  let sleeveLength: number;
  if (armVisible) {
    const leX = le!.x * canvasW, leY = le!.y * canvasH;
    const reX = re!.x * canvasW, reY = re!.y * canvasH;
    const lwX = lw!.x * canvasW, lwY = lw!.y * canvasH;
    const rwX = rw!.x * canvasW, rwY = rw!.y * canvasH;
    const leftArm  = (pxDist(lsX, lsY, leX, leY) + pxDist(leX, leY, lwX, lwY)) * scaleFactor;
    const rightArm = (pxDist(rsX, rsY, reX, reY) + pxDist(reX, reY, rwX, rwY)) * scaleFactor;
    sleeveLength = (leftArm + rightArm) / 2;
  } else {
    sleeveLength = estimatedHeight * ARM_TO_HEIGHT;
  }

  const chestCircumference = shoulderWidth * 2.2;
  const waistWidth         = hipWidthCm * WAIST_OF_HIP;

  const usedVis = [ls.visibility, rs.visibility];
  if (hipVisible) usedVis.push(lh!.visibility, rh!.visibility);
  if (armVisible) usedVis.push(le!.visibility, re!.visibility, lw!.visibility, rw!.visibility);
  const confidence = usedVis.reduce((s, v) => s + v, 0) / usedVis.length;

  return {
    shoulderWidth,
    chestCircumference: Math.round(chestCircumference * 10) / 10,
    waistWidth:         Math.round(waistWidth * 10) / 10,
    hipWidth:           Math.round(hipWidthCm * 10) / 10,
    torsoLength:        Math.round(torsoLength * 10) / 10,
    sleeveLength:       Math.round(sleeveLength * 10) / 10,
    estimatedHeight:    Math.round(estimatedHeight),
    confidence:         Math.min(1, Math.max(0, confidence)),
  };
}

// ── GarmentFitService ───────────────────────────────────────────────────────

function fitStatus(value: number, range: [number, number]): FitStatus {
  if (value < range[0] - PERFECT_TOLERANCE) return 'TOO_TIGHT';
  if (value > range[1] + LOOSE_THRESHOLD)   return 'TOO_LOOSE';
  return 'PERFECT';
}

function analyzeFit(
  m: PhysicalMeasurements,
  chart: SizeChart,
  size: ClothingSize,
): FitAnalysis {
  const range  = chart.sizes[size];
  const issues: FitIssue[] = [];

  const chestFit    = fitStatus(m.chestCircumference, range.chest);
  const shoulderFit = fitStatus(m.shoulderWidth * 2, range.shoulder); // shoulder is half-width in chart
  const sleeveFit   = range.sleeveLength
    ? fitStatus(m.sleeveLength, range.sleeveLength) : 'PERFECT';

  if (chestFit === 'TOO_TIGHT')    issues.push('CHEST_TOO_TIGHT');
  if (chestFit === 'TOO_LOOSE')    issues.push('CHEST_TOO_LOOSE');
  if (sleeveFit === 'TOO_TIGHT')   issues.push('SLEEVE_TOO_SHORT');
  if (sleeveFit === 'TOO_LOOSE')   issues.push('SLEEVE_TOO_LONG');

  const votes = [chestFit, shoulderFit, sleeveFit];
  const tightCount  = votes.filter((v) => v === 'TOO_TIGHT').length;
  const looseCount  = votes.filter((v) => v === 'TOO_LOOSE').length;
  const overallFit: FitStatus = tightCount >= 2 ? 'TOO_TIGHT' : looseCount >= 2 ? 'TOO_LOOSE' : 'PERFECT';

  return {
    overallFit,
    chestFit,
    shoulderFit,
    sleeveFit,
    issues,
    confidence: m.confidence,
    recommendedSize: size,
  };
}

// ── SizeRecommendationService ───────────────────────────────────────────────

function rangeConfidence(value: number, range: [number, number]): number {
  const mid  = (range[0] + range[1]) / 2;
  const half = (range[1] - range[0]) / 2;
  return half > 0 ? Math.max(0, 1 - Math.abs(value - mid) / half) : 1;
}

function nextSize(size: ClothingSize, delta: 1 | -1): ClothingSize | null {
  const idx = ALL_SIZES.indexOf(size) + delta;
  return idx >= 0 && idx < ALL_SIZES.length ? ALL_SIZES[idx] : null;
}

function findBestSize(
  chest: number,
  shoulder: number,
  chart: SizeChart,
): { size: ClothingSize; confidence: number; alternativeSize: ClothingSize | null } {
  for (const s of ALL_SIZES) {
    const r = chart.sizes[s];
    if (chest >= r.chest[0] && chest <= r.chest[1]) {
      const confidence = rangeConfidence(chest, r.chest);
      const rw = r.chest[1] - r.chest[0];
      const dt = r.chest[1] - chest;
      const alt = dt < rw * 0.25 ? nextSize(s, 1) : dt > rw * 0.75 ? nextSize(s, -1) : null;
      return { size: s, confidence, alternativeSize: alt };
    }
  }
  let bestSize: ClothingSize = 'M'; let minDist = Infinity;
  for (const s of ALL_SIZES) {
    const r   = chart.sizes[s];
    const mid = (r.chest[0] + r.chest[1]) / 2;
    const d   = Math.abs(chest - mid);
    if (d < minDist) { minDist = d; bestSize = s; }
  }
  const r          = chart.sizes[bestSize];
  const confidence = Math.max(0, 1 - minDist / ((r.chest[1] - r.chest[0]) * 2));
  return { size: bestSize, confidence, alternativeSize: nextSize(bestSize, 1) };
}

function getRecommendedSize(
  m: PhysicalMeasurements,
  brand?: string,
): SizeRecommendation {
  const chart   = STANDARD_SIZE_CHART;
  const factor  = brand ? (BRAND_SCALE_FACTORS[brand] ?? 1.0) : 1.0;
  const scaledM = factor === 1.0 ? m : { ...m, chestCircumference: m.chestCircumference / factor, shoulderWidth: m.shoulderWidth / factor };

  const { size, confidence, alternativeSize } = findBestSize(
    scaledM.chestCircumference, scaledM.shoulderWidth, chart,
  );
  const fitAnalysis = analyzeFit(scaledM, chart, size);
  const brandSizes: Partial<Record<string, ClothingSize>> = {};
  for (const [b, f] of Object.entries(BRAND_SCALE_FACTORS)) {
    const { size: bs } = findBestSize(m.chestCircumference / f, m.shoulderWidth / f, chart);
    brandSizes[b] = bs;
  }
  const notes: string[] = [];
  if (confidence < 0.5) notes.push('Move to better lighting for improved accuracy.');
  if (m.confidence < 0.7) notes.push('Stand upright facing the camera for best results.');

  return { size, confidence, fitAnalysis, alternativeSize, brandSizes, notes };
}

// ── OutfitComposerService ───────────────────────────────────────────────────

class MockOutfitComposer {
  private slots = new Map<OutfitSlot, OutfitItem>();
  private name = 'My Outfit';

  addItem(item: OutfitItem): void { this.slots.set(item.slot, item); }
  removeItem(slot: OutfitSlot): void { this.slots.delete(slot); }
  getItem(slot: OutfitSlot): OutfitItem | null { return this.slots.get(slot) ?? null; }
  hasItem(slot: OutfitSlot): boolean { return this.slots.has(slot); }
  clearOutfit(): void { this.slots.clear(); }
  setName(n: string): void { this.name = n.trim() || 'My Outfit'; }
  getName(): string { return this.name; }
  isComplete(): boolean { return REQUIRED_SLOTS.every((s) => this.slots.has(s)); }
  getFilledSlots(): OutfitSlot[] { return [...this.slots.keys()]; }
  getItemCount(): number { return this.slots.size; }

  buildOutfit(): Outfit | null {
    if (!this.isComplete()) return null;
    return {
      id:        Math.random().toString(36).slice(2, 8),
      name:      this.name,
      items:     [...this.slots.values()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  loadOutfit(outfit: Outfit): void {
    this.slots.clear();
    this.name = outfit.name;
    for (const item of outfit.items) this.slots.set(item.slot, item);
  }

  computeCompatibility(): number {
    const types = [...this.slots.values()].map((i) => i.garmentType);
    if (types.length <= 1) return 100;
    const pairs = new Map([
      ['T_SHIRT|BOTTOM', 85], ['SHIRT|BOTTOM', 90], ['JACKET|SHIRT', 92],
      ['JACKET|T_SHIRT', 78], ['HOODIE|BOTTOM', 88], ['JACKET|BOTTOM', 85],
    ]);
    let total = 0, count = 0;
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        total += pairs.get(`${types[i]}|${types[j]}`) ?? pairs.get(`${types[j]}|${types[i]}`) ?? 70;
        count++;
      }
    }
    return count > 0 ? Math.round(total / count) : 100;
  }
}

// ── OutfitScoringService ────────────────────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const raw = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function colorHarmonyScore(hues: number[], saturations: number[]): number {
  const active = hues.filter((_, i) => saturations[i] > 0.1);
  if (active.length <= 1) return 95;
  let total = 0, pairs = 0;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      let diff = Math.abs(active[i] - active[j]);
      if (diff > 180) diff = 360 - diff;
      total += diff < 30 ? 80 : diff > 150 ? 90 : diff > 90 ? 75 : 55;
      pairs++;
    }
  }
  return pairs === 0 ? 95 : Math.round(total / pairs);
}

const SEASON_SCORES: Record<string, Record<Season, number>> = {
  T_SHIRT:  { spring: 80, summer: 100, autumn: 60, winter: 30 },
  SHIRT:    { spring: 85, summer: 75,  autumn: 85, winter: 70 },
  JACKET:   { spring: 75, summer: 40,  autumn: 95, winter: 95 },
  HOODIE:   { spring: 70, summer: 30,  autumn: 90, winter: 90 },
  BOTTOM:   { spring: 75, summer: 80,  autumn: 80, winter: 75 },
  SHOES:    { spring: 80, summer: 80,  autumn: 80, winter: 80 },
  ACCESSORY:{ spring: 80, summer: 80,  autumn: 80, winter: 80 },
};

const TRENDING_SCORES: Record<string, number> = {
  T_SHIRT: 80, SHIRT: 75, JACKET: 85, HOODIE: 90, BOTTOM: 78, SHOES: 88, ACCESSORY: 72,
};

const OCCASION_SCORES: Record<string, Record<Occasion, number>> = {
  T_SHIRT:  { casual: 90, formal: 25, sport: 85, party: 60, business: 30 },
  SHIRT:    { casual: 70, formal: 85, sport: 30, party: 75, business: 88 },
  JACKET:   { casual: 65, formal: 92, sport: 20, party: 80, business: 90 },
  HOODIE:   { casual: 95, formal: 15, sport: 90, party: 55, business: 20 },
  BOTTOM:   { casual: 80, formal: 70, sport: 70, party: 75, business: 72 },
  SHOES:    { casual: 80, formal: 80, sport: 80, party: 80, business: 80 },
  ACCESSORY:{ casual: 80, formal: 80, sport: 70, party: 85, business: 78 },
};

function styleCompatScore(types: string[]): number {
  if (types.length <= 1) return 100;
  const pairs = new Map([
    ['JACKET|SHIRT', 92], ['JACKET|T_SHIRT', 78], ['JACKET|BOTTOM', 85],
    ['SHIRT|BOTTOM', 90], ['T_SHIRT|BOTTOM', 85], ['HOODIE|BOTTOM', 88],
    ['HOODIE|T_SHIRT', 70], ['SHIRT|T_SHIRT', 65],
  ]);
  let total = 0, count = 0;
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      total += pairs.get(`${types[i]}|${types[j]}`) ?? pairs.get(`${types[j]}|${types[i]}`) ?? 70;
      count++;
    }
  }
  return Math.round(count > 0 ? total / count : 100);
}

function currentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

function scoreOutfit(items: OutfitItem[], season?: Season, occasion: Occasion = 'casual'): OutfitScore {
  if (items.length === 0) return { overall: 0, colorHarmony: 0, styleCompat: 0, seasonScore: 0, trendingScore: 0, occasionScore: 0, personalScore: 0, celebritySimilarity: 0 };
  const s = season ?? currentSeason();
  const types = items.map((i) => String(i.garmentType));
  const hsls = items.map(() => hexToHsl('#888888'));
  const colorHarmony  = colorHarmonyScore(hsls.map((h) => h.h), hsls.map((h) => h.s));
  const styleCompat   = styleCompatScore(types);
  const seasonScore   = Math.round(types.reduce((sum, t) => sum + (SEASON_SCORES[t]?.[s] ?? 75), 0) / types.length);
  const trendingScore = Math.round(types.reduce((sum, t) => sum + (TRENDING_SCORES[t] ?? 75), 0) / types.length);
  const occasionScore = Math.round(types.reduce((sum, t) => sum + (OCCASION_SCORES[t]?.[occasion] ?? 70), 0) / types.length);
  const personalScore = 75;
  const celebScore    = 0;
  const overall = Math.round(
    colorHarmony  * SCORE_WEIGHTS.colorHarmony  +
    styleCompat   * SCORE_WEIGHTS.styleCompat   +
    seasonScore   * SCORE_WEIGHTS.seasonScore   +
    trendingScore * SCORE_WEIGHTS.trendingScore +
    occasionScore * SCORE_WEIGHTS.occasionScore +
    personalScore * SCORE_WEIGHTS.personalScore +
    celebScore    * SCORE_WEIGHTS.celebritySimilarity,
  );
  return { overall, colorHarmony, styleCompat, seasonScore, trendingScore, occasionScore, personalScore, celebritySimilarity: celebScore };
}

// ── WishlistOverlayService ──────────────────────────────────────────────────

function mockStorage(): StorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem:    (k) => store.get(k) ?? null,
    setItem:    (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

class MockWishlistService {
  constructor(private readonly storage: StorageAdapter) {}

  private parse<T>(k: string): T[] {
    const raw = this.storage.getItem(k);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  private save(k: string, v: object): void { this.storage.setItem(k, JSON.stringify(v)); }

  addToWishlist(outfit: Outfit, notes = ''): WishlistEntry {
    const entries = this.getWishlist();
    const entry: WishlistEntry = { id: Math.random().toString(36).slice(2, 8), outfit, addedAt: Date.now(), notes };
    const idx = entries.findIndex((e) => e.outfit.id === outfit.id);
    if (idx >= 0) entries[idx] = entry; else entries.push(entry);
    this.save('celebstyle-wishlist', entries);
    return entry;
  }
  removeFromWishlist(id: string): void {
    const entries = this.getWishlist().filter((e) => e.id !== id);
    this.save('celebstyle-wishlist', entries);
  }
  getWishlist(): WishlistEntry[] { return this.parse<WishlistEntry>('celebstyle-wishlist'); }
  isInWishlist(outfitId: string): boolean { return this.getWishlist().some((e) => e.outfit.id === outfitId); }
  clearWishlist(): void { this.storage.removeItem('celebstyle-wishlist'); }

  saveOutfit(outfit: Outfit): void {
    const saved = this.loadSavedOutfits();
    const idx   = saved.findIndex((o) => o.id === outfit.id);
    if (idx >= 0) saved[idx] = outfit; else saved.push(outfit);
    this.save('celebstyle-saved-outfits', saved);
  }
  loadSavedOutfits(): Outfit[] { return this.parse<Outfit>('celebstyle-saved-outfits'); }
  deleteSavedOutfit(id: string): void {
    const saved = this.loadSavedOutfits().filter((o) => o.id !== id);
    this.save('celebstyle-saved-outfits', saved);
  }

  addAllToCart(outfit: Outfit): void {
    const existing: Array<{ id: string; quantity: number; [k: string]: unknown }> =
      this.parse('celebstyle-cart');
    for (const item of outfit.items) {
      const cid = `${item.garmentId}-${item.size}`;
      const idx = existing.findIndex((c) => c.id === cid);
      if (idx >= 0) existing[idx].quantity += 1;
      else existing.push({ id: cid, name: item.garmentName, size: item.size, price: item.price ?? 999, quantity: 1, imageUrl: item.imageUrl });
    }
    this.save('celebstyle-cart', existing);
  }

  generateShareableUrl(outfit: Outfit): string {
    const payload = JSON.stringify({ id: outfit.id, name: outfit.name, items: outfit.items.map((i) => i.garmentId) });
    const encoded = Buffer.from(payload).toString('base64');
    return `/try-on?outfit=${encoded}`;
  }

  generateShareText(outfit: Outfit): string {
    const names = outfit.items.map((i) => i.garmentName).join(', ');
    return `Check out my CelebStyle outfit: ${outfit.name} featuring ${names}`;
  }

  getWishlistCount(): number { return this.getWishlist().length; }
  getSavedCount(): number    { return this.loadSavedOutfits().length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — landmark factories
// ─────────────────────────────────────────────────────────────────────────────

function makeLandmarks(overrides: Partial<Record<number, Partial<PoseLandmark>>> = {}): PoseLandmark[] {
  const lms: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
  // Shoulders
  lms[11] = { x: 0.3, y: 0.4, z: 0, visibility: 0.95 };
  lms[12] = { x: 0.7, y: 0.4, z: 0, visibility: 0.95 };
  // Hips
  lms[23] = { x: 0.35, y: 0.65, z: 0, visibility: 0.9 };
  lms[24] = { x: 0.65, y: 0.65, z: 0, visibility: 0.9 };
  // Elbows
  lms[13] = { x: 0.15, y: 0.55, z: 0, visibility: 0.85 };
  lms[14] = { x: 0.85, y: 0.55, z: 0, visibility: 0.85 };
  // Wrists
  lms[15] = { x: 0.1,  y: 0.7,  z: 0, visibility: 0.8 };
  lms[16] = { x: 0.9,  y: 0.7,  z: 0, visibility: 0.8 };

  for (const [idx, override] of Object.entries(overrides)) {
    lms[Number(idx)] = { ...lms[Number(idx)], ...override };
  }
  return lms;
}

function makeMeasurements(overrides: Partial<PhysicalMeasurements> = {}): PhysicalMeasurements {
  return {
    shoulderWidth:      43,
    chestCircumference: 94.6,
    waistWidth:         38.6,
    hipWidth:           47.3,
    torsoLength:        52.0,
    sleeveLength:       63.0,
    estimatedHeight:    166,
    confidence:         0.88,
    ...overrides,
  };
}

function makeItem(overrides: Partial<OutfitItem> = {}): OutfitItem {
  return {
    slot:        'top',
    garmentId:   'g1',
    garmentName: 'Test Shirt',
    garmentType: 'SHIRT',
    size:        'M',
    imageUrl:    'https://placehold.co/400x500/888888/ffffff',
    ...overrides,
  };
}

function makeOutfit(items: OutfitItem[] = [makeItem()]): Outfit {
  return {
    id:        'outfit-' + Math.random().toString(36).slice(2, 6),
    name:      'Test Outfit',
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suites
// ─────────────────────────────────────────────────────────────────────────────

// ── Suite 1: Body Measurements ─────────────────────────────────────────────

console.log('\n── Suite 1: Body Measurements ──');

{
  const lms = makeLandmarks();
  const m   = estimateMeasurements(lms, 640, 480);

  ok('returns measurements when both shoulders are visible', m !== null);
  ok('shoulderWidth equals REFERENCE_SHOULDER_CM', m !== null && m.shoulderWidth === 43);
  ok('chestCircumference ≈ 43×2.2', m !== null && approx(m.chestCircumference, 94.6));
  ok('estimatedHeight ≈ 43/0.259', m !== null && approx(m.estimatedHeight, 166, 2));
  ok('confidence is 0–1', m !== null && m.confidence >= 0 && m.confidence <= 1);
  ok('confidence is high when all landmarks visible', m !== null && m.confidence > 0.7);
  ok('torsoLength is positive', m !== null && m.torsoLength > 0);
  ok('sleeveLength is positive', m !== null && m.sleeveLength > 0);
  ok('hipWidth is positive', m !== null && m.hipWidth > 0);
  ok('waistWidth < hipWidth', m !== null && m.waistWidth < m.hipWidth);
}

{
  // Missing shoulder → null
  const lms = makeLandmarks({ 11: { visibility: 0.1 } });
  const m   = estimateMeasurements(lms, 640, 480);
  ok('returns null when left shoulder not visible', m === null);
}

{
  // Without hips — falls back to proportional
  const lms = makeLandmarks({ 23: { visibility: 0.1 }, 24: { visibility: 0.1 } });
  const m   = estimateMeasurements(lms, 640, 480);
  ok('returns measurements even without hip visibility', m !== null);
  ok('torsoLength is proportional when hips not visible',
    m !== null && approx(m.torsoLength, 166 * 0.306, 2));
}

{
  // Without wrists — sleeve falls back to proportional
  const lms = makeLandmarks({ 15: { visibility: 0.1 }, 16: { visibility: 0.1 } });
  const m   = estimateMeasurements(lms, 640, 480);
  ok('returns measurements even without wrist visibility', m !== null);
  ok('sleeveLength is proportional when wrists not visible',
    m !== null && approx(m.sleeveLength, 166 * 0.221, 2));
}

{
  // Confidence is lower when only shoulders are visible
  const lms = makeLandmarks({
    23: { visibility: 0.1 }, 24: { visibility: 0.1 },
    13: { visibility: 0.1 }, 14: { visibility: 0.1 },
    15: { visibility: 0.1 }, 16: { visibility: 0.1 },
  });
  const m = estimateMeasurements(lms, 640, 480);
  ok('confidence is still valid with fewer landmarks visible',
    m !== null && m.confidence >= 0 && m.confidence <= 1);
}

// ── Suite 2: Size Prediction ───────────────────────────────────────────────

console.log('\n── Suite 2: Size Prediction ──');

{
  // M chest range: 93-98
  const m = makeMeasurements({ chestCircumference: 95, shoulderWidth: 44 });
  const r = getRecommendedSize(m);
  ok('recommends M for chest 95cm', r.size === 'M');
  ok('confidence is 0–1', r.confidence >= 0 && r.confidence <= 1);
  ok('fitAnalysis is present', r.fitAnalysis !== null);
  ok('brandSizes has european variant', 'european' in r.brandSizes);
  ok('brandSizes has asian variant', 'asian' in r.brandSizes);
}

{
  // XS chest range: 80-86
  const m = makeMeasurements({ chestCircumference: 83, shoulderWidth: 37 });
  const r = getRecommendedSize(m);
  ok('recommends XS for small chest 83cm', r.size === 'XS');
}

{
  // XXL chest range: 111-117
  const m = makeMeasurements({ chestCircumference: 114, shoulderWidth: 53 });
  const r = getRecommendedSize(m);
  ok('recommends XXL for large chest 114cm', r.size === 'XXL');
}

{
  // Near top boundary → suggests size up as alternative
  const m = makeMeasurements({ chestCircumference: 97.5, shoulderWidth: 44 });
  const r = getRecommendedSize(m);
  ok('near top boundary suggests alternative size', r.alternativeSize !== null);
}

{
  // Exact center → high confidence
  const m = makeMeasurements({ chestCircumference: 95.5, shoulderWidth: 44 });
  const r = getRecommendedSize(m);
  ok('central measurement gives high confidence', r.confidence >= 0.5);
}

{
  // Brand scaling — asian runs smaller (factor 0.88), should map to a smaller size
  const m = makeMeasurements({ chestCircumference: 95, shoulderWidth: 44 });
  const r = getRecommendedSize(m);
  ok('asian brand size is present', r.brandSizes['asian'] !== undefined);
}

{
  // Out-of-range falls back to closest
  const m = makeMeasurements({ chestCircumference: 130, shoulderWidth: 60 });
  const r = getRecommendedSize(m);
  ok('out-of-range measurement returns XXL as closest', r.size === 'XXL');
}

{
  // Low confidence adds note
  const m = makeMeasurements({ confidence: 0.3, chestCircumference: 95 });
  const r = getRecommendedSize(m);
  ok('low body confidence generates a user note', r.notes.length > 0);
}

// ── Suite 3: Fit Analysis ─────────────────────────────────────────────────

console.log('\n── Suite 3: Fit Analysis ──');

{
  // Perfect chest fit
  const m   = makeMeasurements({ chestCircumference: 95, sleeveLength: 63 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('perfect chest fit for M', fit.chestFit === 'PERFECT');
  ok('perfect overall fit', fit.overallFit === 'PERFECT');
  ok('no issues when perfect', fit.issues.length === 0);
  ok('recommendedSize matches', fit.recommendedSize === 'M');
}

{
  // Too tight chest
  const m   = makeMeasurements({ chestCircumference: 80, sleeveLength: 63 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('too-tight chest flagged', fit.chestFit === 'TOO_TIGHT');
  ok('CHEST_TOO_TIGHT issue raised', fit.issues.includes('CHEST_TOO_TIGHT'));
}

{
  // Too loose chest (> 98 + 8)
  const m   = makeMeasurements({ chestCircumference: 115, sleeveLength: 63 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('too-loose chest flagged', fit.chestFit === 'TOO_LOOSE');
  ok('CHEST_TOO_LOOSE issue raised', fit.issues.includes('CHEST_TOO_LOOSE'));
}

{
  // Short sleeve
  const m   = makeMeasurements({ chestCircumference: 95, sleeveLength: 50 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('short sleeve flagged', fit.sleeveFit === 'TOO_TIGHT');
  ok('SLEEVE_TOO_SHORT issue raised', fit.issues.includes('SLEEVE_TOO_SHORT'));
}

{
  // Long sleeve
  const m   = makeMeasurements({ chestCircumference: 95, sleeveLength: 80 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('long sleeve flagged', fit.sleeveFit === 'TOO_LOOSE');
  ok('SLEEVE_TOO_LONG issue raised', fit.issues.includes('SLEEVE_TOO_LONG'));
}

{
  // Confidence propagated
  const m   = makeMeasurements({ chestCircumference: 95, sleeveLength: 63, confidence: 0.65 });
  const fit = analyzeFit(m, STANDARD_SIZE_CHART, 'M');
  ok('fit confidence matches measurement confidence', fit.confidence === 0.65);
}

// ── Suite 4: Outfit Composition ────────────────────────────────────────────

console.log('\n── Suite 4: Outfit Composition ──');

{
  const composer = new MockOutfitComposer();
  ok('starts empty', composer.getItemCount() === 0);
  ok('isComplete false when empty', !composer.isComplete());
  ok('buildOutfit returns null when incomplete', composer.buildOutfit() === null);

  const topItem = makeItem({ slot: 'top', garmentName: 'Red T-Shirt' });
  composer.addItem(topItem);
  ok('item added to slot', composer.hasItem('top'));
  ok('getItem returns correct item', composer.getItem('top')?.garmentName === 'Red T-Shirt');
  ok('isComplete true with top only', composer.isComplete());

  const outfit = composer.buildOutfit();
  ok('buildOutfit returns outfit when complete', outfit !== null);
  ok('outfit contains 1 item', outfit?.items.length === 1);
}

{
  const composer = new MockOutfitComposer();
  const top    = makeItem({ slot: 'top',    garmentType: 'T_SHIRT' });
  const bottom = makeItem({ slot: 'bottom', garmentType: 'BOTTOM', garmentId: 'g2', garmentName: 'Jeans' });
  composer.addItem(top);
  composer.addItem(bottom);
  ok('two slots filled', composer.getItemCount() === 2);
  ok('compatibility > 0', composer.computeCompatibility() > 0);
  ok('T_SHIRT|BOTTOM score is 85', composer.computeCompatibility() === 85);
}

{
  const composer = new MockOutfitComposer();
  const item = makeItem({ slot: 'top' });
  composer.addItem(item);
  composer.removeItem('top');
  ok('item removed from slot', !composer.hasItem('top'));
  ok('empty after remove', composer.getItemCount() === 0);
}

{
  const composer = new MockOutfitComposer();
  const item1 = makeItem({ slot: 'top', garmentName: 'First' });
  const item2 = makeItem({ slot: 'top', garmentName: 'Second' });
  composer.addItem(item1);
  composer.addItem(item2);
  ok('adding to same slot replaces existing item', composer.getItem('top')?.garmentName === 'Second');
  ok('still has 1 item', composer.getItemCount() === 1);
}

{
  const composer = new MockOutfitComposer();
  composer.addItem(makeItem({ slot: 'top' }));
  const outfit = composer.buildOutfit()!;
  composer.clearOutfit();
  composer.loadOutfit(outfit);
  ok('loadOutfit restores items', composer.hasItem('top'));
  ok('loadOutfit restores name', composer.getName() === outfit.name);
}

{
  const composer = new MockOutfitComposer();
  composer.setName('  Evening Look  ');
  ok('setName trims whitespace', composer.getName() === 'Evening Look');
  composer.setName('');
  ok('empty name falls back to default', composer.getName() === 'My Outfit');
}

{
  const composer = new MockOutfitComposer();
  ok('single item compatibility is 100', composer.computeCompatibility() === 100);
  composer.addItem(makeItem({ slot: 'top' }));
  ok('single item compatibility is still 100', composer.computeCompatibility() === 100);
}

// ── Suite 5: Outfit Scoring ────────────────────────────────────────────────

console.log('\n── Suite 5: Outfit Scoring ──');

{
  const score = scoreOutfit([]);
  ok('empty outfit scores 0 overall', score.overall === 0);
  ok('empty outfit all dimensions 0', score.colorHarmony === 0 && score.styleCompat === 0);
}

{
  const items = [makeItem({ garmentType: 'JACKET' })];
  const score = scoreOutfit(items, 'autumn');
  ok('jacket autumn score is high', score.seasonScore >= 90);
}

{
  const items = [makeItem({ garmentType: 'T_SHIRT' })];
  const score = scoreOutfit(items, 'winter');
  ok('t-shirt winter score is low', score.seasonScore <= 35);
}

{
  const items = [makeItem({ garmentType: 'JACKET' })];
  const score = scoreOutfit(items, 'casual' as any, 'formal');
  ok('jacket formal occasion score > 80', score.occasionScore >= 85);
}

{
  const items = [makeItem({ garmentType: 'HOODIE' })];
  const score = scoreOutfit(items, 'casual' as any, 'casual');
  ok('hoodie casual occasion score ≥ 90', score.occasionScore >= 90);
}

{
  // Weight sum (excluding 0 for overall) should equal 1.0
  const weights = Object.entries(SCORE_WEIGHTS)
    .filter(([k]) => k !== 'overall')
    .reduce((s, [, v]) => s + v, 0);
  ok('score weights sum to 1.0', approx(weights, 1.0, 0.001));
}

{
  const items = [
    makeItem({ slot: 'top',    garmentType: 'SHIRT' }),
    makeItem({ slot: 'bottom', garmentType: 'BOTTOM', garmentId: 'g2', garmentName: 'Trousers' }),
  ];
  const score = scoreOutfit(items);
  ok('multi-item outfit overall > 0', score.overall > 0);
  ok('SHIRT|BOTTOM style compat is 90', score.styleCompat === 90);
}

{
  // Single neutral color → colorHarmony 95
  const items = [makeItem()]; // default imageUrl has no color hex → defaults to grey
  const score = scoreOutfit(items);
  ok('monochrome palette scores 95 color harmony', score.colorHarmony === 95);
}

// ── Suite 6: Wishlist ──────────────────────────────────────────────────────

console.log('\n── Suite 6: Wishlist ──');

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);

  ok('wishlist starts empty', svc.getWishlist().length === 0);
  ok('wishlistCount starts at 0', svc.getWishlistCount() === 0);

  const outfit = makeOutfit();
  const entry  = svc.addToWishlist(outfit, 'love this');
  ok('addToWishlist returns entry', entry.notes === 'love this');
  ok('wishlist has 1 entry', svc.getWishlist().length === 1);
  ok('isInWishlist returns true', svc.isInWishlist(outfit.id));
  ok('wishlistCount is 1', svc.getWishlistCount() === 1);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit();
  const entry   = svc.addToWishlist(outfit);
  svc.removeFromWishlist(entry.id);
  ok('removeFromWishlist removes entry', svc.getWishlist().length === 0);
  ok('isInWishlist false after remove', !svc.isInWishlist(outfit.id));
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit();
  svc.addToWishlist(outfit);
  svc.addToWishlist(outfit, 'updated note');
  ok('re-adding same outfit updates entry', svc.getWishlist().length === 1);
  ok('note is updated', svc.getWishlist()[0].notes === 'updated note');
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  svc.addToWishlist(makeOutfit());
  svc.clearWishlist();
  ok('clearWishlist empties list', svc.getWishlist().length === 0);
}

// ── Suite 7: Saved Outfits ────────────────────────────────────────────────

console.log('\n── Suite 7: Saved Outfits ──');

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);

  ok('saved outfits starts empty', svc.loadSavedOutfits().length === 0);
  ok('savedCount starts at 0', svc.getSavedCount() === 0);

  const outfit = makeOutfit();
  svc.saveOutfit(outfit);
  ok('saveOutfit persists outfit', svc.loadSavedOutfits().length === 1);
  ok('savedCount is 1', svc.getSavedCount() === 1);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit();
  svc.saveOutfit(outfit);
  svc.deleteSavedOutfit(outfit.id);
  ok('deleteSavedOutfit removes outfit', svc.loadSavedOutfits().length === 0);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit();
  svc.saveOutfit(outfit);
  svc.saveOutfit({ ...outfit, name: 'Updated Name' });
  ok('re-saving same id updates rather than duplicates', svc.loadSavedOutfits().length === 1);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const o1 = makeOutfit([makeItem({ slot: 'top', garmentId: 'a1', garmentName: 'A' })]);
  const o2 = makeOutfit([makeItem({ slot: 'top', garmentId: 'b1', garmentName: 'B' })]);
  svc.saveOutfit(o1);
  svc.saveOutfit(o2);
  ok('multiple different outfits saved', svc.loadSavedOutfits().length === 2);
}

// ── Suite 8: Shopping Actions ─────────────────────────────────────────────

console.log('\n── Suite 8: Shopping Actions ──');

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const items   = [
    makeItem({ slot: 'top', garmentId: 'shirt1', garmentName: 'Silk Shirt', size: 'M', price: 2999 }),
    makeItem({ slot: 'bottom', garmentId: 'jean1', garmentName: 'Slim Jeans', size: 'L', price: 1999 }),
  ];
  const outfit = makeOutfit(items);
  svc.addAllToCart(outfit);

  const cart: Array<{ id: string; quantity: number; name: string }> = JSON.parse(
    storage.store.get('celebstyle-cart') ?? '[]',
  );
  ok('addAllToCart writes to celebstyle-cart', cart.length === 2);
  ok('cart item id uses garmentId-size pattern', cart.some((c) => c.id === 'shirt1-M'));
  ok('cart item has quantity 1', cart[0].quantity === 1);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const item    = makeItem({ garmentId: 'cap1', size: 'M' });
  const outfit  = makeOutfit([item]);
  svc.addAllToCart(outfit);
  svc.addAllToCart(outfit); // add same outfit again
  const cart: Array<{ id: string; quantity: number }> = JSON.parse(
    storage.store.get('celebstyle-cart') ?? '[]',
  );
  ok('duplicate add increments quantity', cart[0].quantity === 2);
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit([makeItem({ garmentId: 'x1', garmentName: 'Cap', size: 'S' })]);
  const url     = svc.generateShareableUrl(outfit);
  ok('generateShareableUrl starts with /try-on', url.startsWith('/try-on'));
  ok('generateShareableUrl contains outfit param', url.includes('outfit='));
}

{
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const outfit  = makeOutfit([makeItem({ garmentName: 'Velvet Blazer', size: 'L' })]);
  const text    = svc.generateShareText(outfit);
  ok('shareText contains outfit name', text.includes(outfit.name));
  ok('shareText contains garment name', text.includes('Velvet Blazer'));
}

{
  // Decode shareable URL
  const storage = mockStorage();
  const svc     = new MockWishlistService(storage);
  const item    = makeItem({ garmentId: 'decodeMe', size: 'XL' });
  const outfit  = makeOutfit([item]);
  const url     = svc.generateShareableUrl(outfit);
  const encoded = url.split('outfit=')[1];
  const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  ok('shareable URL decodes to correct outfit id', decoded.id === outfit.id);
  ok('shareable URL includes garment ids', decoded.items.includes('decodeMe'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${'─'.repeat(50)}`);
console.log(`ar.fit  ${passed}/${total} assertions passed`);
if (failed > 0) {
  console.error(`${failed} FAILED`);
  process.exit(1);
}
