/**
 * Prompt templates for every asset category. All prompts funnel through
 * NEGATIVE_TERMS to keep output away from cartoon/illustration/SVG-style
 * rendering, watermarks, text, logos, and other banned artifacts.
 *
 * Per the original brief this app never generates a real celebrity's
 * likeness — celebrity "portraits" are original, non-celebrity editorial
 * models only inspired by the associated look, matching how
 * scripts/legacy/generate-fashion-images.mjs was written.
 */

export const NEGATIVE_TERMS =
  "no cartoon, no illustration, no anime, no 3d render, no CGI look, no vector art, no SVG-style flat graphic, " +
  "no watermark, no text, no logo, no deformed hands, no extra limbs, no plastic skin, no airbrushed skin, " +
  "no gradient background, no solid color placeholder";

// Celebrity portrait/banner-specific negative list (superset of NEGATIVE_TERMS).
export const CELEBRITY_NEGATIVE_TERMS =
  "cartoon, CGI, illustration, anime, duplicate face, low quality, blurry, watermark, logo, text, " +
  "deformed hands, extra fingers, distorted anatomy, oversaturated colors, plastic skin";

const FEMALE_CATEGORY_HINTS = ["saree", "lehenga", "gown", "anarkali", "chaniya", "ghagra", "dress"];
const MALE_CATEGORY_HINTS = ["sherwani", "bandhgala", "dhoti", "veshti", "kurta", "tuxedo", "suit", "blazer", "jacket"];

/** Loose heuristic only — this catalogue's garment categories skew gendered by convention. */
export function inferModelDescriptor(category) {
  const c = (category || "").toLowerCase();
  if (FEMALE_CATEGORY_HINTS.some((h) => c.includes(h))) return "an Indian female fashion model";
  if (MALE_CATEGORY_HINTS.some((h) => c.includes(h))) return "an Indian male fashion model";
  return "an Indian fashion model";
}

// ── Celebrity (hero: portrait / bulk: banner) ──────────────────────────────────
// Built from a per-celebrity Fashion DNA persona (scripts/asset-manager/celebrity-style.mjs)
// computed ONLY from that celebrity's own linked outfits in catalogue.ts
// (colours, silhouettes, fabrics, accessories, formal/casual + Western/
// traditional ratios, price tier, editorial mood, styling consistency).
// Appearance description is deliberately generic and identical across every
// celebrity — nothing here is inferred from the celebrity's real name — so
// what differentiates each image is the clothing aesthetic, not a guess at
// what the real person looks like.

/** @param {ReturnType<import('./celebrity-style.mjs').buildCelebrityPersona>} persona */
export function celebrityPortraitPrompt(persona) {
  const {
    presentation, ageRange, skinTone, hairColor, hairstyle, hairLength, bodyType,
    facialHair, makeupIntensity, pose, cameraAngle, lightingStyle,
    fashionDNASentence, styleTradition,
  } = persona;
  const presentationClause = presentation ? `${presentation} ` : "";
  const facialHairClause = facialHair ? `, ${facialHair}` : "";
  const makeupClause = makeupIntensity ? `, ${makeupIntensity}` : "";
  return (
    `Ultra photorealistic Vogue editorial close-up portrait of an original, fictional ${presentationClause}fashion model, ` +
    `${ageRange}, ${skinTone}, ${hairColor}, ${hairLength} ${hairstyle}${facialHairClause}${makeupClause}, ${bodyType}, ` +
    `${pose}, ${cameraAngle}, ${lightingStyle}, ` +
    `${fashionDNASentence}, styled in the ${styleTradition}, this is an original model and outfit design, not a depiction of any real person, ` +
    `Louis Vuitton campaign quality, Dior campaign quality, premium studio photography, ` +
    `natural skin texture, realistic pores, shallow depth of field, 85mm lens, high dynamic range, sharp focus on the face, ` +
    `no watermark, no logo, no text, 8K. Negative: ${CELEBRITY_NEGATIVE_TERMS}`
  );
}

