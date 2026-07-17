/**
 * fix-celebrity-portraits.mjs
 * Converts the SVG fashion illustrations (male/female portrait-*.svg) to JPEG
 * and assigns each celebrity a portrait based on gender and name-index.
 * Replaces the flat gradient placeholders with actual illustrated portraits.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, "..");
const PUBLIC = join(ROOT, "apps/frontend/public");
const CELEBS_DIR = join(PUBLIC, "assets/celebrities");

// Load celebrity seed
const seed = JSON.parse(readFileSync(join(ROOT, "apps/backend/src/data/celebs-seed.json"), "utf8"));

// Female name tokens — covers all 101 celebrities
const FEMALE_TOKENS = [
  "deepika","priyanka","alia","katrina","aishwarya","kareena","anushka",
  "kiara","kriti","taapsee","radhika","kangana","madhuri","kajol",
  "rani","sonam","shraddha","rashmika","anushka shetty","kajal",
  "tamannaah","nayanthara","aishwarya lekshmi","samantha","zendaya",
  "emma","margot","anne","meryl","cate","rachita","ragini","aindrita",
  "haripriya","srinidhi","parul","deepa","amulya","anu","rukmini",
  "sindhu","nidhi","pooja","vijayalakshmi","malvika","sreelekha",
];

function isFemale(name) {
  const lower = name.toLowerCase();
  return FEMALE_TOKENS.some(t => lower.includes(t));
}

// Pre-rasterize all SVG variants to JPEG buffers once
async function loadPortraitVariants() {
  const male   = [];
  const female = [];

  const maleDir   = join(PUBLIC, "assets/celebrities/male");
  const femaleDir = join(PUBLIC, "assets/celebrities/female");

  for (const f of readdirSync(maleDir).filter(x => x.endsWith(".svg")).sort()) {
    const svg = readFileSync(join(maleDir, f));
    const buf = await sharp(svg, { density: 150 })
      .resize(512, 640)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    male.push(buf);
    console.log("  ✓ male/" + f, "-", buf.length, "B");
  }

  for (const f of readdirSync(femaleDir).filter(x => x.endsWith(".svg")).sort()) {
    const svg = readFileSync(join(femaleDir, f));
    const buf = await sharp(svg, { density: 150 })
      .resize(512, 640)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    female.push(buf);
    console.log("  ✓ female/" + f, "-", buf.length, "B");
  }

  return { male, female };
}

async function main() {
  console.log("\n=== Fix Celebrity Portraits ===\n");

  console.log("Rasterizing SVG portrait variants...");
  const variants = await loadPortraitVariants();
  console.log(`  male: ${variants.male.length} variants, female: ${variants.female.length} variants\n`);

  const records = seed.records;
  let fixed = 0;

  for (let i = 0; i < records.length; i++) {
    const { id, name } = records[i];
    const female = isFemale(name);
    const pool = female ? variants.female : variants.male;
    const buf = pool[i % pool.length];

    const dir = join(CELEBS_DIR, id);
    mkdirSync(dir, { recursive: true });

    const portraitPath = join(dir, "portrait.jpg");
    writeFileSync(portraitPath, buf);
    fixed++;

    if (i < 10 || i === records.length - 1) {
      console.log(`  ${female ? "♀" : "♂"} ${name} → /assets/celebrities/${id}/portrait.jpg (${buf.length} B)`);
    } else if (i === 10) {
      console.log("  ... (remaining celebs) ...");
    }
  }

  console.log(`\n✓ ${fixed}/${records.length} celebrity portraits written.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
