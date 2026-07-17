/**
 * Chroma-key extraction for garment.webp cutouts.
 *
 * Neither Pollinations nor Replicate outputs alpha-transparent PNGs/WebPs
 * directly. Approach: prompt for a "ghost mannequin, isolated on a flat
 * [color] background" product shot, then key that flat color out here via
 * raw-pixel distance thresholding with a feathered edge (avoids hard/jagged
 * cutout edges). This is the highest-risk step in the whole pipeline —
 * folds/fabric sheen/shadows near the garment edge rarely give a perfectly
 * flat background, so a sanity check flags implausible results for review
 * rather than silently shipping a broken cutout.
 */

export const CHROMA_COLORS = {
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
};

const FEATHER_BAND = 18; // color-distance units over which alpha ramps 0→255
const KEY_THRESHOLD = 40; // color-distance below which a pixel is fully transparent

/**
 * Picks a chroma key color that isn't present in the outfit's own palette
 * string, so we don't key out the garment itself.
 * @param {string} colorPaletteText e.g. "emerald gold ivory"
 */
export function pickChromaColor(colorPaletteText) {
  const text = (colorPaletteText || "").toLowerCase();
  const HUE_HINTS = {
    green: ["green", "emerald", "jade", "olive", "forest", "sage", "teal", "turquoise"],
    blue: ["blue", "navy", "cobalt", "royal", "indigo", "midnight", "powder", "peacock"],
    magenta: ["pink", "fuchsia", "magenta", "rose", "blush", "purple", "orchid", "lavender"],
  };
  const order = ["green", "blue", "magenta"];
  for (const color of order) {
    const hints = HUE_HINTS[color];
    if (!hints.some((h) => text.includes(h))) return color;
  }
  // Every hue family is present in the palette (rare) — fall back to green.
  return "green";
}

function colorDistance(r, g, b, key) {
  const dr = r - key.r;
  const dg = g - key.g;
  const db = b - key.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * @param {Buffer} inputBuffer decoded source image (flat-background garment shot)
 * @param {"green"|"blue"|"magenta"} chromaColor
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, alphaCoverage: number, failed: boolean }>}
 */
export async function extractTransparency(inputBuffer, chromaColor) {
  const sharp = (await import("sharp")).default;
  const key = CHROMA_COLORS[chromaColor] ?? CHROMA_COLORS.green;

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels === 4 (RGBA)
  const out = Buffer.from(data); // copy, we'll rewrite alpha in place
  let opaquePixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const dist = colorDistance(r, g, b, key);

    let alpha;
    if (dist <= KEY_THRESHOLD) {
      alpha = 0;
    } else if (dist >= KEY_THRESHOLD + FEATHER_BAND) {
      alpha = 255;
      opaquePixels++;
    } else {
      alpha = Math.round(((dist - KEY_THRESHOLD) / FEATHER_BAND) * 255);
      if (alpha > 200) opaquePixels++;
    }
    out[o + 3] = alpha;
  }

  const alphaCoverage = opaquePixels / totalPixels;
  const failed = alphaCoverage < 0.3 || alphaCoverage > 0.95;

  const buffer = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  return { buffer, width, height, alphaCoverage, failed };
}
