import type { OutfitRecord } from "./catalogue.js";
import { outfitRecords } from "./catalogue.js";

export type CollectionDefinition = {
  slug: string;
  name: string;
  description: string;
  coverImageUrl: string;
  filter: (outfit: OutfitRecord) => boolean;
};

// Derived from existing outfit id-prefix/occasion/category fields — no new
// per-outfit tagging needed. Overlap between collections is intentional
// (same convention as storefront featured products).
export const COLLECTION_DEFINITIONS: CollectionDefinition[] = [
  {
    slug: "festive-edit",
    name: "Festive Edit",
    description: "Gold, saffron and ivory looks built for Diwali, Navratri, Eid and every festival in between.",
    coverImageUrl: "/assets/collections/festive-edit/cover.webp",
    filter: (o) => o.id.startsWith("look-festive-"),
  },
  {
    slug: "luxury-atelier",
    name: "Luxury Atelier",
    description: "The most exclusive statement pieces in the catalogue — couture sarees, tuxedos and bridal lehengas.",
    coverImageUrl: "/assets/collections/luxury-atelier/cover.webp",
    filter: (o) => o.id.startsWith("look-luxury-"),
  },
  {
    slug: "cinematic-icons",
    name: "Cinematic Icons",
    description: "Movie and character-inspired looks straight off the screen.",
    coverImageUrl: "/assets/collections/cinematic-icons/cover.webp",
    filter: (o) => !o.id.startsWith("look-festive-") && !o.id.startsWith("look-luxury-"),
  },
  {
    slug: "wedding-edit",
    name: "Wedding Edit",
    description: "Bridal and wedding-guest looks for every ceremony.",
    coverImageUrl: "/assets/collections/wedding-edit/cover.webp",
    filter: (o) => o.occasion === "Wedding",
  },
  {
    slug: "red-carpet-icons",
    name: "Red Carpet Icons",
    description: "Award-night and premiere-ready glamour.",
    coverImageUrl: "/assets/collections/red-carpet-icons/cover.webp",
    filter: (o) => o.occasion === "Party",
  },
  {
    slug: "power-dressing",
    name: "Power Dressing",
    description: "Sharply tailored suits, blazers, bandhgalas and tuxedos.",
    coverImageUrl: "/assets/collections/power-dressing/cover.webp",
    filter: (o) => /suit|blazer|bandhgala|tuxedo/i.test(o.category),
  },
];

export function outfitIdsForCollection(def: CollectionDefinition): string[] {
  return outfitRecords
    .filter(def.filter)
    .sort((a, b) => b.price - a.price)
    .map((o) => o.id);
}
