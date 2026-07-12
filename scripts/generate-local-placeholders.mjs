/**
 * Local Placeholder Generator — CelebStyle Phase 7
 *
 * Creates real JPEG placeholder images locally using sharp (no internet needed).
 * Each image uses the outfit's actual color palette as a gradient.
 *
 * Run: npm run generate-placeholders
 *
 * After running this, the app shows styled color placeholders instead of
 * black boxes. Run `npm run generate-assets` later with internet to replace
 * these with actual AI-generated photos.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "apps", "frontend", "public");
const OUT_DIR = join(PUBLIC, "assets", "catalogue");
const GARMENT_SVG_DIR = join(PUBLIC, "assets", "garments");
const SKIP_EXISTING = true;

// ─── Named colour → hex (expanded palette) ───────────────────────────────────

const COLOR_NAMES = {
  black: [15, 15, 15],
  white: [248, 248, 248],
  ivory: [255, 255, 240],
  cream: [255, 253, 245],
  champagne: [247, 231, 206],
  gold: [212, 175, 55],
  silver: [192, 192, 192],
  platinum: [229, 228, 226],
  chrome: [219, 219, 219],
  charcoal: [54, 69, 79],
  grey: [128, 128, 128],
  gray: [128, 128, 128],
  slate: [112, 128, 144],
  navy: [0, 0, 128],
  blue: [70, 130, 180],
  cobalt: [0, 71, 171],
  royal: [65, 105, 225],
  teal: [0, 128, 128],
  turquoise: [64, 224, 208],
  emerald: [80, 200, 120],
  jade: [0, 168, 107],
  forest: [34, 139, 34],
  green: [0, 128, 0],
  olive: [107, 142, 35],
  sage: [188, 202, 165],
  red: [220, 20, 60],
  crimson: [220, 20, 60],
  burgundy: [128, 0, 32],
  maroon: [128, 0, 0],
  rose: [255, 102, 102],
  blush: [255, 182, 193],
  pink: [255, 105, 180],
  fuchsia: [255, 0, 255],
  magenta: [255, 0, 255],
  coral: [255, 127, 80],
  orange: [255, 165, 0],
  saffron: [255, 153, 0],
  amber: [255, 191, 0],
  ochre: [204, 119, 34],
  rust: [183, 65, 14],
  bronze: [205, 127, 50],
  copper: [184, 115, 51],
  brown: [139, 69, 19],
  tan: [210, 180, 140],
  beige: [245, 245, 220],
  sand: [194, 178, 128],
  khaki: [195, 176, 145],
  camel: [193, 154, 107],
  peacock: [51, 160, 150],
  orchid: [218, 112, 214],
  lavender: [230, 230, 250],
  purple: [128, 0, 128],
  violet: [238, 130, 238],
  midnight: [25, 25, 112],
  indigo: [75, 0, 130],
  yellow: [255, 215, 0],
  lemon: [255, 250, 205],
  sunshine: [255, 220, 0],
  ecru: [194, 178, 128],
  dusty: [210, 180, 210],
  deep: [70, 20, 80],
  hot: [255, 69, 0],
  powder: [176, 224, 230],
  pastel: [255, 228, 225],
  rainbow: [255, 100, 150],
  bandhani: [255, 140, 0],
  kasavu: [255, 215, 0],
  tricolour: [255, 153, 51],
  camouflage: [120, 134, 107],
  earthy: [160, 120, 80],
  worn: [150, 135, 115],
};

function parseFirstTwoColors(palette) {
  const words = palette.toLowerCase().replace(/[,]/g, " ").split(/\s+/);
  const found = [];
  for (const w of words) {
    for (const [name, rgb] of Object.entries(COLOR_NAMES)) {
      if (w === name || w.startsWith(name)) {
        found.push(rgb);
        if (found.length === 2) return found;
        break;
      }
    }
    if (found.length === 2) break;
  }
  if (found.length === 0) return [[80, 60, 40], [200, 180, 140]]; // fallback warm brown
  if (found.length === 1) return [found[0], [found[0][0] * 0.7, found[0][1] * 0.7, found[0][2] * 0.7].map(Math.round)];
  return found;
}

// ─── Generate gradient JPEG buffer ───────────────────────────────────────────

function gradientBuffer(width, height, col1, col2) {
  const buf = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const r = Math.round(col1[0] + (col2[0] - col1[0]) * t);
    const g = Math.round(col1[1] + (col2[1] - col1[1]) * t);
    const b = Math.round(col1[2] + (col2[2] - col1[2]) * t);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
    }
  }
  return buf;
}

// Vignette version (darker corners) for more visual interest
function vignetteBuffer(width, height, col1, col2) {
  const buf = Buffer.alloc(width * height * 3);
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const gr = col1[0] + (col2[0] - col1[0]) * t;
    const gg = col1[1] + (col2[1] - col1[1]) * t;
    const gb = col1[2] + (col2[2] - col1[2]) * t;

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vignette = 1 - 0.4 * (dist / maxDist);

      const offset = (y * width + x) * 3;
      buf[offset] = Math.max(0, Math.min(255, Math.round(gr * vignette)));
      buf[offset + 1] = Math.max(0, Math.min(255, Math.round(gg * vignette)));
      buf[offset + 2] = Math.max(0, Math.min(255, Math.round(gb * vignette)));
    }
  }
  return buf;
}

// ─── Outfit data (same as generate-assets.mjs) ───────────────────────────────

const OUTFITS = [
  ["look-shah-rukh-khan-red-carpet", "black charcoal silver"],
  ["look-shah-rukh-khan-jawan", "olive green khaki black"],
  ["look-deepika-padukone-wedding", "gold crimson ivory"],
  ["look-deepika-padukone-pathaan", "red black gold"],
  ["look-priyanka-chopra-party", "champagne nude gold"],
  ["look-ranveer-singh-gully-boy", "black white yellow"],
  ["look-hrithik-roshan-war", "navy white gold"],
  ["look-alia-bhatt-gangubai", "white black red"],
  ["look-katrina-kaif-tiger", "beige khaki black"],
  ["look-akshay-kumar-kesari", "saffron gold navy"],
  ["look-salman-khan-bajrangi", "white sky beige"],
  ["look-allu-arjun-pushpa", "ivory beige maroon"],
  ["look-allu-arjun-pushpa2", "gold black red"],
  ["look-prabhas-bahubali", "gold ivory bronze"],
  ["look-rashmika-pushpa", "red gold green"],
  ["look-vijay-deverakonda-arjun", "black white grey"],
  ["look-rajinikanth-classic", "white cream gold"],
  ["look-vikram-enthiran", "black gold silver"],
  ["look-nayanthara-mersal", "teal gold maroon"],
  ["look-dulquer-salmaan-formal", "slate charcoal white"],
  ["look-fahadh-malik", "white gold saffron"],
  ["look-zendaya-red-carpet", "black silver chrome"],
  ["look-margot-robbie-barbie", "pink white silver"],
  ["look-pedro-pascal-last-of-us", "brown khaki grey"],
  ["look-yash-kgf", "black gold brown"],
  ["look-yash-kgf-formal", "black gold silver"],
  ["look-sudeep-vikrant-rona", "brown copper black"],
  ["look-rishab-shetty-kantara", "ochre red ivory"],
  ["look-darshan-yajamana", "ivory gold maroon"],
  ["look-srinidhi-kgf", "teal gold ivory"],
  ["look-rachita-ram-raajakumara", "crimson gold ivory"],
  ["look-puneeth-yuvarathnaa", "navy white gold"],
  ["look-rakshit-777-charlie", "tan olive white"],
  ["look-khesari-lal-yadav-wedding", "royal blue silver"],
  ["look-anubhav-mohanty-festival", "olive cream rust"],
  ["look-kareena-kapoor-k3g", "fuchsia gold ivory"],
  ["look-aishwarya-rai-devdas", "ivory gold turquoise"],
  ["look-anushka-sharma-nh10", "burgundy white ivory"],
  ["look-kriti-sanon-mimi", "coral white silver"],
  ["look-kiara-advani-shershaah", "teal silver white"],
  ["look-taapsee-pannu-thappad", "rose pink gold"],
  ["look-samantha-mahanati", "jade gold maroon"],
  ["look-kajal-aggarwal-magadheera", "crimson gold emerald"],
  ["look-tamannaah-baahubali", "white turquoise gold"],
  ["look-anushka-shetty-baahubali", "burgundy gold ivory"],
  ["look-madhuri-dixit-devdas", "red gold purple"],
  ["look-kajol-ddlj", "ochre rust ivory"],
  ["look-sonam-kapoor-neerja", "ivory peach brown"],
  ["look-kangana-ranaut-queen", "lavender white silver"],
  ["look-emma-stone-la-la-land", "sunshine yellow white"],
  ["look-anne-hathaway-prada", "cobalt blue white"],
  ["look-cate-blanchett-tar", "black white platinum"],
  ["look-rukmini-vasanth-kantara", "forest green gold"],
  ["look-ragini-dwivedi-event", "purple gold silver"],
  ["look-ranbir-kapoor-animal", "black brown cream"],
  ["look-vicky-kaushal-uri", "olive khaki brown"],
  ["look-amitabh-bachchan-pink", "charcoal white silver"],
  ["look-mammootty-bramayugam", "ivory brown rust"],
  ["look-mohanlal-drishyam", "beige cream navy"],
  ["look-vijay-sethupathi-96", "slate white grey"],
  ["look-festive-diwali-gold-kurta", "gold saffron ivory"],
  ["look-festive-navratri-chaniya", "turquoise fuchsia gold"],
  ["look-festive-wedding-sherwani", "ivory gold champagne"],
  ["look-festive-eid-pathani", "sage green silver"],
  ["look-festive-ganesh-dhoti", "saffron white gold"],
  ["look-festive-onam-saree", "white gold ivory"],
  ["look-festive-pongal-veshti", "white yellow gold"],
  ["look-festive-durga-puja-saree", "red white black"],
  ["look-festive-holi-anarkali", "white pastel rainbow"],
  ["look-festive-new-year-gown", "champagne gold platinum"],
  ["look-festive-karva-chauth-saree", "red gold ivory"],
  ["look-festive-bhai-dooj-kurta", "maroon gold white"],
  ["look-festive-ugadi-silk", "emerald gold ivory"],
  ["look-festive-bihu-mekhela", "red gold black"],
  ["look-festive-navaratri-ghagra", "orange red green"],
  ["look-festive-dussehra-kurta", "saffron maroon gold"],
  ["look-festive-republic-day-kurta", "white tricolour ivory"],
  ["look-festive-reception-gown", "blush pink gold"],
  ["look-festive-sangeet-lehenga", "pink gold green"],
  ["look-festive-eid-anarkali", "powder blue silver"],
  ["look-luxury-organza-saree", "orchid purple gold"],
  ["look-luxury-indo-western", "midnight blue gold"],
  ["look-luxury-black-tie-tux", "black ivory platinum"],
  ["look-luxury-gold-sequin-dress", "gold platinum champagne"],
  ["look-luxury-ball-gown", "ivory gold blush"],
  ["look-luxury-italian-suit", "grey white silver"],
  ["look-luxury-pashmina-set", "ivory silver sage"],
  ["look-luxury-crystal-lehenga", "black silver gold"],
  ["look-luxury-zardosi-sherwani", "royal blue gold"],
  ["look-luxury-silk-brocade-cape", "emerald gold ivory"],
  ["look-luxury-velvet-blazer", "burgundy black gold"],
  ["look-luxury-anarkali", "blush rose gold"],
  ["look-luxury-cashmere-coat", "camel ivory brown"],
  ["look-luxury-beaded-saree", "peacock emerald gold"],
  ["look-luxury-linen-suit", "ecru ivory sand"],
  ["look-luxury-mirror-work-ghagra", "cobalt blue gold"],
  ["look-luxury-bandhgala", "charcoal navy silver"],
  ["look-luxury-cape-lehenga", "dusty rose gold"],
  ["look-luxury-french-gown", "midnight navy silver"],
  ["look-luxury-brocade-kurta", "teal gold bronze"],
];

// Image types and their sizes
const IMAGE_SPECS = [
  { file: "hero.jpg", w: 768, h: 960, style: "vignette" },
  { file: "detail1.jpg", w: 768, h: 768, style: "gradient" },
  { file: "detail2.jpg", w: 768, h: 960, style: "gradient" },
  { file: "fabric.jpg", w: 768, h: 768, style: "vignette" },
  { file: "thumb.jpg", w: 512, h: 640, style: "gradient" },
];

// Celebrity data
const celebSeed = JSON.parse(readFileSync(join(ROOT, "apps", "backend", "src", "data", "celebs-seed.json"), "utf8"));
const CELEBS = celebSeed.records.map(c => ({ id: c.id }));

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function main() {
  let sharp;
  try {
    const mod = await import("sharp");
    sharp = mod.default;
  } catch {
    console.error("ERROR: sharp is not installed. Run: npm install sharp");
    process.exit(1);
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Local Placeholder Generator — ${OUTFITS.length} outfits`);
  console.log(`═══════════════════════════════════════════════════\n`);

  // ── 1. Outfit images ──────────────────────────────────────────────────────
  console.log("  [1/4] Generating outfit placeholder images...");
  let generated = 0, skipped = 0;

  for (const [id, palette] of OUTFITS) {
    const [col1, col2] = parseFirstTwoColors(palette);
    const outDir = join(OUT_DIR, id);
    ensureDir(outDir);

    for (const { file, w, h, style } of IMAGE_SPECS) {
      const destPath = join(outDir, file);
      if (SKIP_EXISTING && existsSync(destPath)) { skipped++; continue; }

      const buf = style === "vignette"
        ? vignetteBuffer(w, h, col1, col2)
        : gradientBuffer(w, h, col1, col2);

      await sharp(buf, { raw: { width: w, height: h, channels: 3 } })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(destPath);
      generated++;
    }
  }
  console.log(`    ✓ ${generated} generated, ${skipped} skipped\n`);

  // ── 2. Garment SVG → PNG ──────────────────────────────────────────────────
  console.log("  [2/4] Converting garment SVGs to transparent PNG...");
  let svgConverted = 0, svgSkipped = 0;

  if (existsSync(GARMENT_SVG_DIR)) {
    const svgFiles = readdirSync(GARMENT_SVG_DIR).filter(f => f.endsWith(".svg"));
    for (const svgFile of svgFiles) {
      const pngFile = svgFile.replace(".svg", ".png");
      const srcPath = join(GARMENT_SVG_DIR, svgFile);
      const destPath = join(GARMENT_SVG_DIR, pngFile);
      if (SKIP_EXISTING && existsSync(destPath)) { svgSkipped++; continue; }
      try {
        await sharp(readFileSync(srcPath), { density: 300 })
          .resize(600, 800, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toFile(destPath);
        svgConverted++;
      } catch (err) {
        console.warn(`    ✗ ${svgFile}: ${err.message}`);
      }
    }
  }
  console.log(`    ✓ ${svgConverted} converted, ${svgSkipped} skipped\n`);

  // ── 3. Copy garment PNGs to outfit directories ────────────────────────────
  console.log("  [3/4] Copying garment PNGs to outfit directories...");
  const GARMENT_MAP = {
    "black": "sherwani.png", "charcoal": "suit.png", "navy": "suit.png",
    "gold": "kurta.png", "saffron": "kurta.png", "white": "kurta.png",
    "ivory": "sherwani.png", "red": "saree.png", "crimson": "saree.png",
    "teal": "saree.png", "turquoise": "lehenga.png", "fuchsia": "lehenga.png",
    "pink": "lehenga.png", "rose": "saree.png", "blush": "lehenga.png",
    "champagne": "dress.png", "olive": "jacket.png", "khaki": "jacket.png",
    "burgundy": "blazer.png", "purple": "saree.png", "orchid": "saree.png",
    "lavender": "dress.png", "cobalt": "suit.png", "emerald": "saree.png",
    "jade": "saree.png", "ochre": "kurta.png", "rust": "kurta.png",
    "bronze": "sherwani.png", "tan": "kurta.png", "beige": "kurta.png",
    "brown": "jacket.png", "copper": "jacket.png", "camel": "jacket.png",
    "ecru": "suit.png", "sage": "kurta.png", "midnight": "suit.png",
    "forest": "saree.png", "peacock": "saree.png", "dusty": "lehenga.png",
    "sunshine": "dress.png", "lemon": "dress.png", "powder": "dress.png",
  };

  // Load existing outfit records' categories from generate-assets.mjs data
  // We use the same OUTFITS array — pick garment PNG from first color
  let garmentCopied = 0, garmentSkipped = 0;
  const { copyFileSync } = await import("fs");

  for (const [id, palette] of OUTFITS) {
    const destPath = join(OUT_DIR, id, "garment.png");
    if (SKIP_EXISTING && existsSync(destPath)) { garmentSkipped++; continue; }

    // Find first matching garment
    const words = palette.toLowerCase().split(/\s+/);
    let garmentPng = "placeholder.png";
    for (const w of words) {
      if (GARMENT_MAP[w]) { garmentPng = GARMENT_MAP[w]; break; }
    }

    const srcPng = join(GARMENT_SVG_DIR, garmentPng);
    const fallback = join(GARMENT_SVG_DIR, "placeholder.png");
    const src = existsSync(srcPng) ? srcPng : (existsSync(fallback) ? fallback : null);
    if (src) {
      ensureDir(join(OUT_DIR, id));
      copyFileSync(src, destPath);
      garmentCopied++;
    }
  }
  console.log(`    ✓ ${garmentCopied} copied, ${garmentSkipped} skipped\n`);

  // ── 4. Celebrity placeholder images ───────────────────────────────────────
  console.log("  [4/4] Generating celebrity placeholder images...");
  const celPalettes = [
    "gold black", "ivory gold", "teal silver", "navy gold", "crimson ivory",
    "saffron white", "purple gold", "emerald gold", "black silver", "rose gold",
  ];
  let celebGen = 0, celebSkip = 0;

  for (let i = 0; i < CELEBS.length; i++) {
    const { id } = CELEBS[i];
    const palette = celPalettes[i % celPalettes.length];
    const [col1, col2] = parseFirstTwoColors(palette);
    const dir = join(OUT_DIR, "celeb", id);
    ensureDir(dir);

    const portraitPath = join(dir, "portrait.jpg");
    if (!SKIP_EXISTING || !existsSync(portraitPath)) {
      const buf = vignetteBuffer(512, 640, col1, col2);
      await sharp(buf, { raw: { width: 512, height: 640, channels: 3 } })
        .jpeg({ quality: 85 }).toFile(portraitPath);
      celebGen++;
    } else celebSkip++;

    const bannerPath = join(dir, "banner.jpg");
    if (!SKIP_EXISTING || !existsSync(bannerPath)) {
      const buf = gradientBuffer(1280, 480, col2, col1);
      await sharp(buf, { raw: { width: 1280, height: 480, channels: 3 } })
        .jpeg({ quality: 85 }).toFile(bannerPath);
      celebGen++;
    } else celebSkip++;
  }
  console.log(`    ✓ ${celebGen} generated, ${celebSkip} skipped\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const IMAGE_FILES = ["hero.jpg", "detail1.jpg", "detail2.jpg", "fabric.jpg", "thumb.jpg", "garment.png"];
  let present = 0, missing = 0;
  for (const [id] of OUTFITS) {
    for (const f of IMAGE_FILES) {
      if (existsSync(join(OUT_DIR, id, f))) present++; else missing++;
    }
  }
  let celebPresent = 0;
  for (const { id } of CELEBS) {
    for (const f of ["portrait.jpg", "banner.jpg"]) {
      if (existsSync(join(OUT_DIR, "celeb", id, f))) celebPresent++;
    }
  }

  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  QA REPORT`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Outfits:      ${OUTFITS.length} × ${IMAGE_FILES.length} = ${OUTFITS.length * IMAGE_FILES.length} files`);
  console.log(`  Present:      ${present}`);
  console.log(`  Missing:      ${missing}`);
  console.log(`  Celebrities:  ${CELEBS.length} × 2 = ${CELEBS.length * 2} files`);
  console.log(`  Celeb present:${celebPresent}`);
  if (missing === 0) {
    console.log(`\n  ✓ All assets present — app is ready!`);
    console.log(`  Run npm run generate-assets to replace with AI photos.`);
  } else {
    console.log(`\n  ✗ ${missing} files still missing — re-run the script`);
  }
  console.log(`═══════════════════════════════════════════════════\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
