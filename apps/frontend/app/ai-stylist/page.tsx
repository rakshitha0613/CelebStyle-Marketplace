"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getOutfits, getStoredToken, addToWishlist, isUnauthorizedError } from "@/lib/api";
import type { Outfit } from "@/lib/api";
import { LocalImage } from "@/components/local-image";

// ─── Static styling data ──────────────────────────────────────────────────────

const OCCASIONS = ["Casual", "Wedding", "Party", "Office", "Date Night", "Festival", "Red Carpet", "Vacation"];
const SEASONS   = ["Summer", "Monsoon", "Winter", "Spring"];
const BUDGETS   = ["Under ₹5K", "₹5K–₹15K", "₹15K–₹50K", "Above ₹50K"];
const BODY_TYPES = ["Hourglass", "Pear", "Apple", "Rectangle", "Inverted Triangle"];

type StyleProfile = {
  occasion: string;
  season: string;
  budget: string;
  bodyType: string;
};

type StyleCard = {
  category: string;
  icon: string;
  suggestions: string[];
};

function getStyleSuggestions(profile: StyleProfile, outfitCategory: string): StyleCard[] {
  const { occasion, season, bodyType } = profile;

  const shoeMap: Record<string, string[]> = {
    Wedding:      ["Embellished block heels", "Pearl-strap stilettos", "Embroidered juttis", "Gold kolhapuris"],
    "Red Carpet": ["Metallic strappy heels", "Platform pumps", "Crystal-embellished sandals"],
    Party:        ["Strappy block heels", "Ankle-strap sandals", "Velvet pumps"],
    Office:       ["Pointed-toe flats", "Block-heel mules", "Loafers"],
    Festival:     ["Kolhapuri chappals", "Mirror-work flats", "Embroidered mojaris"],
    Casual:       ["White sneakers", "Slip-on loafers", "Strappy sandals"],
    "Date Night": ["Kitten heels", "Slingback pumps", "Mule sandals"],
    Vacation:     ["Espadrilles", "Strappy flats", "Wedge sandals"],
  };

  const accessoryMap: Record<string, string[]> = {
    Wedding:      ["Potli bag", "Zari clutch", "Beaded evening bag"],
    "Red Carpet": ["Minaudière clutch", "Chain micro bag"],
    Party:        ["Sequin clutch", "Rhinestone mini bag"],
    Office:       ["Structured tote", "Leather satchel"],
    Festival:     ["Jhola bag", "Embroidered tote", "Potli"],
    Casual:       ["Canvas tote", "Crossbody bag", "Woven bucket bag"],
    "Date Night": ["Envelope clutch", "Mini crossbody"],
    Vacation:     ["Raffia tote", "Wicker bag"],
  };

  const jewelleryMap: Record<string, string[]> = {
    Wedding:      ["Kundan choker set", "Polki matha patti", "Jhumka earrings", "Bangles & payal"],
    "Red Carpet": ["Statement diamond cuffs", "Drop earrings", "Layered necklace"],
    Party:        ["Crystal ear cuffs", "Layered chains", "Cocktail ring"],
    Office:       ["Pearl studs", "Delicate gold chain", "Simple bangles"],
    Festival:     ["Oxidised silver jhumkas", "Mirror-work choker", "Ghungroo earrings"],
    Casual:       ["Hoops", "Dainty pendants", "Stackable rings"],
    "Date Night": ["Pearl drop earrings", "Rose gold bracelet", "Tennis necklace"],
    Vacation:     ["Shell earrings", "Turquoise beads", "Anklets"],
  };

  const hairstyleMap: Record<string, string[]> = {
    Wedding:      ["Low gajra bun", "Braided updo with flowers", "Loose waves with hair veil"],
    "Red Carpet": ["Sleek chignon", "Hollywood waves", "High ponytail"],
    Party:        ["Textured waves", "Voluminous blowout", "Half-up half-down"],
    Office:       ["Neat bun", "Low ponytail", "French twist"],
    Festival:     ["Boho braids", "Flower-adorned loose hair", "Fishtail plait"],
    Casual:       ["Messy bun", "Beach waves", "High ponytail"],
    "Date Night": ["Soft curls", "Side-swept waves", "Sleek straight"],
    Vacation:     ["Space buns", "Braids", "Natural waves"],
  };

  const makeupMap: Record<string, string[]> = {
    Wedding:      ["Kohl-rimmed eyes + nude lip", "Smoky eye + deep berry lip", "Bronze lids + coral gloss"],
    "Red Carpet": ["Cut crease eye + red lip", "Glitter liner + nude pout", "Graphic liner + matte lip"],
    Party:        ["Shimmer eye + MLBB lip", "Bronzed glow + pink gloss", "Coloured liner pop"],
    Office:       ["Clean skin + tinted balm", "Natural eye + nude lip", "Subtle lash lift"],
    Festival:     ["Pop of colour eye shadow", "Glitter bindi look", "Kajal + natural lip"],
    Casual:       ["SPF tint + clear gloss", "No-makeup makeup", "Cream blush + mascara"],
    "Date Night": ["Smoky eye + nude lip", "Cat liner + berry lip", "Dewy skin + bold brow"],
    Vacation:     ["SPF glow + coral lip", "Waterproof mascara + gloss", "Sun-kissed bronzer"],
  };

  const colorMap: Record<string, string[]> = {
    Summer:    ["Coral + white", "Sky blue + sand beige", "Lime green + ivory", "Terracotta + rust"],
    Monsoon:   ["Peacock teal + gold", "Magenta + emerald", "Deep plum + silver", "Indigo + cream"],
    Winter:    ["Burgundy + camel", "Navy + ivory", "Forest green + blush", "Charcoal + wine"],
    Spring:    ["Lilac + mint", "Blush pink + sage", "Butter yellow + rose gold", "Peach + dusty blue"],
  };

  const bodyFitTips: Record<string, string[]> = {
    Hourglass:       ["Wrap dresses highlight your waist", "Belted kurtis work beautifully", "A-line lehengas balance proportions"],
    Pear:            ["Embellished necklines draw the eye up", "A-line silhouettes balance hips", "Wide-leg palazzos elongate"],
    Apple:           ["Empire waists create definition", "V-necks elongate the torso", "Flowy anarkalis are flattering"],
    Rectangle:       ["Peplum tops create curves", "Ruffled lehengas add volume", "Belted dresses define the waist"],
    "Inverted Triangle": ["Full skirts balance shoulders", "Off-shoulder tops soften the frame", "Lehengas with heavy skirt work well"],
  };

  return [
    {
      category: "Footwear",
      icon: "👠",
      suggestions: shoeMap[occasion] ?? shoeMap["Casual"],
    },
    {
      category: "Bags & Accessories",
      icon: "👜",
      suggestions: accessoryMap[occasion] ?? accessoryMap["Casual"],
    },
    {
      category: "Jewellery",
      icon: "💍",
      suggestions: jewelleryMap[occasion] ?? jewelleryMap["Casual"],
    },
    {
      category: "Hairstyle",
      icon: "💇",
      suggestions: hairstyleMap[occasion] ?? hairstyleMap["Casual"],
    },
    {
      category: "Makeup",
      icon: "💄",
      suggestions: makeupMap[occasion] ?? makeupMap["Casual"],
    },
    {
      category: "Color Combinations",
      icon: "🎨",
      suggestions: colorMap[season] ?? colorMap["Summer"],
    },
    {
      category: `Body-Type Tips (${bodyType})`,
      icon: "✨",
      suggestions: bodyFitTips[bodyType] ?? bodyFitTips["Hourglass"],
    },
  ];
}

