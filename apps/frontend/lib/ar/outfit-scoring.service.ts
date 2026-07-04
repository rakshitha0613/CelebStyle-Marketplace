import type { OutfitItem, OutfitScore, Season, Occasion } from './fit.types.js';
import { SCORE_WEIGHTS } from './fit.types.js';

// ── Color harmony ──────────────────────────────────────────────────────────────

/** Extract hex from placehold.co URLs or return a default */
function extractHex(imageUrl: string): string | null {
  const m = imageUrl.match(/placehold\.co\/\d+x\d+\/([0-9a-fA-F]{3,6})\//);
  return m ? `#${m[1]}` : null;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const raw = hex.replace('#', '');
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
  // Neutral colors (low saturation) never clash
  const activePairs = hues.filter((_, i) => saturations[i] > 0.1);
  if (activePairs.length <= 1) return 95;

  let totalScore = 0; let pairs = 0;
  for (let i = 0; i < activePairs.length; i++) {
    for (let j = i + 1; j < activePairs.length; j++) {
      let diff = Math.abs(activePairs[i] - activePairs[j]);
      if (diff > 180) diff = 360 - diff;
      // Analogous < 30°: 80, Complementary 150-180°: 90, Triadic ~120°: 75, else 55
      const s = diff < 30 ? 80 : diff > 150 ? 90 : diff > 90 ? 75 : 55;
      totalScore += s; pairs++;
    }
  }
  return pairs === 0 ? 95 : Math.round(totalScore / pairs);
}

// ── Season scoring ─────────────────────────────────────────────────────────────

const SEASON_SCORES: Record<string, Record<Season, number>> = {
  T_SHIRT: { spring: 80, summer: 100, autumn: 60,  winter: 30  },
  SHIRT:   { spring: 85, summer: 75,  autumn: 85,  winter: 70  },
  JACKET:  { spring: 75, summer: 40,  autumn: 95,  winter: 95  },
  HOODIE:  { spring: 70, summer: 30,  autumn: 90,  winter: 90  },
  BOTTOM:  { spring: 75, summer: 80,  autumn: 80,  winter: 75  },
  SHOES:   { spring: 80, summer: 80,  autumn: 80,  winter: 80  },
  ACCESSORY:{ spring:80, summer: 80,  autumn: 80,  winter: 80  },
};

// ── Trending score ─────────────────────────────────────────────────────────────

const TRENDING_SCORES: Record<string, number> = {
  T_SHIRT:   80,
  SHIRT:     75,
  JACKET:    85,
  HOODIE:    90,
  BOTTOM:    78,
  SHOES:     88,
  ACCESSORY: 72,
};

// ── Occasion score ─────────────────────────────────────────────────────────────

const OCCASION_SCORES: Record<string, Record<Occasion, number>> = {
  T_SHIRT:   { casual: 90, formal: 25, sport: 85, party: 60, business: 30 },
  SHIRT:     { casual: 70, formal: 85, sport: 30, party: 75, business: 88 },
  JACKET:    { casual: 65, formal: 92, sport: 20, party: 80, business: 90 },
  HOODIE:    { casual: 95, formal: 15, sport: 90, party: 55, business: 20 },
  BOTTOM:    { casual: 80, formal: 70, sport: 70, party: 75, business: 72 },
  SHOES:     { casual: 80, formal: 80, sport: 80, party: 80, business: 80 },
  ACCESSORY: { casual: 80, formal: 80, sport: 70, party: 85, business: 78 },
};

// ── Celebrity similarity profiles ─────────────────────────────────────────────

const CELEBRITY_PROFILES: Record<string, string[]> = {
  streetwear:  ['HOODIE', 'T_SHIRT'],
  smart_casual:['JACKET', 'SHIRT'],
  sport_luxe:  ['T_SHIRT', 'SHOES'],
};

function celebritySimilarity(types: string[]): number {
  let best = 0;
  for (const profile of Object.values(CELEBRITY_PROFILES)) {
    const match = types.filter((t) => profile.includes(t)).length;
    const score = (match / Math.max(profile.length, types.length)) * 100;
    if (score > best) best = score;
  }
  return Math.round(best);
}

// ── Service ────────────────────────────────────────────────────────────────────

export class OutfitScoringService {
  /**
   * Scores a composed outfit across multiple dimensions.
   *
   * @param items     — the outfit items to score
   * @param season    — current season (defaults to auto-detected from month)
   * @param occasion  — target occasion (default 'casual')
   */
  scoreOutfit(
    items: OutfitItem[],
    season?: Season,
    occasion: Occasion = 'casual',
  ): OutfitScore {
    if (items.length === 0) {
      return { overall: 0, colorHarmony: 0, styleCompat: 0, seasonScore: 0, trendingScore: 0, occasionScore: 0, personalScore: 0, celebritySimilarity: 0 };
    }

    const resolvedSeason = season ?? this._currentSeason();
    const types = items.map((i) => String(i.garmentType));

    // ── Color harmony ────────────────────────────────────────────────────────
    const hsls = items.map((i) => {
      const hex = extractHex(i.imageUrl) ?? '#888888';
      return hexToHsl(hex.padEnd(7, '0'));
    });
    const colorHarmony = colorHarmonyScore(hsls.map((h) => h.h), hsls.map((h) => h.s));

    // ── Style compatibility ───────────────────────────────────────────────────
    const styleCompat = this._styleCompat(types);

    // ── Season ───────────────────────────────────────────────────────────────
    const seasonScore = Math.round(
      types.reduce((s, t) => s + (SEASON_SCORES[t]?.[resolvedSeason] ?? 75), 0) / types.length,
    );

    // ── Trending ─────────────────────────────────────────────────────────────
    const trendingScore = Math.round(
      types.reduce((s, t) => s + (TRENDING_SCORES[t] ?? 75), 0) / types.length,
    );

    // ── Occasion ─────────────────────────────────────────────────────────────
    const occasionScore = Math.round(
      types.reduce((s, t) => s + (OCCASION_SCORES[t]?.[occasion] ?? 70), 0) / types.length,
    );

    // ── Personal / celebrity ─────────────────────────────────────────────────
    const personalScore = 75; // placeholder — would come from user preference history
    const celebScore    = celebritySimilarity(types);

    // ── Weighted overall ─────────────────────────────────────────────────────
    const overall = Math.round(
      colorHarmony  * SCORE_WEIGHTS.colorHarmony +
      styleCompat   * SCORE_WEIGHTS.styleCompat +
      seasonScore   * SCORE_WEIGHTS.seasonScore +
      trendingScore * SCORE_WEIGHTS.trendingScore +
      occasionScore * SCORE_WEIGHTS.occasionScore +
      personalScore * SCORE_WEIGHTS.personalScore +
      celebScore    * SCORE_WEIGHTS.celebritySimilarity,
    );

    return {
      overall,
      colorHarmony,
      styleCompat,
      seasonScore,
      trendingScore,
      occasionScore,
      personalScore,
      celebritySimilarity: celebScore,
    };
  }

  private _styleCompat(types: string[]): number {
    if (types.length <= 1) return 100;
    const pairs = new Map<string, number>([
      ['JACKET|SHIRT',   92], ['JACKET|T_SHIRT', 78],
      ['JACKET|BOTTOM',  85], ['SHIRT|BOTTOM',   90],
      ['T_SHIRT|BOTTOM', 85], ['HOODIE|BOTTOM',  88],
      ['HOODIE|T_SHIRT', 70], ['SHIRT|T_SHIRT',  65],
    ]);
    let total = 0; let count = 0;
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const k1 = `${types[i]}|${types[j]}`;
        const k2 = `${types[j]}|${types[i]}`;
        total += pairs.get(k1) ?? pairs.get(k2) ?? 70;
        count++;
      }
    }
    return Math.round(count > 0 ? total / count : 100);
  }

  private _currentSeason(): Season {
    const month = new Date().getMonth(); // 0-11
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}
