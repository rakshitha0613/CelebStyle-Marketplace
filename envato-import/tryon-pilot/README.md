# Envato Import Inbox — Virtual Try-On Pilot (10 outfits)

This folder is the drop point for garment images generated manually in **Envato Gen AI ImageGen** (or edited via ImageEdit). It is consumed by:

```
node scripts/asset-manager.mjs import-envato-tryon-pilot
```

That command matches each file below by exact filename, validates it, converts it to WebP, and writes it to the outfit's existing asset folder as `garment.webp` — the exact path the Virtual Try-On page already resolves (`apps/frontend/public/assets/outfits/<outfit-slug>/garment.webp`).

**Scope: these are the ONLY 10 outfits in this pilot.** Do not add files for any other outfit — unknown filenames are rejected by the import command.

## Required filenames

Save each generated image into this folder using **exactly** this filename (PNG, JPEG, or WebP all accepted — the importer re-encodes to WebP regardless):

| # | Filename | Outfit ID (slug) | Celebrity | Outfit |
|---|----------|-------------------|-----------|--------|
| 1 | `01-shah-rukh-khan-red-carpet.png` | `look-shah-rukh-khan-red-carpet` | Shah Rukh Khan | Pathaan — Bandhgala |
| 2 | `02-shah-rukh-khan-jawan.png` | `look-shah-rukh-khan-jawan` | Shah Rukh Khan | Jawan — Military Kurta |
| 3 | `03-ranveer-singh-gully-boy.png` | `look-ranveer-singh-gully-boy` | Ranveer Singh | Gully Boy — Streetwear Set |
| 4 | `04-hrithik-roshan-war.png` | `look-hrithik-roshan-war` | Hrithik Roshan | War — Blazer Set |
| 5 | `05-akshay-kumar-kesari.png` | `look-akshay-kumar-kesari` | Akshay Kumar | Kesari — Sikh Warrior Sherwani |
| 6 | `06-salman-khan-bajrangi.png` | `look-salman-khan-bajrangi` | Salman Khan | Bajrangi Bhaijaan — Casual Kurta |
| 7 | `07-ranbir-kapoor-animal.png` | `look-ranbir-kapoor-animal` | Ranbir Kapoor | Animal — Leather Jacket |
| 8 | `08-vicky-kaushal-uri.png` | `look-vicky-kaushal-uri` | Vicky Kaushal | Uri: The Surgical Strike — Military Jacket |
| 9 | `09-amitabh-bachchan-pink.png` | `look-amitabh-bachchan-pink` | Amitabh Bachchan | Pink — Classic Suit |
| 10 | `10-deepika-padukone-wedding.png` | `look-deepika-padukone-wedding` | Deepika Padukone | Gehraiyaan Press Tour — Saree |

## What to generate

Each image must be a **garment-only product photo** — this is the input the AI Virtual Try-On (IDM-VTON) pipeline uses to dress the uploaded person photo. It is NOT a hero/editorial shot and NOT a celebrity photo.

Required:
- garment only, no person, no face, no hands, no mannequin, no celebrity likeness
- front-facing, full garment visible, centered, symmetrical
- plain or easily-removable studio background (light gray recommended)
- no text, no logo, no watermark
- high resolution (at least 1024×1024 recommended; minimum accepted is 512×512)
- photorealistic product photography, not an illustration/cartoon/vector

## Prompts (one per outfit)

Generated from each outfit's actual category, colour palette, and description in the product database.

### 1. 01-shah-rukh-khan-red-carpet.png

**Outfit:** Shah Rukh Khan — Pathaan — Bandhgala (`look-shah-rukh-khan-red-carpet`)
**Colours:** Black, charcoal, silver

```
Ultra-realistic luxury black Indian bandhgala jacket with charcoal and silver detailing, garment-only product photography, front-facing, full jacket visible, perfectly centered, symmetrical presentation, premium black wool-blend fabric, structured mandarin collar, sharp lapels, subtle silver zari thread detailing down the placket, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 2. 02-shah-rukh-khan-jawan.png

**Outfit:** Shah Rukh Khan — Jawan — Military Kurta (`look-shah-rukh-khan-jawan`)
**Colours:** Olive green, khaki, black

```
Ultra-realistic rugged military-inspired kurta in olive green cotton with khaki and black accents, garment-only product photography, front-facing, full kurta visible, perfectly centered, symmetrical presentation, heavy cotton twill fabric, mandarin collar, visible utility chest pockets, reinforced stitching, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 3. 03-ranveer-singh-gully-boy.png

**Outfit:** Ranveer Singh — Gully Boy — Streetwear Set (`look-ranveer-singh-gully-boy`)
**Colours:** Black, white, neon yellow

