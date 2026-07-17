/**
 * AI Fashion Image Generator — Replicate (Flux 1.1 Pro Ultra)
 *
 * Generates original, non-celebrity, photorealistic luxury fashion
 * editorial portraits. No real people, no stock/internet images.
 *
 * Usage:
 *   node scripts/generate-fashion-images.mjs sample     # small style-check batch
 *   node scripts/generate-fashion-images.mjs full        # full batch (later)
 */

import { existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "apps", "frontend", "public", "assets", "generated");

const envPath = join(ROOT, "apps", "backend", ".env");
const envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const tokenMatch = envText.match(/^REPLICATE_API_TOKEN="?([^"\n]+)"?/m);
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || (tokenMatch && tokenMatch[1]);

if (!REPLICATE_API_TOKEN) {
  console.error("REPLICATE_API_TOKEN not found in apps/backend/.env");
  process.exit(1);
}

const MODEL = "black-forest-labs/flux-1.1-pro-ultra";

const NEGATIVE_TERMS =
  "no cartoon, no illustration, no anime, no 3d render, no CGI look, no vector art, " +
  "no watermark, no text, no logo, no deformed hands, no extra limbs, no plastic skin, no airbrushed skin";

function buildPrompt({ subject, ethnicity, age, garment, colors, pose, setting }) {
  return (
    `Ultra photorealistic luxury fashion editorial photograph of a ${age}-year-old ${ethnicity} ${subject}, ` +
    `wearing ${garment} in ${colors}, ${pose}, shot for a high-end fashion campaign magazine, ` +
    `${setting}, natural skin texture with visible pores, natural studio lighting, ` +
    `high-detail fabric texture, shallow depth of field, beautiful background bokeh, ` +
    `shot on Hasselblad medium format camera, 85mm lens, sharp focus on face, true-to-life color grading, ` +
    `professional editorial photography, 8K quality. Negative: ${NEGATIVE_TERMS}`
  );
}

// ── Sample batch: diverse anonymous models, distinct poses/garments/settings ──
const SAMPLE = [
  {
    id: "sample-01-indian-female",
    subject: "female model",
    ethnicity: "Indian",
    age: 24,
    garment: "an embroidered gold silk saree with a fitted blouse",
    colors: "deep maroon and gold tones",
    pose: "standing three-quarter turn, one hand gently touching the pallu drape",
    setting: "softly lit minimalist studio with warm amber backdrop",
  },
  {
    id: "sample-02-african-male",
    subject: "male model",
    ethnicity: "African",
    age: 29,
    garment: "a tailored charcoal wool suit with a silk pocket square",
    colors: "charcoal grey and deep navy",
    pose: "confident standing pose, hands in pockets, chin slightly lifted",
    setting: "moody grey studio backdrop with a single side key light",
  },
  {
    id: "sample-03-middle-eastern-female",
    subject: "female model",
    ethnicity: "Middle Eastern",
    age: 27,
    garment: "a flowing champagne silk evening gown with hand-beaded bodice",
    colors: "champagne, ivory and rose gold",
    pose: "walking pose mid-stride, fabric flowing behind her",
    setting: "elegant dark backdrop with dramatic rim lighting",
  },
  {
    id: "sample-04-east-asian-male",
    subject: "male model",
    ethnicity: "East Asian",
    age: 23,
    garment: "an oversized cream linen jacket over a black turtleneck",
    colors: "cream, black and stone grey",
    pose: "seated on a minimalist stool, relaxed posture, looking off-camera",
    setting: "bright airy studio with soft natural window light",
  },
  {
    id: "sample-05-european-female",
    subject: "female model",
    ethnicity: "European",
    age: 31,
    garment: "a sharply tailored cobalt blue power blazer suit",
    colors: "cobalt blue and white",
    pose: "dynamic stride forward, one hand adjusting blazer lapel",
    setting: "clean white cyclorama studio with soft top light",
  },
];

