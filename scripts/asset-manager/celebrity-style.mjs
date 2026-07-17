/**
 * Fashion DNA — a per-celebrity style profile computed ONLY from the outfit
 * catalogue (colorPalette, category, occasion, price, description across
 * every outfit linked to that celebrityId in catalogue.ts). Nothing here
 * reads the celebrity's real name to infer any attribute — not gender, not
 * appearance, not identity. The only outfit-derived signal that touches
 * "presentation" (menswear/womenswear-coded silhouettes) comes from the
 * garment categories actually in the catalogue, which is clothing data, not
 * a guess about the real person.
 *
 * The resulting persona keeps skin tone and hair colour generic and IDENTICAL
 * across every celebrity — the Fashion DNA (clothing aesthetic) is what
 * distinguishes one celebrity's image from another's, never a guess at real
 * appearance. On top of that, a deterministic PRNG seeded from the
 * celebrity's id (a slug, not their name) picks a fixed set of staging/build
 * attributes — age bucket, body build, hairstyle, hair length, beard style
 * (menswear-presenting only), makeup intensity (womenswear-presenting only),
 * pose, camera angle, lighting style — purely to keep the same celebrity's
 * portrait/banner visually consistent and non-random across regenerations,
 * and to give different celebrities distinct-looking original models instead
 * of visual monotony. No Math.random() is used anywhere in this file.
 */

const FABRIC_KEYWORDS = [
  "silk", "velvet", "brocade", "chiffon", "organza", "linen", "cotton", "satin",
  "wool", "cashmere", "tweed", "leather", "denim", "georgette", "net", "tulle",
  "lace", "crepe", "zari", "zardozi", "sequin", "crystal", "embroidered",
  "beaded", "mirror-work", "pashmina",
];

const ACCESSORY_KEYWORDS = [
  "clutch", "cufflinks", "pocket square", "jewellery", "jewelry", "choker",
  "cape", "brooch", "bowtie", "bow tie", "sunglasses", "watch", "belt",
  "earrings", "necklace", "bangles", "potli", "stole", "dupatta", "turban",
  "pagdi", "mojari", "juttis", "heels", "stilettos", "kolhapuris",
];

const TAILORING_HINTS = [
  { test: /suit|blazer|tuxedo|bandhgala|jacket/i, label: "structured tailoring" },
  { test: /saree|lehenga|dhoti|veshti|mundu/i, label: "flowing traditional drapery" },
  { test: /gown|dress|anarkali/i, label: "sweeping editorial silhouettes" },
  { test: /kurta|sherwani/i, label: "relaxed, regal silhouettes" },
];

const WESTERN_CATEGORY_RE = /suit|blazer|tuxedo|gown|dress|jacket|hoodie|t-shirt|streetwear/i;
const TRADITIONAL_CATEGORY_RE = /saree|lehenga|sherwani|kurta|dhoti|veshti|anarkali|bandhgala|chaniya|ghagra|mundu/i;
const WOMENSWEAR_CATEGORY_RE = /saree|lehenga|gown|anarkali|chaniya|ghagra|dress/i;
const MENSWEAR_CATEGORY_RE = /sherwani|bandhgala|dhoti|veshti|kurta|tuxedo|suit|blazer|jacket/i;

const MOOD_BY_OCCASION = {
  Party: "dramatic, glamorous",
  Award: "dramatic, glamorous",
  Premiere: "dramatic, glamorous",
  Wedding: "opulent, traditional",
  Festival: "opulent, traditional",
  Casual: "effortless, relaxed",
  Corporate: "polished, refined",
  Endorsement: "polished, refined",
  Film: "cinematic, character-driven",
  Sports: "dynamic, athletic",
};

const STYLE_TRADITION_BY_INDUSTRY = {
  Bollywood: "Indian couture tradition",
  Tollywood: "South Indian couture tradition",
  Kollywood: "South Indian couture tradition",
  Mollywood: "South Indian couture tradition",
  Sandalwood: "South Indian couture tradition",
  Bhojpuri: "North Indian traditional-wear tradition",
  Ollywood: "Eastern Indian traditional-wear tradition",
  Hollywood: "Western high-fashion tradition",
};

