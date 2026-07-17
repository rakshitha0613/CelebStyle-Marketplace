/**
 * TRYON_PILOT_OUTFITS — fixed, immutable list of the first 10 outfits as
 * actually rendered on /try-on (GET /api/outfits, unfiltered, which is
 * productRepository.findAll() ordered by createdAt asc — the exact order
 * TryOnClient consumes via getOutfits() → outfitsToGarments()).
 *
 * Verified against the live API on 2026-07-15 (see scripts/tryon-pilot-report.json
 * for the full audit). Do not regenerate this list from catalogue order —
 * it is pinned by slug so the pilot scope can never silently drift as new
 * outfits are added ahead of these in the catalogue.
 */
export const TRYON_PILOT_OUTFITS = [
  {
    index: 1,
    id: "look-shah-rukh-khan-red-carpet",
    celebrityId: "shah-rukh-khan",
    celebrityName: "Shah Rukh Khan",
    category: "Bandhgala",
    movieName: "Pathaan",
    colorPalette: "Black, charcoal, silver",
    description:
      "Iconic black bandhgala suit worn by SRK at the Filmfare Awards. Sharp lapels, structured silhouette with subtle silver zari details.",
    price: 28999,
  },
  {
    index: 2,
    id: "look-shah-rukh-khan-jawan",
    celebrityId: "shah-rukh-khan",
    celebrityName: "Shah Rukh Khan",
    category: "Military Kurta",
    movieName: "Jawan",
    colorPalette: "Olive green, khaki, black",
    description:
      "Rugged military-inspired kurta from Jawan's iconic action sequences. Olive green cotton with utility pockets and mandarin collar.",
    price: 18999,
  },
  {
    index: 3,
    id: "look-ranveer-singh-gully-boy",
    celebrityId: "ranveer-singh",
    celebrityName: "Ranveer Singh",
    category: "Streetwear Set",
    movieName: "Gully Boy",
    colorPalette: "Black, white, neon yellow",
    description:
      "Urban streetwear inspired by Murad's iconic look from Gully Boy. Oversized hoodie, baggy cargo pants, and signature chain accessory.",
    price: 12999,
  },
  {
    index: 4,
    id: "look-hrithik-roshan-war",
    celebrityId: "hrithik-roshan",
    celebrityName: "Hrithik Roshan",
    category: "Blazer Set",
    movieName: "War",
    colorPalette: "Navy, white, gold",
    description:
      "Sleek navy double-breasted blazer inspired by Kabir's suave look from War. Premium fabric with sharp tailoring for cocktail evenings.",
    price: 29999,
  },
  {
    index: 5,
    id: "look-akshay-kumar-kesari",
    celebrityId: "akshay-kumar",
    celebrityName: "Akshay Kumar",
    category: "Sikh Warrior Sherwani",
    movieName: "Kesari",
    colorPalette: "Saffron, gold, dark blue",
    description:
      "Saffron warrior sherwani inspired by Havildar Ishar Singh's battle attire from Kesari. Rich jacquard with gold-thread embroidery — perfect for festive occasions.",
    price: 24999,
  },
  {
    index: 6,
    id: "look-salman-khan-bajrangi",
    celebrityId: "salman-khan",
    celebrityName: "Salman Khan",
    category: "Casual Kurta",
    movieName: "Bajrangi Bhaijaan",
    colorPalette: "White, sky blue, beige",
    description:
      "Simple yet iconic white kurta-pyjama look from Bajrangi Bhaijaan. Light cotton with easy drape — the quintessential festive family look.",
    price: 8999,
  },
  {
    index: 7,
    id: "look-ranbir-kapoor-animal",
    celebrityId: "ranbir-kapoor",
    celebrityName: "Ranbir Kapoor",
    category: "Leather Jacket",
    movieName: "Animal",
    colorPalette: "Black, dark brown, cream",
    description:
      "Ranvijay's brooding leather jacket from Animal — dark, commanding, and effortlessly cool. Distressed black leather with cream turtleneck, the look of raw power.",
    price: 24999,
  },
  {
    index: 8,
    id: "look-vicky-kaushal-uri",
    celebrityId: "vicky-kaushal",
    celebrityName: "Vicky Kaushal",
    category: "Military Jacket",
    movieName: "Uri: The Surgical Strike",
    colorPalette: "Olive, khaki, camouflage brown",
    description:
      "Major Vihaan Shergill's precision military look from Uri. Olive tactical jacket with utility pockets — for the bold modern patriot.",
    price: 16999,
  },
  {
    index: 9,
    id: "look-amitabh-bachchan-pink",
    celebrityId: "amitabh-bachchan",
    celebrityName: "Amitabh Bachchan",
    category: "Classic Suit",
    movieName: "Pink",
    colorPalette: "Charcoal, white, silver",
    description:
      "Deepak Sehgal's authoritative charcoal suit from Pink — crisp, sharp, and commanding. Premium worsted wool for the modern gentleman who demands respect.",
    price: 32999,
  },
  {
    index: 10,
    id: "look-deepika-padukone-wedding",
    celebrityId: "deepika-padukone",
    celebrityName: "Deepika Padukone",
    category: "Saree",
    movieName: "Gehraiyaan Press Tour",
    colorPalette: "Gold, crimson, ivory",
    description:
      "Sabyasachi-inspired Banarasi silk saree with gold zari border. Deep crimson drape with ivory blouse worn at her Cannes appearance.",
    price: 32999,
  },
];

export const TRYON_PILOT_OUTFIT_IDS = TRYON_PILOT_OUTFITS.map((o) => o.id);

export function findPilotOutfit(id) {
  return TRYON_PILOT_OUTFITS.find((o) => o.id === id) ?? null;
}

/** Canonical Envato inbox filename for a pilot outfit, e.g. "01-shah-rukh-khan-red-carpet.png". */
export function filenameFor(outfit) {
  const short = outfit.id.replace(/^look-/, "");
  return `${String(outfit.index).padStart(2, "0")}-${short}.png`;
}

/** Reverse lookup: inbox filename → pilot outfit (extension-insensitive). */
export function findPilotOutfitByFilename(filename) {
  const base = filename.replace(/\.(png|jpe?g|webp)$/i, "");
  return TRYON_PILOT_OUTFITS.find((o) => filenameFor(o).replace(/\.png$/i, "") === base) ?? null;
}