function getBudgetAlternatives(budget: string, outfits: Outfit[]): Outfit[] {
  const ranges: Record<string, [number, number]> = {
    "Under ₹5K":    [0, 5000],
    "₹5K–₹15K":    [5000, 15000],
    "₹15K–₹50K":   [15000, 50000],
    "Above ₹50K":  [50000, Infinity],
  };
  const [min, max] = ranges[budget] ?? [0, Infinity];
  return outfits.filter((o) => o.price >= min && o.price <= max).slice(0, 6);
}

// The catalogue only tags outfits with occasion "Party" | "Festival" | "Wedding" —
// the other occasion options in the UI have no direct match. Rather than silently
// falling back to an occasion-blind slice of the pool (which made the "Celebrity
// Alternatives" section identical for 5 of the 8 occasion choices), match on the
// closest real category cluster first, then the closest real occasion.
const OCCASION_CATEGORY_HINT: Record<string, RegExp> = {
  Casual:        /casual/i,
  Office:        /suit|blazer/i,
  "Red Carpet":  /gown/i,
};
const OCCASION_NEAREST: Record<string, string> = {
  "Date Night": "Party",
  Vacation:     "Festival",
};

function getOccasionMatches(occasion: string, outfits: Outfit[]): Outfit[] {
  const direct = outfits.filter(
    (o) => o.occasion === occasion || o.occasion.toLowerCase().includes(occasion.toLowerCase())
  );
  if (direct.length > 0) return direct;

  const hint = OCCASION_CATEGORY_HINT[occasion];
  if (hint) {
    const byCategory = outfits.filter((o) => hint.test(o.category));
    if (byCategory.length > 0) return byCategory;
  }

  const nearest = OCCASION_NEAREST[occasion];
  if (nearest) return outfits.filter((o) => o.occasion === nearest);

  return [];
}