const AGE_BUCKETS = ["late 20s to early 30s", "early 30s to 40s", "mid-30s to late 40s"];
function hashString(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function extractKeywords(text, vocab) {
  const lower = (text || "").toLowerCase();
  return [...new Set(vocab.filter((w) => lower.includes(w)))];
}

function percentLabel(pct, positiveWord, negativeWord) {
  if (pct >= 70) return `predominantly ${positiveWord}`;
  if (pct <= 30) return `predominantly ${negativeWord}`;
  return `a balanced mix of ${positiveWord} and ${negativeWord}`;
}

// ── Fashion DNA (pure function of outfit data — no name, no identity guess) ────

/**
 * @param {{ id: string, industry: string, styleTags?: string[] }} celeb
 * @param {Array<{ celebrityId: string, occasion: string, category: string, colorPalette: string, price: number, description: string }>} allOutfits
 */
export function computeFashionDNA(celeb, allOutfits) {
  const outfits = allOutfits.filter((o) => o.celebrityId === celeb.id);
  const n = outfits.length;

  // Dominant colours
  const colorCounts = new Map();
  for (const o of outfits) {
    for (const raw of (o.colorPalette || "").split(",")) {
      const c = raw.trim().toLowerCase();
      if (c) colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
    }
  }
  const dominantColours = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);

  // Recurring silhouettes (unique categories) + preferred tailoring label
  const categoryCounts = new Map();
  for (const o of outfits) {
    const cat = o.category || "";
    if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const recurringSilhouettes = [...categoryCounts.keys()];
  const categoryText = recurringSilhouettes.join(" ");
  const tailoring = TAILORING_HINTS.find((h) => h.test.test(categoryText));
  const preferredTailoring = tailoring ? tailoring.label : "versatile, editorial silhouettes";

  // Fabrics / accessories from description text
  const descriptionText = outfits.map((o) => o.description || "").join(" ");
  const recurringFabrics = extractKeywords(descriptionText, FABRIC_KEYWORDS);
  const recurringAccessories = extractKeywords(descriptionText, ACCESSORY_KEYWORDS);

  // Formal vs casual ratio
  const casualCount = outfits.filter((o) => o.occasion === "Casual").length;
  const formalPct = n > 0 ? Math.round(((n - casualCount) / n) * 100) : 50;
  const formalCasualRatio = { formalPct, casualPct: 100 - formalPct, label: percentLabel(formalPct, "formal", "casual") };

  // Western vs traditional silhouette ratio
  let westernCount = 0, traditionalCount = 0;
  for (const o of outfits) {
    if (WESTERN_CATEGORY_RE.test(o.category || "")) westernCount++;
    else if (TRADITIONAL_CATEGORY_RE.test(o.category || "")) traditionalCount++;
  }
  const classified = westernCount + traditionalCount;
  const westernPct = classified > 0 ? Math.round((westernCount / classified) * 100) : 50;
  const westernTraditionalRatio = {
    westernPct,
    traditionalPct: 100 - westernPct,
    label: classified > 0 ? percentLabel(westernPct, "Western tailored silhouettes", "traditional drapery-based silhouettes") : "a blend of Western and traditional silhouettes",
  };

  // Luxury level from average price
  const avgPrice = n > 0 ? outfits.reduce((s, o) => s + (o.price || 0), 0) / n : 0;
  const luxuryTier = avgPrice >= 50000 ? "ultra-luxury haute couture" : avgPrice >= 28000 ? "premium luxury" : "contemporary luxury ready-to-wear";
  const luxuryLevel = { tier: luxuryTier, avgPrice: Math.round(avgPrice) };

  // Editorial mood — most frequent occasion-derived mood
  const moodCounts = new Map();
  for (const o of outfits) {
    const mood = MOOD_BY_OCCASION[o.occasion];
    if (mood) moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
  }
  const topMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const editorialMood = topMood ? topMood[0] : "versatile, editorial";

  // Styling consistency — how concentrated their looks are in one silhouette
  const topCategoryCount = [...categoryCounts.values()].sort((a, b) => b - a)[0] ?? 0;
  const consistencyScore = n > 0 ? topCategoryCount / n : null;
  const stylingConsistency = {
    score: consistencyScore,
    label:
      consistencyScore === null ? "insufficient data" :
      consistencyScore >= 0.7 ? "highly consistent styling" :
      consistencyScore >= 0.4 ? "moderately consistent styling" :
      "eclectic, varied styling",
  };

  // Presentation — derived ONLY from garment categories actually catalogued
  // for this celebrity, never from their name.
  let womenswearCount = 0, menswearCount = 0;
  for (const o of outfits) {
    if (WOMENSWEAR_CATEGORY_RE.test(o.category || "")) womenswearCount++;
    else if (MENSWEAR_CATEGORY_RE.test(o.category || "")) menswearCount++;
  }
  const presentation =
    womenswearCount > menswearCount ? "womenswear-presenting" :
    menswearCount > womenswearCount ? "menswear-presenting" :
    null;

  return {
    sourceOutfitCount: n,
    dominantColours,
    recurringSilhouettes,
    preferredTailoring,
    recurringFabrics,
    recurringAccessories,
    formalCasualRatio,
    westernTraditionalRatio,
    luxuryLevel,
    editorialMood,
    stylingConsistency,
    presentation,
    computedAt: new Date().toISOString(),
  };
}

// ── Deterministic variation ─────────────────────────────────────────────────────
// Every appearance/staging attribute below is picked by a seeded PRNG keyed
// ONLY on celeb.id (a slug, not the real name) + a fixed draw order. Same
// celebrity id + same catalogue data => same seed => same sequence => the
// exact same fictional model every time this is computed, with no
// Math.random() anywhere. The only way to get a different result is to
// change the underlying data (regeneration is a deliberate --force action in
// the CLI, not something that happens by chance on a re-run).

// mulberry32 — small, fast, deterministic PRNG from a 32-bit integer seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, options) {
  return options[Math.floor(rng() * options.length)];
}