/** @param {ReturnType<import('./celebrity-style.mjs').buildCelebrityPersona>} persona */
export function celebrityBannerPrompt(persona) {
  const {
    presentation, ageRange, skinTone, hairColor, hairstyle, hairLength, bodyType,
    facialHair, makeupIntensity, pose, cameraAngle, lightingStyle,
    fashionDNASentence, styleTradition,
  } = persona;
  const presentationClause = presentation ? `${presentation} ` : "";
  const facialHairClause = facialHair ? `, ${facialHair}` : "";
  const makeupClause = makeupIntensity ? `, ${makeupIntensity}` : "";
  return (
    `Ultra photorealistic Vogue/Louis Vuitton/Dior campaign-quality wide banner photograph of an original, fictional ` +
    `${presentationClause}fashion model, ${ageRange}, ${skinTone}, ${hairColor}, ${hairLength} ${hairstyle}${facialHairClause}${makeupClause}, ` +
    `${bodyType}, full-body, ${pose}, ${cameraAngle}, ${lightingStyle}, ` +
    `${fashionDNASentence}, styled in the ${styleTradition}, this is an original model and outfit design, not a depiction of any real person, ` +
    `premium studio photography, natural skin texture, realistic pores, high dynamic range, 85mm lens, ` +
    `no watermark, no logo, no text, 16:9 wide composition, 8K. Negative: ${CELEBRITY_NEGATIVE_TERMS}`
  );
}

// ── Outfit (hero: hero.webp / bulk: detail1, detail2, fabric, thumb) ──────────

export function outfitHeroPrompt({ category, colorPalette, movieName }) {
  const model = inferModelDescriptor(category);
  return (
    `Ultra photorealistic luxury fashion editorial photograph of ${model} wearing a ${category} in ${colorPalette}, ` +
    `full body visible, standing naturally, elegant pose, minimal luxury studio backdrop, soft studio lighting, ` +
    `shot on Sony A7R V, 85mm lens, sharp focus, natural skin texture, high dynamic range, 8K, ` +
    `luxury commercial fashion photography inspired by ${movieName}. Negative: ${NEGATIVE_TERMS}`
  );
}

export function outfitDetail1Prompt({ category, colorPalette }) {
  return (
    `Close-up fashion detail photograph of a ${category} in ${colorPalette}, focus on embroidery and craftsmanship, ` +
    `white studio background, 8K professional photography, sharp focus. Negative: ${NEGATIVE_TERMS}`
  );
}

export function outfitDetail2Prompt({ category, colorPalette }) {
  const model = inferModelDescriptor(category);
  return (
    `Photorealistic back-view fashion photograph of ${model} wearing a ${category} in ${colorPalette}, ` +
    `luxury studio editorial lighting, 8K, sharp focus. Negative: ${NEGATIVE_TERMS}`
  );
}

export function outfitFabricPrompt({ category, colorPalette }) {
  return (
    `Macro photography of ${colorPalette} textile fabric used for a ${category}, visible weave and texture, ` +
    `even lighting, ultra detailed, 8K sharp focus. Negative: ${NEGATIVE_TERMS}`
  );
}

export function outfitThumbPrompt({ category, colorPalette }) {
  const model = inferModelDescriptor(category);
  return (
    `Photorealistic three-quarter portrait of ${model} wearing a ${category} in ${colorPalette}, ` +
    `white studio background, luxury fashion photography, 8K sharp focus. Negative: ${NEGATIVE_TERMS}`
  );
}

// ── Garment cutout (ghost-mannequin product shot, chroma-keyed after download) ─

export function outfitGarmentPrompt({ category, colorPalette }, chromaColorName) {
  return (
    `Ghost mannequin product photography of a ${category} in ${colorPalette}, garment only, no person, no head, ` +
    `no hands, isolated on a flat solid ${chromaColorName} background, even studio lighting, no shadow, ` +
    `no gradient, product catalogue style, sharp focus, 8K. Negative: ${NEGATIVE_TERMS}, no mannequin body visible`
  );
}

