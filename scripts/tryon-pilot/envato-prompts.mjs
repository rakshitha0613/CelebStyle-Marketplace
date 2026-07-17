/**
 * Envato ImageGen prompts for the 10 TRYON_PILOT_OUTFITS garment images.
 * Each prompt describes the GARMENT ONLY — derived from that outfit's real
 * category / colorPalette / description in the product database — and is
 * built to the same "garment-only product photography" contract as
 * scripts/asset-manager/prompts.mjs's outfitGarmentPrompt(), but targets a
 * plain studio background (not a chroma-key color) since these are manual
 * Envato generations meant primarily as IDM-VTON garment input, not an
 * AR chroma-keyed cutout.
 */
export const NO_PERSON_NEGATIVE =
  "no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, " +
  "no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, " +
  "no illustration, no vector art, no SVG-style flat graphic, no gradient background";

export const ENVATO_PROMPTS = {
  "look-shah-rukh-khan-red-carpet":
    "Ultra-realistic luxury black Indian bandhgala jacket with charcoal and silver detailing, " +
    "garment-only product photography, front-facing, full jacket visible, perfectly centered, " +
    "symmetrical presentation, premium black wool-blend fabric, structured mandarin collar, " +
    "sharp lapels, subtle silver zari thread detailing down the placket, isolated on a clean plain " +
    "light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce " +
    "catalogue image, suitable as garment input for AI Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-shah-rukh-khan-jawan":
    "Ultra-realistic rugged military-inspired kurta in olive green cotton with khaki and black accents, " +
    "garment-only product photography, front-facing, full kurta visible, perfectly centered, " +
    "symmetrical presentation, heavy cotton twill fabric, mandarin collar, visible utility chest " +
    "pockets, reinforced stitching, isolated on a clean plain light gray studio background, even " +
    "soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment " +
    "input for AI Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-ranveer-singh-gully-boy":
    "Ultra-realistic oversized urban streetwear hoodie in black, white and neon yellow colour-block " +
    "panels, garment-only product photography, front-facing, full hoodie visible, perfectly centered, " +
    "symmetrical presentation, heavyweight cotton fleece fabric, drawstring hood, ribbed cuffs, bold " +
    "graphic block panels, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-hrithik-roshan-war":
    "Ultra-realistic sleek navy double-breasted blazer with gold button detailing and white shirt " +
    "underlay, garment-only product photography, front-facing, full blazer visible, perfectly " +
    "centered, symmetrical presentation, premium navy wool-blend fabric, peak lapels, sharp tailored " +
    "silhouette, gold-tone buttons, isolated on a clean plain light gray studio background, even soft " +
    "studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input " +
    "for AI Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-akshay-kumar-kesari":
    "Ultra-realistic saffron warrior sherwani with gold and dark blue embroidered detailing, " +
    "garment-only product photography, front-facing, full sherwani visible, perfectly centered, " +
    "symmetrical presentation, rich saffron jacquard fabric, gold-thread zari embroidery along the " +
    "placket and collar, structured knee-length silhouette, ornate buttons, isolated on a clean plain " +
    "light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce " +
    "catalogue image, suitable as garment input for AI Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-salman-khan-bajrangi":
    "Ultra-realistic simple white cotton kurta with sky blue and beige subtle detailing, garment-only " +
    "product photography, front-facing, full kurta visible, perfectly centered, symmetrical " +
    "presentation, light breathable cotton fabric with natural drape, round neckline, minimal " +
    "stitching detail, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-ranbir-kapoor-animal":
    "Ultra-realistic distressed black leather jacket with dark brown and cream detailing, garment-only " +
    "product photography, front-facing, full jacket visible, perfectly centered, symmetrical " +
    "presentation, weathered genuine-look black leather, asymmetric zip closure, cream ribbed collar " +
    "trim, heavy hardware, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-vicky-kaushal-uri":
    "Ultra-realistic olive tactical military jacket with khaki and camouflage brown detailing, " +
    "garment-only product photography, front-facing, full jacket visible, perfectly centered, " +
    "symmetrical presentation, heavy-duty ripstop cotton fabric, multiple utility pockets, epaulettes, " +
    "reinforced cuffs, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-amitabh-bachchan-pink":
    "Ultra-realistic authoritative charcoal grey worsted wool suit with white and silver detailing, " +
    "garment-only product photography, front-facing, full suit jacket visible, perfectly centered, " +
    "symmetrical presentation, premium worsted wool fabric, notch lapels, crisp tailored silhouette, " +
    "silver-tone buttons, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,

  "look-deepika-padukone-wedding":
    "Ultra-realistic Banarasi silk saree in deep crimson with gold zari border and ivory blouse, " +
    "garment-only product photography, saree laid flat and fully unfurled showing the gold zari " +
    "border and pallu detail, perfectly centered, symmetrical presentation, rich silk fabric with " +
    "visible woven texture, isolated on a clean plain light gray studio background, even soft studio " +
    "lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI " +
    "Virtual Try-On. Negative: " + NO_PERSON_NEGATIVE,
};