async function createPrediction(prompt, seed) {
  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "4:5",
        raw: true,
        output_format: "png",
        seed,
        safety_tolerance: 2,
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Replicate error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function pollPrediction(prediction) {
  let p = prediction;
  while (p.status !== "succeeded" && p.status !== "failed" && p.status !== "canceled") {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(p.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    });
    p = await res.json();
  }
  return p;
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("fs");
  ensureDir(dirname(destPath));
  writeFileSync(destPath, buf);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function upscaleTo(destPath, minW, minH) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("  sharp not available — skipping upscale check");
    return;
  }
  const meta = await sharp(destPath).metadata();
  if (meta.width < minW || meta.height < minH) {
    const buf = await sharp(destPath)
      .resize(minW, minH, { fit: "cover", kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const { writeFileSync } = await import("fs");
    writeFileSync(destPath, buf);
    console.log(`    ↑ upscaled ${meta.width}x${meta.height} → ${minW}x${minH}`);
  }
}

async function generateOne(item, index) {
  const prompt = buildPrompt(item);
  const seed = 900000 + index;
  console.log(`  [${index + 1}] Generating ${item.id} ...`);
  const created = await createPrediction(prompt, seed);
  const done = await pollPrediction(created);
  if (done.status !== "succeeded") {
    console.error(`    ✗ ${item.id} failed: ${done.error || done.status}`);
    return { id: item.id, ok: false, error: done.error || done.status };
  }
  const imageUrl = Array.isArray(done.output) ? done.output[0] : done.output;
  const destPath = join(OUT_DIR, "sample", `${item.id}.png`);
  await downloadImage(imageUrl, destPath);
  await upscaleTo(destPath, 2048, 2560);
  console.log(`    ✓ saved ${destPath}`);
  return { id: item.id, ok: true, path: destPath, prompt };
}

// ── One-off catalogue portrait: Vogue/Farfetch-style studio editorial ──
const CUSTOM = [
  {
    id: "custom-01-luxury-editorial-female",
    subject: "female fashion model",
    ethnicity: "South Asian",
    age: 26,
    garment: "a sharply tailored ivory silk column dress with clean minimal lines",
    colors: "ivory and soft beige tones",
    pose:
      "standing naturally in an elegant symmetrical pose, full body visible from head to feet, " +
      "hands relaxed and visible at her sides, natural composed expression, facing camera three-quarter angle",
    setting:
      "minimal luxury studio backdrop in light beige and soft ivory, no distractions, seamless premium fashion backdrop, " +
      "soft even studio lighting, shot on Sony A7R V with an 85mm portrait lens, ultra sharp focus, natural skin texture with visible pores, " +
      "high dynamic range, commercial advertising quality, suitable for virtual try-on catalogue use",
  },
];

async function main() {
  const mode = process.argv[2] || "sample";
  ensureDir(OUT_DIR);

  if (mode === "sample") {
    console.log(`\nGenerating ${SAMPLE.length} sample images via ${MODEL}...\n`);
    const results = [];
    for (let i = 0; i < SAMPLE.length; i++) {
      try {
        results.push(await generateOne(SAMPLE[i], i));
      } catch (err) {
        console.error(`    ✗ ${SAMPLE[i].id} error: ${err.message}`);
        results.push({ id: SAMPLE[i].id, ok: false, error: err.message });
      }
    }
    console.log("\n─── Summary ───");
    for (const r of results) {
      console.log(`  ${r.ok ? "✓" : "✗"} ${r.id}${r.ok ? "" : ": " + r.error}`);
    }
  } else if (mode === "custom") {
    console.log(`\nGenerating ${CUSTOM.length} custom image(s) via ${MODEL}...\n`);
    const results = [];
    for (let i = 0; i < CUSTOM.length; i++) {
      try {
        results.push(await generateOne(CUSTOM[i], i));
      } catch (err) {
        console.error(`    ✗ ${CUSTOM[i].id} error: ${err.message}`);
        results.push({ id: CUSTOM[i].id, ok: false, error: err.message });
      }
    }
    console.log("\n─── Summary ───");
    for (const r of results) {
      console.log(`  ${r.ok ? "✓" : "✗"} ${r.id}${r.ok ? "" : ": " + r.error}`);
    }
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