```
Ultra-realistic oversized urban streetwear hoodie in black, white and neon yellow colour-block panels, garment-only product photography, front-facing, full hoodie visible, perfectly centered, symmetrical presentation, heavyweight cotton fleece fabric, drawstring hood, ribbed cuffs, bold graphic block panels, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 4. 04-hrithik-roshan-war.png

**Outfit:** Hrithik Roshan — War — Blazer Set (`look-hrithik-roshan-war`)
**Colours:** Navy, white, gold

```
Ultra-realistic sleek navy double-breasted blazer with gold button detailing and white shirt underlay, garment-only product photography, front-facing, full blazer visible, perfectly centered, symmetrical presentation, premium navy wool-blend fabric, peak lapels, sharp tailored silhouette, gold-tone buttons, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 5. 05-akshay-kumar-kesari.png

**Outfit:** Akshay Kumar — Kesari — Sikh Warrior Sherwani (`look-akshay-kumar-kesari`)
**Colours:** Saffron, gold, dark blue

```
Ultra-realistic saffron warrior sherwani with gold and dark blue embroidered detailing, garment-only product photography, front-facing, full sherwani visible, perfectly centered, symmetrical presentation, rich saffron jacquard fabric, gold-thread zari embroidery along the placket and collar, structured knee-length silhouette, ornate buttons, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 6. 06-salman-khan-bajrangi.png

**Outfit:** Salman Khan — Bajrangi Bhaijaan — Casual Kurta (`look-salman-khan-bajrangi`)
**Colours:** White, sky blue, beige

```
Ultra-realistic simple white cotton kurta with sky blue and beige subtle detailing, garment-only product photography, front-facing, full kurta visible, perfectly centered, symmetrical presentation, light breathable cotton fabric with natural drape, round neckline, minimal stitching detail, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 7. 07-ranbir-kapoor-animal.png

**Outfit:** Ranbir Kapoor — Animal — Leather Jacket (`look-ranbir-kapoor-animal`)
**Colours:** Black, dark brown, cream

```
Ultra-realistic distressed black leather jacket with dark brown and cream detailing, garment-only product photography, front-facing, full jacket visible, perfectly centered, symmetrical presentation, weathered genuine-look black leather, asymmetric zip closure, cream ribbed collar trim, heavy hardware, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 8. 08-vicky-kaushal-uri.png

**Outfit:** Vicky Kaushal — Uri: The Surgical Strike — Military Jacket (`look-vicky-kaushal-uri`)
**Colours:** Olive, khaki, camouflage brown

```
Ultra-realistic olive tactical military jacket with khaki and camouflage brown detailing, garment-only product photography, front-facing, full jacket visible, perfectly centered, symmetrical presentation, heavy-duty ripstop cotton fabric, multiple utility pockets, epaulettes, reinforced cuffs, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 9. 09-amitabh-bachchan-pink.png

**Outfit:** Amitabh Bachchan — Pink — Classic Suit (`look-amitabh-bachchan-pink`)
**Colours:** Charcoal, white, silver

```
Ultra-realistic authoritative charcoal grey worsted wool suit with white and silver detailing, garment-only product photography, front-facing, full suit jacket visible, perfectly centered, symmetrical presentation, premium worsted wool fabric, notch lapels, crisp tailored silhouette, silver-tone buttons, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

### 10. 10-deepika-padukone-wedding.png

**Outfit:** Deepika Padukone — Gehraiyaan Press Tour — Saree (`look-deepika-padukone-wedding`)
**Colours:** Gold, crimson, ivory

```
Ultra-realistic Banarasi silk saree in deep crimson with gold zari border and ivory blouse, garment-only product photography, saree laid flat and fully unfurled showing the gold zari border and pallu detail, perfectly centered, symmetrical presentation, rich silk fabric with visible woven texture, isolated on a clean plain light gray studio background, even soft studio lighting, no shadow, high-resolution ecommerce catalogue image, suitable as garment input for AI Virtual Try-On. Negative: no person, no model, no face, no hands, no mannequin, no celebrity, no celebrity likeness, no editorial model, no full-body fashion model, no text, no logo, no watermark, no cartoon, no illustration, no vector art, no SVG-style flat graphic, no gradient background
```

## After generating

1. Save all 10 files into this folder with the exact filenames above.
2. Run the import command:

```
node scripts/asset-manager.mjs import-envato-tryon-pilot
```

3. Review the printed summary (imported / rejected / missing / failed / already imported) and `scripts/tryon-pilot-report.json` for the updated `tryOnReady` status of each outfit.