const GENERIC_GARMENT_LABELS = {
  T_SHIRT: "t-shirt",
  SHIRT: "formal shirt",
  JACKET: "jacket",
  HOODIE: "hoodie",
  DRESS: "evening dress",
  KURTA: "kurta",
  SAREE: "saree",
  LEHENGA: "lehenga",
  SHERWANI: "sherwani",
  BLAZER: "blazer",
  SUIT: "suit",
  INDO_WESTERN: "indo-western outfit",
};

export function genericGarmentPrompt(garmentType, chromaColorName) {
  const label = GENERIC_GARMENT_LABELS[garmentType] ?? "garment";
  return (
    `Ghost mannequin product photography of a generic ${label}, garment only, no person, isolated on a flat solid ` +
    `${chromaColorName} background, even studio lighting, no shadow, product catalogue style, sharp focus, 8K. ` +
    `Negative: ${NEGATIVE_TERMS}, no mannequin body visible`
  );
}

// ── Collection covers (hero tier) ──────────────────────────────────────────────

export function collectionCoverPrompt({ name, dominantColors, dominantCategory }) {
  return (
    `Ultra photorealistic luxury fashion editorial group still-life photograph representing a "${name}" collection, ` +
    `featuring ${dominantCategory} pieces in ${dominantColors}, minimal luxury studio backdrop, soft studio lighting, ` +
    `85mm lens, 8K, Vogue campaign quality. Negative: ${NEGATIVE_TERMS}`
  );
}

// ── Small folders (bulk tier) ──────────────────────────────────────────────────

export const BANNER_PROMPTS = {
  "home-hero": "Ultra photorealistic luxury fashion editorial wide banner photograph, Indian model in an ornate festive outfit, dramatic cinematic studio lighting, 21:9 wide composition, 8K",
  "festive-banner": "Ultra photorealistic luxury festive fashion editorial banner, Indian models in gold and saffron festive attire, warm cinematic lighting, wide composition, 8K",
  "luxury-banner": "Ultra photorealistic high-luxury fashion editorial banner, model in a couture gown, dramatic studio lighting, wide composition, 8K, Vogue campaign quality",
  "wedding-banner": "Ultra photorealistic bridal fashion editorial banner, Indian bridal couture in red and gold, soft romantic lighting, wide composition, 8K",
  "red-carpet-banner": "Ultra photorealistic red carpet fashion editorial banner, glamorous evening wear, flashbulb-lit dramatic atmosphere, wide composition, 8K",
};

export function bannerPrompt(slug) {
  const base = BANNER_PROMPTS[slug] ?? BANNER_PROMPTS["home-hero"];
  return `${base}. Negative: ${NEGATIVE_TERMS}`;
}

export function stylistHeroPrompt() {
  return (
    `Ultra photorealistic editorial photograph of an elegant personal fashion stylist reviewing luxury garments ` +
    `in a bright minimal studio, soft natural light, 8K, professional editorial photography. Negative: ${NEGATIVE_TERMS}`
  );
}

export function wardrobeEmptyStatePrompt(kind) {
  const scenes = {
    "empty-recently-viewed": "an elegant minimal walk-in wardrobe with soft light, no clothes visible, luxury interior photography",
    "empty-wishlist": "a single velvet hanger on a minimal luxury rail, soft studio light, editorial still life",
    "empty-tryon": "a minimal photo studio backdrop with soft ring light, ready for a portrait, no subject present",
  };
  const scene = scenes[kind] ?? scenes["empty-recently-viewed"];
  return `Ultra photorealistic editorial photograph of ${scene}, 8K, luxury commercial photography. Negative: ${NEGATIVE_TERMS}`;
}

export function tryonHeroPrompt() {
  return (
    `Ultra photorealistic editorial photograph of a minimal luxury photo studio set up for a virtual fitting, ` +
    `soft ring light, neutral backdrop, no subject present, 8K. Negative: ${NEGATIVE_TERMS}`
  );
}