function SelectChip({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-text/60">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              value === opt
                ? "bg-primary text-background"
                : "border border-black/10 text-text/70 hover:border-primary hover:text-primary"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Mirrors the WishlistButton pattern on the product detail page. */
function SaveToWishlistButton({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleClick = async () => {
    if (!getStoredToken()) {
      router.push("/login?redirect=/ai-stylist");
      return;
    }
    setState("saving");
    try {
      await addToWishlist(outfitId);
      setState("saved");
    } catch (err) {
      if (isUnauthorizedError(err)) {
        router.push("/login?redirect=/ai-stylist");
        return;
      }
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  if (state === "saved") {
    return (
      <span className="flex w-full items-center justify-center gap-1 rounded-full border border-accent/40 bg-accent/5 py-1.5 text-xs font-medium text-accent">
        ♥ Saved
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "saving"}
      className="flex w-full items-center justify-center gap-1 rounded-full border border-black/10 py-1.5 text-xs font-medium text-primary transition hover:bg-black/5 disabled:opacity-50"
    >
      {state === "saving" ? "Saving…" : state === "error" ? "Try again" : "♡ Save"}
    </button>
  );
}

export default function AIStylistPage() {
  const [profile, setProfile] = useState<StyleProfile>({
    occasion: "Wedding",
    season:   "Winter",
    budget:   "₹15K–₹50K",
    bodyType: "Hourglass",
  });
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [outfitsLoading, setOutfitsLoading] = useState(true);
  const [outfitCategory, setOutfitCategory] = useState("");
  const [generated, setGenerated] = useState(false);
  const [styleCards, setStyleCards] = useState<StyleCard[]>([]);
  const [budgetPicks, setBudgetPicks] = useState<Outfit[]>([]);
  const [celebAlts, setCelebAlts] = useState<Outfit[]>([]);

  useEffect(() => {
    getOutfits()
      .then((outfits) => {
        setAllOutfits(outfits);
      })
      .catch(() => {})
      .finally(() => setOutfitsLoading(false));
  }, []);

  const handleGenerate = () => {
    const cards = getStyleSuggestions(profile, outfitCategory);

    // "Garment Category" narrows which outfits are shown below — but only
    // when the typed text actually matches something, so a typo or an
    // unrecognised category falls back to the full catalogue instead of
    // showing an empty result.
    const categoryFilter = outfitCategory.trim().toLowerCase();
    const categoryMatches = categoryFilter
      ? allOutfits.filter((o) => o.category.toLowerCase().includes(categoryFilter))
      : [];
    const pool = categoryMatches.length > 0 ? categoryMatches : allOutfits;

    const budget = getBudgetAlternatives(profile.budget, pool);
    const celebs = getOccasionMatches(profile.occasion, pool).slice(0, 6);
    setStyleCards(cards);
    setBudgetPicks(budget);
    setCelebAlts(celebs.length > 0 ? celebs : pool.slice(0, 6));
    setGenerated(true);
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 grid gap-8 md:grid-cols-[1fr_320px] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Personalised Fashion AI</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">AI Stylist</h1>
            <p className="mt-2 text-lg text-text/60">
              Get complete styling advice — shoes, jewellery, makeup, hair, and more — tailored to your occasion and body type.
            </p>
          </div>
          <div className="hidden aspect-[4/5] overflow-hidden rounded-[28px] md:block">
            <LocalImage
              src="/assets/collections/luxury-atelier/cover.webp"
              alt="Personal fashion stylist"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Profile builder */}
        <div className="rounded-[28px] border border-black/6 bg-white p-8 shadow-sm">
          <p className="font-serif text-2xl text-primary mb-6">Build Your Style Profile</p>
          <div className="grid gap-8 md:grid-cols-2">
            <SelectChip
              label="Occasion"
              options={OCCASIONS}
              value={profile.occasion}
              onChange={(v) => setProfile((p) => ({ ...p, occasion: v }))}
            />
            <SelectChip
              label="Season"
              options={SEASONS}
              value={profile.season}
              onChange={(v) => setProfile((p) => ({ ...p, season: v }))}
            />
            <SelectChip
              label="Budget"
              options={BUDGETS}
              value={profile.budget}
              onChange={(v) => setProfile((p) => ({ ...p, budget: v }))}
            />
            <SelectChip
              label="Body Type"
              options={BODY_TYPES}
              value={profile.bodyType}
              onChange={(v) => setProfile((p) => ({ ...p, bodyType: v }))}
            />
          </div>

          <div className="mt-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-text/60">Garment Category</p>
            <input
              type="text"
              value={outfitCategory}
              onChange={(e) => setOutfitCategory(e.target.value)}
              placeholder="e.g. Lehenga, Saree, Kurta, Dress…"
              className="w-full max-w-sm rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={outfitsLoading}
            className="mt-8 rounded-full bg-primary px-8 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {outfitsLoading ? "Loading catalogue…" : "Generate Style Guide →"}
          </button>
        </div>

        {/* Results */}
        {generated && (
          <div className="mt-12 space-y-10">
            {/* Style cards */}
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-accent mb-2">Complete Look</p>
              <h2 className="font-serif text-3xl text-primary mb-6">
                Styling Guide for {profile.occasion} · {profile.season}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {styleCards.map((card) => (
                  <div
                    key={card.category}
                    className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 text-3xl">{card.icon}</div>
                    <p className="font-medium text-primary mb-3">{card.category}</p>
                    <ul className="space-y-2">
                      {card.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text/70">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Occasion styling tip */}
                <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                  <div className="mb-3 text-3xl">📅</div>
                  <p className="font-medium text-primary mb-3">Occasion Styling</p>
                  <p className="text-sm text-text/70">
                    For <strong>{profile.occasion}</strong> in <strong>{profile.season}</strong>: focus on comfort that photographs well.
                    Layer textures to add depth. Choose breathable fabrics for day events; structured ones for evening.
                    Keep a safety kit: double-sided tape, pins, and a touch-up kit.
                  </p>
                </div>

                {/* Seasonal tip */}
                <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                  <div className="mb-3 text-3xl">🌤</div>
                  <p className="font-medium text-primary mb-3">Seasonal Advice</p>
                  <p className="text-sm text-text/70">
                    {profile.season === "Summer" && "Opt for cotton, linen, and chiffon. Light colours reflect heat. Avoid heavy embroidery in the sun."}
                    {profile.season === "Monsoon" && "Choose quick-dry fabrics. Avoid heavy silks outdoors. Embrace jewel tones — they pop against grey skies."}
                    {profile.season === "Winter" && "Layer shawls and dupattas strategically. Velvet and brocade add warmth with elegance. Deep hues photograph beautifully."}
                    {profile.season === "Spring" && "Pastels and florals shine. Light fabrics with texture (organza, georgette) catch the breeze. Floral motifs feel fresh."}
                  </p>
                </div>
              </div>
            </div>

            {/* Budget picks */}
            {budgetPicks.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.36em] text-accent mb-2">Smart Picks</p>
                <h2 className="font-serif text-3xl text-primary mb-6">
                  Budget Alternatives — {profile.budget}
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin" }}>
                  {budgetPicks.map((outfit) => (
                    <div
                      key={outfit.id}
                      className="w-44 shrink-0 overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm flex flex-col"
                    >
                      <Link href={`/outfits/${outfit.id}`} className="block">
                        <div className="aspect-[3/4] overflow-hidden">
                          <LocalImage
                            src={outfit.imageUrl}
                            alt={outfit.category}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-3 pb-2">
                          <p className="truncate text-xs text-accent uppercase tracking-[0.2em]">{outfit.occasion}</p>
                          <p className="truncate font-serif text-sm text-primary mt-1">{outfit.celebrityName}</p>
                          <p className="truncate text-xs text-text/60">{outfit.category}</p>
                          <p className="text-sm font-medium text-primary mt-1">₹{outfit.price.toLocaleString("en-IN")}</p>
                        </div>
                      </Link>
                      <div className="px-3 pb-3 space-y-1.5">
                        <Link
                          href={`/try-on?outfitId=${outfit.id}`}
                          className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-xs font-medium text-background transition hover:opacity-80"
                        >
                          ◎ Try On
                        </Link>
                        <SaveToWishlistButton outfitId={outfit.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Celebrity alternatives */}
            {celebAlts.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.36em] text-accent mb-2">Inspired By</p>
                <h2 className="font-serif text-3xl text-primary mb-6">
                  Celebrity Alternatives for {profile.occasion}
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin" }}>
                  {celebAlts.map((outfit) => (
                    <div
                      key={outfit.id}
                      className="w-44 shrink-0 overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm flex flex-col"
                    >
                      <Link href={`/outfits/${outfit.id}`} className="block">
                        <div className="aspect-[3/4] overflow-hidden">
                          <LocalImage
                            src={outfit.imageUrl}
                            alt={outfit.category}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-3 pb-2">
                          <p className="truncate font-serif text-sm text-primary">{outfit.celebrityName}</p>
                          <p className="truncate text-xs text-text/60">{outfit.category}</p>
                          <p className="text-sm font-medium text-primary mt-1">₹{outfit.price.toLocaleString("en-IN")}</p>
                        </div>
                      </Link>
                      <div className="px-3 pb-3 space-y-1.5">
                        <Link
                          href={`/try-on?outfitId=${outfit.id}`}
                          className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-xs font-medium text-background transition hover:opacity-80"
                        >
                          ◎ Try On
                        </Link>
                        <SaveToWishlistButton outfitId={outfit.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="rounded-[28px] border border-black/6 bg-white p-8 text-center shadow-sm">
              <p className="font-serif text-2xl text-primary">Ready to Try It On?</p>
              <p className="mt-2 text-sm text-text/60">Use our Virtual Try-On to see how any outfit looks on you before buying.</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/try-on"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
                >
                  ◎ Open Virtual Try-On
                </Link>
                <Link
                  href="/search"
                  className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium text-primary transition hover:bg-secondary"
                >
                  Browse Outfits →
                </Link>
              </div>
            </div>
          </div>
        )}

        {!generated && (
          <div className="mt-12 rounded-[28px] border border-black/6 bg-white p-12 text-center shadow-sm">
            <p className="text-5xl mb-4">✨</p>
            <p className="font-serif text-2xl text-primary">Your Style Guide Awaits</p>
            <p className="mt-2 text-sm text-text/60 max-w-md mx-auto">
              Fill in your preferences above and click "Generate Style Guide" to get personalised recommendations for shoes, jewellery, makeup, hairstyle, and more.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