const BODY_BUILD_OPTIONS = {
  "menswear-presenting": ["a lean, athletic build", "a tall, broad-shouldered build", "a solidly built, muscular frame", "a lithe, wiry build"],
  "womenswear-presenting": ["a toned, statuesque build", "a slender, elegant build", "an athletic, fit build", "a curvier, hourglass build"],
  neutral: ["a fit, camera-ready build"],
};

const HAIRSTYLE_OPTIONS = {
  "menswear-presenting": [
    "a neat, classic short hairstyle",
    "textured, tousled crop",
    "a sleek side-parted style",
    "a slightly longer, brushed-back style",
  ],
  "womenswear-presenting": [
    "a sleek, polished updo",
    "soft, loose waves",
    "a straight, glossy blowout",
    "a textured, voluminous style",
  ],
  neutral: ["a well-groomed, camera-ready hairstyle"],
};

const HAIR_LENGTH_OPTIONS = {
  "menswear-presenting": ["short", "cropped", "medium-length", "slightly longer, textured"],
  "womenswear-presenting": ["a short bob", "shoulder-length", "long", "extra-long, flowing"],
  neutral: ["medium-length"],
};

const BEARD_STYLE_OPTIONS = ["clean-shaven", "light stubble", "a neatly trimmed beard", "a full, well-groomed beard"];

const MAKEUP_INTENSITY_OPTIONS = [
  "natural, minimal makeup",
  "soft, subtly defined makeup",
  "bold, glamorous makeup",
  "dramatic, high-fashion makeup",
];

const POSE_OPTIONS = [
  "standing in a confident three-quarter turn",
  "a relaxed standing pose, one hand in pocket",
  "a dynamic walking stride",
  "seated elegantly on a minimalist studio stool",
  "an editorial power pose with arms crossed",
  "a soft over-the-shoulder glance",
];

const CAMERA_ANGLE_OPTIONS = [
  "shot at eye level",
  "shot from a slightly low, empowering angle",
  "shot from a slightly elevated three-quarter angle",
  "shot in straight-on, symmetrical framing",
];

