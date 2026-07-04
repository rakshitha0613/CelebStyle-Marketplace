/**
 * diversity.service — enforces recommendation diversity.
 *
 * After initial ranking, iterates the sorted candidate list and applies
 * a score dampening multiplier each time the same celebrity, brand, or
 * category repeats. Greedy — processes in sorted order so the best product
 * from each entity always keeps full score.
 *
 * Multiplier tables (nth appearance from the same entity):
 *   Celebrity: [1.0, 0.80, 0.60, 0.40]
 *   Brand:     [1.0, 0.85, 0.70, 0.50]
 *   Category:  [1.0, 0.90, 0.75, 0.60]
 *
 * Pure function — no DB access, no cache.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface DiversityWeights {
  celebrity: number[];
  brand:     number[];
  category:  number[];
}

export const DEFAULT_DIVERSITY_WEIGHTS: DiversityWeights = {
  celebrity: [1.00, 0.80, 0.60, 0.40],
  brand:     [1.00, 0.85, 0.70, 0.50],
  category:  [1.00, 0.90, 0.75, 0.60],
};

// ── Input / Output ────────────────────────────────────────────────────────────

export interface DiversityInput {
  productId:   string;
  score:       number;   // score before diversity penalty
  celebrityId: string;
  brandId:     string | null;
  category:    string;
}

export interface DiversityResult {
  productId:        string;
  penalty:          number;   // amount deducted (≥ 0)
  diversifiedScore: number;   // score - penalty (≥ 0)
}

// ── Core function ─────────────────────────────────────────────────────────────

export function applyDiversity(
  sorted:  DiversityInput[],
  weights: Partial<DiversityWeights> = {}
): DiversityResult[] {
  const cfg: DiversityWeights = {
    celebrity: weights.celebrity ?? DEFAULT_DIVERSITY_WEIGHTS.celebrity,
    brand:     weights.brand     ?? DEFAULT_DIVERSITY_WEIGHTS.brand,
    category:  weights.category  ?? DEFAULT_DIVERSITY_WEIGHTS.category,
  };

  // Track how many times each entity has appeared so far in output
  const celebCount  = new Map<string, number>();
  const brandCount  = new Map<string, number>();
  const catCount    = new Map<string, number>();

  return sorted.map((item) => {
    const nCeleb = celebCount.get(item.celebrityId) ?? 0;
    const nBrand = item.brandId ? (brandCount.get(item.brandId) ?? 0) : 0;
    const nCat   = catCount.get(item.category) ?? 0;

    // Clamp to last index of multiplier table
    const celebMult = cfg.celebrity[Math.min(nCeleb, cfg.celebrity.length - 1)];
    const brandMult = item.brandId
      ? cfg.brand[Math.min(nBrand, cfg.brand.length - 1)]
      : 1.0;
    const catMult   = cfg.category[Math.min(nCat, cfg.category.length - 1)];

    const combined  = celebMult * brandMult * catMult;
    const penalty   = item.score * (1 - combined);
    const diversifiedScore = Math.max(0, item.score - penalty);

    // Update counts for subsequent items (greedy)
    celebCount.set(item.celebrityId, nCeleb + 1);
    if (item.brandId) brandCount.set(item.brandId, nBrand + 1);
    catCount.set(item.category, nCat + 1);

    return { productId: item.productId, penalty, diversifiedScore };
  });
}

export const diversityService = { applyDiversity, DEFAULT_DIVERSITY_WEIGHTS };
