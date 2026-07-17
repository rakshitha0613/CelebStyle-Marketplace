/**
 * Asset Generation Script — CelebStyle Phase 7
 *
 * Downloads all outfit and celebrity images from Pollinations.ai (FLUX model)
 * and converts garment SVGs to transparent PNGs using sharp.
 *
 * Run: node scripts/generate-assets.mjs
 * Or:  npm run generate-assets
 *
 * Output structure:
 *   apps/frontend/public/assets/catalogue/{outfitId}/hero.jpg
 *   apps/frontend/public/assets/catalogue/{outfitId}/detail1.jpg
 *   apps/frontend/public/assets/catalogue/{outfitId}/detail2.jpg
 *   apps/frontend/public/assets/catalogue/{outfitId}/fabric.jpg
 *   apps/frontend/public/assets/catalogue/{outfitId}/thumb.jpg
 *   apps/frontend/public/assets/catalogue/{outfitId}/garment.png
 *   apps/frontend/public/assets/catalogue/celeb/{celebId}/portrait.jpg
 *   apps/frontend/public/assets/catalogue/celeb/{celebId}/banner.jpg
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "apps", "frontend", "public");
const OUT_DIR = join(PUBLIC, "assets", "catalogue");
const GARMENT_SVG_DIR = join(PUBLIC, "assets", "garments");

// ─── Configuration ───────────────────────────────────────────────────────────

const CONCURRENCY = 5;          // Parallel downloads (be kind to Pollinations)
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;
const SKIP_EXISTING = true;     // Set false to re-download everything

// ─── Garment category → SVG filename mapping ─────────────────────────────────

const GARMENT_MAP = {
  "Bandhgala": "sherwani.svg",
  "Bandhgala Suit": "sherwani.svg",
  "Luxury Bandhgala": "sherwani.svg",
  "Military Kurta": "kurta.svg",
  "Kurta Set": "kurta.svg",
  "Casual Kurta": "kurta.svg",
  "Embroidered Kurta": "kurta.svg",
  "Festive Kurta": "kurta.svg",
  "White Kurta Set": "kurta.svg",
  "Brocade Kurta": "kurta.svg",
  "Gold Kurta Set": "kurta.svg",
  "Telugu Silk Dhoti": "kurta.svg",
  "Nehru Jacket Set": "kurta.svg",
  "Pongal Veshti Set": "kurta.svg",
  "Dhoti Kurta": "kurta.svg",
  "Pathani Suit": "kurta.svg",
  "Saree": "saree.svg",
  "Silk Saree": "saree.svg",
  "Cotton Saree": "saree.svg",
  "Royal Saree": "saree.svg",
  "Ancient Princess Saree": "saree.svg",
  "Bengali Tant Saree": "saree.svg",
  "Traditional Saree": "saree.svg",
  "Kasavu Saree": "saree.svg",
  "Bridal Saree": "saree.svg",
  "Embellished Saree": "saree.svg",
  "Couture Saree": "saree.svg",
  "Beaded Saree": "saree.svg",
  "Sherwani": "sherwani.svg",
  "Silk Sherwani": "sherwani.svg",
  "Black Sherwani": "sherwani.svg",
  "Warrior Sherwani": "sherwani.svg",
  "Embroidered Sherwani": "sherwani.svg",
  "Zardosi Sherwani": "sherwani.svg",
  "Monogrammed Sherwani": "sherwani.svg",
  "Lehenga": "lehenga.svg",
  "Folk Lehenga": "lehenga.svg",
  "Bridal Lehenga": "lehenga.svg",
  "Princess Lehenga": "lehenga.svg",
  "Sangeet Lehenga": "lehenga.svg",
  "Crystal Lehenga": "lehenga.svg",
  "Cape Lehenga": "lehenga.svg",
  "Chaniya Choli": "lehenga.svg",
  "Bandhani Ghagra": "lehenga.svg",
  "Mirror Work Ghagra": "lehenga.svg",
  "Casual Blazer": "blazer.svg",
  "Blazer Set": "blazer.svg",
  "Velvet Blazer": "blazer.svg",
  "Action Jacket": "jacket.svg",
  "Post-Apocalyptic Jacket": "jacket.svg",
  "Rugged Denim Jacket Set": "jacket.svg",
  "Utility Jacket": "jacket.svg",
  "Leather Jacket": "jacket.svg",
  "Military Jacket": "jacket.svg",
  "Action Jacket Set": "jacket.svg",
  "Suit": "suit.svg",
  "Action Suit": "suit.svg",
  "Tailored Suit": "suit.svg",
  "Classic Suit": "suit.svg",
  "Italian Wool Suit": "suit.svg",
  "Premium Linen Suit": "suit.svg",
  "Power Suit": "suit.svg",
  "Tuxedo": "suit.svg",
  "Black Tie Tuxedo": "suit.svg",
  "Gown": "dress.svg",
  "Evening Dress": "dress.svg",
  "Pink Gown": "dress.svg",
  "Glam Gown": "dress.svg",
  "Sequin Gown": "dress.svg",
  "Reception Gown": "dress.svg",
  "Haute Couture Gown": "dress.svg",
  "French Couture Gown": "dress.svg",
  "Retro Dress": "dress.svg",
  "Casual Dress": "dress.svg",
  "Indo-Western Dress": "indo_western.svg",
  "Indo-Western Set": "indo_western.svg",
  "Anarkali": "dress.svg",
  "Anarkali Suit": "dress.svg",
  "Diamond Anarkali": "dress.svg",
  "Action Bodysuit": "t_shirt.svg",
  "Streetwear Set": "hoodie.svg",
  "Shirt + Veshti": "kurta.svg",
  "Traditional Mundu Set": "kurta.svg",
  "Traditional Tribal Look": "kurta.svg",
  "Sikh Warrior Sherwani": "sherwani.svg",
  "Royal Warrior Costume": "sherwani.svg",
  "Warrior Costume": "sherwani.svg",
  "Period Costume": "kurta.svg",
  "Performance Costume": "t_shirt.svg",
  "Premium Dhoti Set": "sherwani.svg",
  "Casual Linen Set": "kurta.svg",
  "Pashmina Cape Set": "dress.svg",
  "Silk Brocade Cape": "dress.svg",
  "Cashmere Overcoat": "jacket.svg",
  "Sequin Mini Dress": "dress.svg",
  "Mekhela Chador": "saree.svg",
};

// ─── Outfit data ─────────────────────────────────────────────────────────────
// Minimal set needed for image generation:
// [id, category, colorPalette, gender ('m'/'f'), seed, label]

const OUTFITS = [
  ["look-shah-rukh-khan-red-carpet", "Bandhgala Suit", "black charcoal silver", "m", 10010, "SRK Red Carpet Bandhgala"],
  ["look-shah-rukh-khan-jawan", "Military Kurta", "olive green khaki black", "m", 10020, "SRK Jawan Military Kurta"],
  ["look-deepika-padukone-wedding", "Saree", "gold crimson ivory", "f", 10030, "Deepika Banarasi Saree"],
  ["look-deepika-padukone-pathaan", "Action Bodysuit", "red black gold", "f", 10040, "Deepika Pathaan Bodysuit"],
  ["look-priyanka-chopra-party", "Gown", "champagne nude gold", "f", 10050, "Priyanka Champagne Gown"],
  ["look-ranveer-singh-gully-boy", "Streetwear Set", "black white neon yellow", "m", 10060, "Ranveer Gully Boy Streetwear"],
  ["look-hrithik-roshan-war", "Blazer Set", "navy white gold", "m", 10070, "Hrithik War Navy Blazer"],
  ["look-alia-bhatt-gangubai", "Cotton Saree", "white black border red", "f", 10080, "Alia Gangubai White Saree"],
  ["look-katrina-kaif-tiger", "Action Suit", "beige khaki black", "f", 10090, "Katrina Tiger Action Suit"],
  ["look-akshay-kumar-kesari", "Sikh Warrior Sherwani", "saffron gold dark blue", "m", 10100, "Akshay Kesari Saffron Sherwani"],
  ["look-salman-khan-bajrangi", "Casual Kurta", "white sky blue beige", "m", 10110, "Salman Bajrangi White Kurta"],
  ["look-allu-arjun-pushpa", "Kurta Set", "ivory beige maroon", "m", 10120, "Allu Arjun Pushpa Kurta"],
  ["look-allu-arjun-pushpa2", "Premium Dhoti Set", "gold black deep red", "m", 10130, "Allu Arjun Pushpa 2 Dhoti"],
  ["look-prabhas-bahubali", "Royal Warrior Costume", "gold ivory bronze", "m", 10140, "Prabhas Baahubali Warrior"],
  ["look-rashmika-pushpa", "Folk Lehenga", "red gold green", "f", 10150, "Rashmika Pushpa Folk Lehenga"],
  ["look-vijay-deverakonda-arjun", "Casual Blazer", "black white grey", "m", 10160, "Vijay Arjun Reddy Blazer"],
  ["look-rajinikanth-classic", "Shirt + Veshti", "white cream gold", "m", 10170, "Rajini Classic Veshti"],
  ["look-vikram-enthiran", "Performance Costume", "black gold silver", "m", 10180, "Vikram I Costume"],
  ["look-nayanthara-mersal", "Silk Saree", "teal gold maroon", "f", 10190, "Nayanthara Mersal Silk Saree"],
  ["look-dulquer-salmaan-formal", "Suit", "slate charcoal white", "m", 10200, "DQ Formal Suit"],
  ["look-fahadh-malik", "Traditional Mundu Set", "white gold saffron", "m", 10210, "Fahadh Malik Mundu"],
  ["look-zendaya-red-carpet", "Evening Dress", "black silver chrome", "f", 10220, "Zendaya Silver Column Dress"],
  ["look-margot-robbie-barbie", "Pink Gown", "hot pink white silver", "f", 10230, "Margot Robbie Barbie Pink"],
  ["look-pedro-pascal-last-of-us", "Utility Jacket", "brown khaki worn grey", "m", 10240, "Pedro Pascal Joel Jacket"],
  ["look-yash-kgf", "Rugged Denim Jacket Set", "black dark gold brown", "m", 10250, "Yash KGF Denim Jacket"],
  ["look-yash-kgf-formal", "Black Sherwani", "black gold silver", "m", 10260, "Yash KGF Black Sherwani"],
  ["look-sudeep-vikrant-rona", "Warrior Costume", "dark brown copper black", "m", 10270, "Sudeep Vikrant Rona Warrior"],
  ["look-rishab-shetty-kantara", "Traditional Tribal Look", "ochre earthy red ivory", "m", 10280, "Rishab Kantara Tribal"],
  ["look-darshan-yajamana", "Silk Sherwani", "ivory gold deep maroon", "m", 10290, "Darshan Yajamana Sherwani"],
  ["look-srinidhi-kgf", "Glam Gown", "deep teal gold ivory", "f", 10300, "Srinidhi KGF Teal Gown"],
  ["look-rachita-ram-raajakumara", "Silk Saree", "crimson gold ivory", "f", 10310, "Rachita Raajakumara Silk Saree"],
  ["look-puneeth-yuvarathnaa", "Action Jacket Set", "navy white gold", "m", 10320, "Puneeth Yuvarathnaa Jacket"],
  ["look-rakshit-777-charlie", "Casual Linen Set", "earthy tan olive white", "m", 10330, "Rakshit 777 Charlie Linen"],
  ["look-khesari-lal-yadav-wedding", "Kurta", "royal blue white silver", "m", 10340, "Khesari Wedding Kurta"],
  ["look-anubhav-mohanty-festival", "Nehru Jacket Set", "olive cream rust", "m", 10350, "Anubhav Festival Nehru Jacket"],
  // New female (19)
  ["look-kareena-kapoor-k3g", "Lehenga", "fuchsia gold ivory", "f", 20010, "Kareena K3G Fuchsia Lehenga"],
  ["look-aishwarya-rai-devdas", "Bridal Lehenga", "ivory gold turquoise", "f", 20020, "Aishwarya Devdas Bridal Lehenga"],
  ["look-anushka-sharma-nh10", "Casual Dress", "burgundy denim white", "f", 20030, "Anushka NH10 Dress"],
  ["look-kriti-sanon-mimi", "Kurta Set", "coral white silver", "f", 20040, "Kriti Mimi Coral Kurta"],
  ["look-kiara-advani-shershaah", "Anarkali", "teal silver white", "f", 20050, "Kiara Shershaah Anarkali"],
  ["look-taapsee-pannu-thappad", "Silk Saree", "rose pink gold ivory", "f", 20060, "Taapsee Thappad Silk Saree"],
  ["look-samantha-mahanati", "Silk Saree", "jade green gold maroon", "f", 20070, "Samantha Mahanati Jade Saree"],
  ["look-kajal-aggarwal-magadheera", "Princess Lehenga", "crimson gold emerald", "f", 20080, "Kajal Magadheera Princess Lehenga"],
  ["look-tamannaah-baahubali", "Ancient Princess Saree", "white turquoise gold", "f", 20090, "Tamannaah Baahubali Princess Saree"],
  ["look-anushka-shetty-baahubali", "Royal Saree", "deep burgundy gold ivory", "f", 20100, "Anushka Shetty Baahubali Royal Saree"],
  ["look-madhuri-dixit-devdas", "Bridal Lehenga", "deep red gold purple", "f", 20110, "Madhuri Devdas Bridal Lehenga"],
  ["look-kajol-ddlj", "Embroidered Kurta", "mustard rust ivory", "f", 20120, "Kajol DDLJ Mustard Kurta"],
  ["look-sonam-kapoor-neerja", "Retro Dress", "ivory peach brown", "f", 20130, "Sonam Neerja Retro Dress"],
  ["look-kangana-ranaut-queen", "Indo-Western Dress", "lavender white silver", "f", 20140, "Kangana Queen Euro Look"],
  ["look-emma-stone-la-la-land", "Evening Dress", "sunshine yellow white gold", "f", 20150, "Emma Stone La La Land Yellow Dress"],
  ["look-anne-hathaway-prada", "Power Suit", "cobalt blue white silver", "f", 20160, "Anne Hathaway Prada Power Suit"],
  ["look-cate-blanchett-tar", "Tuxedo", "midnight black white platinum", "f", 20170, "Cate Blanchett Tar Tuxedo"],
  ["look-rukmini-vasanth-kantara", "Traditional Saree", "forest green gold red", "f", 20180, "Rukmini Kantara Traditional Saree"],
  ["look-ragini-dwivedi-event", "Embellished Saree", "royal purple gold silver", "f", 20190, "Ragini Dwivedi Purple Saree"],
  // New male (6)
  ["look-ranbir-kapoor-animal", "Leather Jacket", "black dark brown cream", "m", 20200, "Ranbir Animal Leather Jacket"],
  ["look-vicky-kaushal-uri", "Military Jacket", "olive khaki camouflage brown", "m", 20210, "Vicky Uri Military Jacket"],
  ["look-amitabh-bachchan-pink", "Classic Suit", "charcoal white silver", "m", 20220, "Amitabh Pink Classic Suit"],
  ["look-mammootty-bramayugam", "Period Costume", "ivory dark brown rust", "m", 20230, "Mammootty Bramayugam Period"],
  ["look-mohanlal-drishyam", "Casual Kurta", "beige cream navy", "m", 20240, "Mohanlal Drishyam Casual Kurta"],
  ["look-vijay-sethupathi-96", "Casual Kurta", "slate blue off-white grey", "m", 20250, "Vijay Sethupathi 96 Kurta"],
  // Festive (20)
  ["look-festive-diwali-gold-kurta", "Gold Kurta Set", "gold saffron ivory", "m", 30010, "Diwali Gold Kurta Set"],
  ["look-festive-navratri-chaniya", "Chaniya Choli", "turquoise fuchsia gold", "f", 30020, "Navratri Chaniya Choli"],
  ["look-festive-wedding-sherwani", "Embroidered Sherwani", "ivory gold champagne", "m", 30030, "Wedding Embroidered Sherwani"],
  ["look-festive-eid-pathani", "Pathani Suit", "sage green white silver", "m", 30040, "Eid Pathani Suit"],
  ["look-festive-ganesh-dhoti", "Dhoti Kurta", "saffron white gold", "m", 30050, "Ganesh Chaturthi Dhoti Kurta"],
  ["look-festive-onam-saree", "Kasavu Saree", "white golden kasavu", "f", 30060, "Onam Kasavu Saree"],
  ["look-festive-pongal-veshti", "Pongal Veshti Set", "white yellow gold", "m", 30070, "Pongal Veshti Set"],
  ["look-festive-durga-puja-saree", "Bengali Tant Saree", "red white black border", "f", 30080, "Durga Puja Bengali Saree"],
  ["look-festive-holi-anarkali", "Anarkali", "white rainbow pastels", "f", 30090, "Holi Anarkali White"],
  ["look-festive-new-year-gown", "Sequin Gown", "champagne gold platinum", "f", 30100, "New Year Sequin Gown"],
  ["look-festive-karva-chauth-saree", "Bridal Saree", "deep red gold ivory", "f", 30110, "Karva Chauth Silk Saree"],
  ["look-festive-bhai-dooj-kurta", "Festive Kurta", "maroon gold white", "m", 30120, "Bhai Dooj Festive Kurta"],
  ["look-festive-ugadi-silk", "Telugu Silk Dhoti", "emerald green gold ivory", "m", 30130, "Ugadi Emerald Silk Dhoti"],
  ["look-festive-bihu-mekhela", "Mekhela Chador", "red gold black border", "f", 30140, "Bihu Mekhela Chador"],
  ["look-festive-navaratri-ghagra", "Bandhani Ghagra", "orange red green bandhani", "f", 30150, "Navaratri Bandhani Ghagra"],
  ["look-festive-dussehra-kurta", "Embroidered Kurta", "saffron maroon gold", "m", 30160, "Dussehra Embroidered Kurta"],
  ["look-festive-republic-day-kurta", "White Kurta Set", "white tricolour", "m", 30170, "Republic Day White Kurta"],
  ["look-festive-reception-gown", "Reception Gown", "blush pink ivory gold", "f", 30180, "Wedding Reception Gown"],
  ["look-festive-sangeet-lehenga", "Sangeet Lehenga", "hot pink gold green", "f", 30190, "Sangeet Night Lehenga"],
  ["look-festive-eid-anarkali", "Anarkali Suit", "powder blue white silver", "f", 30200, "Eid Anarkali Suit"],
  // Luxury (20)
  ["look-luxury-organza-saree", "Couture Saree", "orchid purple gold silver", "f", 40010, "Luxury Orchid Organza Saree"],
  ["look-luxury-indo-western", "Indo-Western Set", "midnight blue gold ivory", "m", 40020, "Luxury Indo-Western Set"],
  ["look-luxury-black-tie-tux", "Black Tie Tuxedo", "black ivory platinum", "m", 40030, "Luxury Black Tie Tuxedo"],
  ["look-luxury-gold-sequin-dress", "Sequin Mini Dress", "gold platinum champagne", "f", 40040, "Luxury Gold Sequin Dress"],
  ["look-luxury-ball-gown", "Haute Couture Gown", "ivory gold blush", "f", 40050, "Luxury Ivory Ball Gown"],
  ["look-luxury-italian-suit", "Italian Wool Suit", "warm grey white silver", "m", 40060, "Luxury Italian Wool Suit"],
  ["look-luxury-pashmina-set", "Pashmina Cape Set", "ivory silver sage", "f", 40070, "Luxury Pashmina Cape Set"],
  ["look-luxury-crystal-lehenga", "Crystal Lehenga", "jet black crystal gold", "f", 40080, "Luxury Crystal Lehenga"],
  ["look-luxury-zardosi-sherwani", "Zardosi Sherwani", "royal blue gold ivory", "m", 40090, "Luxury Zardosi Sherwani"],
  ["look-luxury-silk-brocade-cape", "Silk Brocade Cape", "emerald gold ivory", "f", 40100, "Luxury Emerald Brocade Cape"],
  ["look-luxury-velvet-blazer", "Velvet Blazer", "burgundy black gold", "m", 40110, "Luxury Burgundy Velvet Blazer"],
  ["look-luxury-anarkali", "Diamond Anarkali", "blush diamond white rose gold", "f", 40120, "Luxury Diamond Anarkali"],
  ["look-luxury-cashmere-coat", "Cashmere Overcoat", "camel ivory dark brown", "m", 40130, "Luxury Camel Cashmere Coat"],
  ["look-luxury-beaded-saree", "Beaded Saree", "peacock blue emerald gold", "f", 40140, "Luxury Peacock Beaded Saree"],
  ["look-luxury-linen-suit", "Premium Linen Suit", "ecru ivory sand", "m", 40150, "Luxury Premium Linen Suit"],
  ["look-luxury-mirror-work-ghagra", "Mirror Work Ghagra", "cobalt blue gold white mirror", "f", 40160, "Luxury Mirror Work Ghagra"],
  ["look-luxury-bandhgala", "Luxury Bandhgala", "charcoal navy silver", "m", 40170, "Luxury Charcoal Bandhgala"],
  ["look-luxury-cape-lehenga", "Cape Lehenga", "dusty rose gold ivory", "f", 40180, "Luxury Cape Lehenga"],
  ["look-luxury-french-gown", "French Couture Gown", "midnight navy silver black", "f", 40190, "Luxury French Couture Gown"],
  ["look-luxury-brocade-kurta", "Brocade Kurta", "deep teal gold bronze", "m", 40200, "Luxury Teal Brocade Kurta"],
];

// ─── Celebrity data ───────────────────────────────────────────────────────────
// Load from the existing seed file
const celebSeed = JSON.parse(readFileSync(join(ROOT, "apps", "backend", "src", "data", "celebs-seed.json"), "utf8"));
const CELEBS = celebSeed.records.map(c => ({ id: c.id, name: c.name, industry: c.industry }));

// ─── Image generation helpers ─────────────────────────────────────────────────

function pollinationsUrl(prompt, seed, width = 768, height = 960) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=${width}&height=${height}&model=flux&nologo=true`;
}

function heroPrompt(label, colors, gender) {
  const g = gender === "f" ? "Indian female model" : "Indian male model";
  return `${label} ${colors} luxury Indian fashion editorial ${g} full body white studio background professional photography 8K sharp focus`;
}

function detailPrompt(label, colors) {
  return `${label} ${colors} Indian fashion garment close-up detail white background 8K professional photography sharp focus`;
}

function detail2Prompt(label, colors, gender) {
  const g = gender === "f" ? "female model" : "male model";
  return `${label} ${colors} Indian fashion back view ${g} white studio editorial 8K professional`;
}

function fabricPrompt(label, colors) {
  return `${label} ${colors} textile fabric texture macro photography 8K detailed sharp crisp`;
}

function thumbPrompt(label, colors, gender) {
  const g = gender === "f" ? "Indian female model" : "Indian male model";
  return `${label} ${colors} Indian fashion ${g} portrait three-quarter view white background 8K sharp`;
}

function celebPortraitPrompt(name, industry) {
  return `professional portrait photograph of Indian ${industry} celebrity ${name} elegant lighting white background 8K sharp focus studio`;
}

function celebBannerPrompt(name, industry) {
  return `cinematic banner photograph of Indian ${industry} celebrity ${name} wide shot dramatic professional lighting 16:9 8K`;
}

// ─── File utilities ───────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function downloadFile(url, destPath, retries = 0) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      headers: { "User-Agent": "CelebStyle-AssetGen/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ensureDir(dirname(destPath));
    const writer = createWriteStream(destPath);
    await pipeline(Readable.fromWeb(res.body), writer);
    return true;
  } catch (err) {
    if (retries < RETRY_LIMIT) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
      return downloadFile(url, destPath, retries + 1);
    }
    return false;
  }
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runPool(tasks, concurrency = CONCURRENCY) {
  let idx = 0;
  let done = 0;
  const total = tasks.length;
  async function worker() {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      await task();
      done++;
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\r  Progress: ${done}/${total} (${Math.round(done / total * 100)}%)   `);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log();
}

// ─── Garment SVG → PNG conversion ────────────────────────────────────────────

async function convertGarmentSvgs() {
  let sharp;
  try {
    const mod = await import("sharp");
    sharp = mod.default;
  } catch {
    console.warn("  sharp not available — skipping SVG→PNG conversion");
    return;
  }

  const svgFiles = readdirSync(GARMENT_SVG_DIR).filter(f => f.endsWith(".svg"));
  console.log(`\n  Converting ${svgFiles.length} garment SVGs to PNG...`);

  // Build a lookup: svgBasename → PNG path
  const svgToPng = {};
  for (const svgFile of svgFiles) {
    const svgPath = join(GARMENT_SVG_DIR, svgFile);
    const svgData = readFileSync(svgPath);
    const pngPath = join(GARMENT_SVG_DIR, svgFile.replace(".svg", ".png"));
    if (!SKIP_EXISTING || !existsSync(pngPath)) {
      try {
        await sharp(svgData, { density: 300 })
          .resize(600, 800, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toFile(pngPath);
        console.log(`    ✓ ${svgFile} → ${svgFile.replace(".svg", ".png")}`);
      } catch (err) {
        console.warn(`    ✗ ${svgFile}: ${err.message}`);
      }
    } else {
      console.log(`    ↩ ${svgFile.replace(".svg", ".png")} (exists)`);
    }
    svgToPng[svgFile] = pngPath;
  }
  return svgToPng;
}

// Copy garment PNG to each outfit directory
async function copyGarmentPngs(svgToPngMap) {
  const { copyFileSync } = await import("fs");
  console.log(`\n  Copying garment PNGs to outfit directories...`);
  let copied = 0, skipped = 0;

  for (const [id, category] of OUTFITS) {
    const svgFile = GARMENT_MAP[category] || "placeholder.svg";
    const pngFile = svgFile.replace(".svg", ".png");
    const srcPng = join(GARMENT_SVG_DIR, pngFile);
    const destPng = join(OUT_DIR, id, "garment.png");

    if (!existsSync(srcPng)) {
      // Fall back to placeholder
      const placeholderPng = join(GARMENT_SVG_DIR, "placeholder.png");
      if (existsSync(placeholderPng)) {
        ensureDir(join(OUT_DIR, id));
        copyFileSync(placeholderPng, destPng);
        copied++;
      }
      continue;
    }

    if (SKIP_EXISTING && existsSync(destPng)) {
      skipped++;
      continue;
    }
    ensureDir(join(OUT_DIR, id));
    copyFileSync(srcPng, destPng);
    copied++;
  }
  console.log(`    ✓ ${copied} copied, ${skipped} skipped`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generateOutfitImages() {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Phase 7 Asset Generation — ${OUTFITS.length} outfits`);
  console.log(`═══════════════════════════════════════════════════\n`);
  console.log(`  Output: ${OUT_DIR}`);
  console.log(`  Skip existing: ${SKIP_EXISTING}`);
  console.log(`  Concurrency: ${CONCURRENCY}\n`);

  const IMAGE_TYPES = [
    { file: "hero.jpg", promptFn: (l, c, g, s) => pollinationsUrl(heroPrompt(l, c, g), s, 768, 960) },
    { file: "detail1.jpg", promptFn: (l, c, g, s) => pollinationsUrl(detailPrompt(l, c), s + 1, 768, 768) },
    { file: "detail2.jpg", promptFn: (l, c, g, s) => pollinationsUrl(detail2Prompt(l, c, g), s + 2, 768, 960) },
    { file: "fabric.jpg", promptFn: (l, c, g, s) => pollinationsUrl(fabricPrompt(l, c), s + 3, 768, 768) },
    { file: "thumb.jpg", promptFn: (l, c, g, s) => pollinationsUrl(thumbPrompt(l, c, g), s + 4, 512, 640) },
  ];

  const tasks = [];
  let totalExpected = 0;

  for (const [id, category, colors, gender, seed, label] of OUTFITS) {
    for (const { file, promptFn } of IMAGE_TYPES) {
      const destPath = join(OUT_DIR, id, file);
      if (SKIP_EXISTING && existsSync(destPath)) continue;
      totalExpected++;
      const url = promptFn(label, colors, gender, seed);
      tasks.push(async () => {
        const ok = await downloadFile(url, destPath);
        if (!ok) console.warn(`\n  ✗ Failed: ${id}/${file}`);
      });
    }
  }

  if (tasks.length === 0) {
    console.log("  All outfit images already exist. Use SKIP_EXISTING=false to re-download.\n");
  } else {
    console.log(`  Downloading ${tasks.length} outfit images...`);
    await runPool(tasks, CONCURRENCY);
    console.log(`  ✓ Outfit images complete\n`);
  }
}

async function generateCelebImages() {
  console.log(`  Generating celebrity images (${CELEBS.length} celebrities × 2)...`);

  const tasks = [];
  for (const { id, name, industry } of CELEBS) {
    const dir = join(OUT_DIR, "celeb", id);
    const portraitPath = join(dir, "portrait.jpg");
    const bannerPath = join(dir, "banner.jpg");
    const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

    if (!SKIP_EXISTING || !existsSync(portraitPath)) {
      const url = pollinationsUrl(celebPortraitPrompt(name, industry), seed, 512, 640);
      tasks.push(async () => {
        const ok = await downloadFile(url, portraitPath);
        if (!ok) console.warn(`\n  ✗ Failed: ${id}/portrait.jpg`);
      });
    }
    if (!SKIP_EXISTING || !existsSync(bannerPath)) {
      const url = pollinationsUrl(celebBannerPrompt(name, industry), seed + 999, 1280, 480);
      tasks.push(async () => {
        const ok = await downloadFile(url, bannerPath);
        if (!ok) console.warn(`\n  ✗ Failed: ${id}/banner.jpg`);
      });
    }
  }

  if (tasks.length === 0) {
    console.log("  All celebrity images already exist.\n");
  } else {
    console.log(`  Downloading ${tasks.length} celebrity images...`);
    await runPool(tasks, CONCURRENCY);
    console.log(`  ✓ Celebrity images complete\n`);
  }
}

function printSummary() {
  let outfitCount = 0, missingCount = 0;
  const missing = [];
  const IMAGE_FILES = ["hero.jpg", "detail1.jpg", "detail2.jpg", "fabric.jpg", "thumb.jpg", "garment.png"];

  for (const [id] of OUTFITS) {
    for (const f of IMAGE_FILES) {
      const p = join(OUT_DIR, id, f);
      if (existsSync(p)) outfitCount++;
      else { missingCount++; missing.push(`${id}/${f}`); }
    }
  }

  let celebCount = 0, celebMissing = 0;
  for (const { id } of CELEBS) {
    for (const f of ["portrait.jpg", "banner.jpg"]) {
      const p = join(OUT_DIR, "celeb", id, f);
      if (existsSync(p)) celebCount++;
      else celebMissing++;
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  FINAL QA REPORT`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Outfits total:       ${OUTFITS.length}`);
  console.log(`  Outfit images found: ${outfitCount} / ${OUTFITS.length * IMAGE_FILES.length}`);
  console.log(`  Outfit images missing: ${missingCount}`);
  console.log(`  Celebrities total:   ${CELEBS.length}`);
  console.log(`  Celeb images found:  ${celebCount} / ${CELEBS.length * 2}`);
  console.log(`  Celeb images missing: ${celebMissing}`);
  if (missing.length > 0) {
    console.log(`\n  Missing files (first 20):`);
    missing.slice(0, 20).forEach(f => console.log(`    - ${f}`));
    if (missing.length > 20) console.log(`    ... and ${missing.length - 20} more`);
  } else {
    console.log(`\n  ✓ Zero missing files — fully production-ready!`);
  }
  console.log(`═══════════════════════════════════════════════════\n`);
}

async function main() {
  ensureDir(OUT_DIR);

  await generateOutfitImages();

  const svgToPngMap = await convertGarmentSvgs();
  if (svgToPngMap) await copyGarmentPngs(svgToPngMap);

  await generateCelebImages();

  printSummary();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