const LIGHTING_STYLE_OPTIONS = [
  "soft, even studio lighting",
  "dramatic rim lighting with deep shadows",
  "high-key bright studio lighting",
  "moody, low-key cinematic lighting",
];

/**
 * Draws the full deterministic variation set for one celebrity. Every field
 * is independent (each consumes its own PRNG draw) so two attributes never
 * collide just because they happen to share a modulus.
 */
function drawVariation(celebId, presentation) {
  const rng = mulberry32(hashString(celebId));
  const bucket = presentation ?? "neutral";

  const ageRange = pick(rng, AGE_BUCKETS);
  const bodyBuild = pick(rng, BODY_BUILD_OPTIONS[bucket] ?? BODY_BUILD_OPTIONS.neutral);
  const hairstyle = pick(rng, HAIRSTYLE_OPTIONS[bucket] ?? HAIRSTYLE_OPTIONS.neutral);
  const hairLength = pick(rng, HAIR_LENGTH_OPTIONS[bucket] ?? HAIR_LENGTH_OPTIONS.neutral);
  const beardStyle = presentation === "menswear-presenting" ? pick(rng, BEARD_STYLE_OPTIONS) : null;
  const makeupIntensity = presentation === "womenswear-presenting" ? pick(rng, MAKEUP_INTENSITY_OPTIONS) : null;
  const pose = pick(rng, POSE_OPTIONS);
  const cameraAngle = pick(rng, CAMERA_ANGLE_OPTIONS);
  const lightingStyle = pick(rng, LIGHTING_STYLE_OPTIONS);

  return { ageRange, bodyBuild, hairstyle, hairLength, beardStyle, makeupIntensity, pose, cameraAngle, lightingStyle };
}

function fashionDNASentence(dna, occasionPhrase) {
  const colours = dna.dominantColours.length > 0 ? dna.dominantColours.slice(0, 3).join(", ") : "rich jewel-toned and neutral";
  const fabrics = dna.recurringFabrics.length > 0 ? dna.recurringFabrics.slice(0, 3).join(", ") : "premium fabrics";
  const accessories = dna.recurringAccessories.length > 0 ? dna.recurringAccessories.slice(0, 3).join(", ") : "fine statement jewellery";
  return (
    `wearing ${dna.preferredTailoring} in a palette of ${colours}, crafted from ${fabrics}, finished with ${accessories}, ` +
    `${dna.formalCasualRatio.label} styling, ${dna.westernTraditionalRatio.label}, ${dna.luxuryLevel.tier} price positioning, ` +
    `${dna.editorialMood} editorial mood, ${dna.stylingConsistency.label}, suited for ${occasionPhrase} occasions`
  );
}

/**
 * @param {{ id: string, name: string, industry: string, bio: string, styleTags: string[] }} celeb
 * @param {Array<object>} allOutfits
 */
export function buildCelebrityPersona(celeb, allOutfits) {
  const dna = computeFashionDNA(celeb, allOutfits);
  const outfits = allOutfits.filter((o) => o.celebrityId === celeb.id);
  const occasions = [...new Set(outfits.map((o) => o.occasion).filter(Boolean))];
  const occasionPhrase = occasions.length > 0 ? occasions.join(", ").toLowerCase() : "red carpet and editorial";
  const variation = drawVariation(celeb.id, dna.presentation);

  return {
    presentation: dna.presentation, // may be null — prompt omits gendered wording in that case
    ageRange: variation.ageRange,
    skinTone: "a naturally photogenic skin tone",
    hairColor: "a hair color that complements the styling",
    hairstyle: variation.hairstyle,
    hairLength: variation.hairLength,
    bodyType: variation.bodyBuild,
    facialHair: variation.beardStyle,
    makeupIntensity: variation.makeupIntensity,
    pose: variation.pose,
    cameraAngle: variation.cameraAngle,
    lightingStyle: variation.lightingStyle,
    fashionDNASentence: fashionDNASentence(dna, occasionPhrase),
    styleTradition: STYLE_TRADITION_BY_INDUSTRY[celeb.industry] ?? "global entertainment fashion tradition",
    industry: celeb.industry,
    dna,
  };
}
