#!/usr/bin/env node
/** Regenerates envato-import/tryon-pilot/README.md from the pilot data + prompts. Re-run after editing pilot-outfits.mjs or envato-prompts.mjs. */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { TRYON_PILOT_OUTFITS, filenameFor } from "./pilot-outfits.mjs";
import { ENVATO_PROMPTS } from "./envato-prompts.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..", "..");
const INBOX_DIR = join(ROOT, "envato-import", "tryon-pilot");
const README_PATH = join(INBOX_DIR, "README.md");

function build() {
  const rows = TRYON_PILOT_OUTFITS.map((o) => ({ ...o, filename: filenameFor(o) }));

  let md = "";
  md += "# Envato Import Inbox — Virtual Try-On Pilot (10 outfits)\n\n";
  md += "This folder is the drop point for garment images generated manually in **Envato Gen AI ImageGen** (or edited via ImageEdit). It is consumed by:\n\n";
  md += "```\nnode scripts/asset-manager.mjs import-envato-tryon-pilot\n```\n\n";
  md += "That command matches each file below by exact filename, validates it, converts it to WebP, and writes it to the outfit's existing asset folder as `garment.webp` — the exact path the Virtual Try-On page already resolves (`apps/frontend/public/assets/outfits/<outfit-slug>/garment.webp`).\n\n";
  md += "**Scope: these are the ONLY 10 outfits in this pilot.** Do not add files for any other outfit — unknown filenames are rejected by the import command.\n\n";
  md += "## Required filenames\n\n";
  md += "Save each generated image into this folder using **exactly** this filename (PNG, JPEG, or WebP all accepted — the importer re-encodes to WebP regardless):\n\n";
  md += "| # | Filename | Outfit ID (slug) | Celebrity | Outfit |\n";
  md += "|---|----------|-------------------|-----------|--------|\n";
  for (const r of rows) {
    md += `| ${r.index} | \`${r.filename}\` | \`${r.id}\` | ${r.celebrityName} | ${r.movieName} — ${r.category} |\n`;
  }
  md += "\n## What to generate\n\n";
  md += "Each image must be a **garment-only product photo** — this is the input the AI Virtual Try-On (IDM-VTON) pipeline uses to dress the uploaded person photo. It is NOT a hero/editorial shot and NOT a celebrity photo.\n\n";
  md += "Required:\n";
  md += "- garment only, no person, no face, no hands, no mannequin, no celebrity likeness\n";
  md += "- front-facing, full garment visible, centered, symmetrical\n";
  md += "- plain or easily-removable studio background (light gray recommended)\n";
  md += "- no text, no logo, no watermark\n";
  md += "- high resolution (at least 1024×1024 recommended; minimum accepted is 512×512)\n";
  md += "- photorealistic product photography, not an illustration/cartoon/vector\n\n";
  md += "## Prompts (one per outfit)\n\n";
  md += "Generated from each outfit's actual category, colour palette, and description in the product database.\n\n";
  for (const r of rows) {
    md += `### ${r.index}. ${r.filename}\n\n`;
    md += `**Outfit:** ${r.celebrityName} — ${r.movieName} — ${r.category} (\`${r.id}\`)\n`;
    md += `**Colours:** ${r.colorPalette}\n\n`;
    md += "```\n" + ENVATO_PROMPTS[r.id] + "\n```\n\n";
  }
  md += "## After generating\n\n";
  md += "1. Save all 10 files into this folder with the exact filenames above.\n";
  md += "2. Run the import command:\n\n```\nnode scripts/asset-manager.mjs import-envato-tryon-pilot\n```\n\n";
  md += "3. Review the printed summary (imported / rejected / missing / failed / already imported) and `scripts/tryon-pilot-report.json` for the updated `tryOnReady` status of each outfit.\n";

  mkdirSync(INBOX_DIR, { recursive: true });
  writeFileSync(README_PATH, md, "utf8");
  console.log(`README written to envato-import/tryon-pilot/README.md (${rows.length} outfits)`);
}

build();
