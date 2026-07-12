import { Navbar } from "@/components/navbar";
import { getOutfits, getCelebrities, getTrending } from "@/lib/api";
import Link from "next/link";
import type { Outfit } from "@/lib/api";

export const dynamic = "force-dynamic";

// Compute trending metrics from outfit catalogue
function computeTrendingColors(outfits: Outfit[]): { color: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const o of outfits) {
    if (o.colorPalette) counts[o.colorPalette] = (counts[o.colorPalette] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([color, count]) => ({ color, count }));
}

function computeTrendingCategories(outfits: Outfit[]): { category: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const o of outfits) {
    counts[o.category] = (counts[o.category] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));
}

function computeTrendingOccasions(outfits: Outfit[]): { occasion: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const o of outfits) {
    counts[o.occasion] = (counts[o.occasion] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([occasion, count]) => ({ occasion, count }));
}

// Simple deterministic color for palette swatches
const COLOUR_MAP: Record<string, string> = {
  "Gold & Red":          "#B45309",
  "Navy & Gold":         "#1E3A5F",
  "Red & Gold":          "#991B1B",
  "Pink & Silver":       "#DB2777",
  "Ivory & Gold":        "#D4A017",
  "Blue & Silver":       "#1D4ED8",
  "Green & Gold":        "#15803D",
  "Purple & Gold":       "#7E22CE",
  "Black & Gold":        "#111827",
  "White & Gold":        "#78716C",
  "Maroon & Gold":       "#7F1D1D",
  "Teal & Silver":       "#0F766E",
  "Peach & Gold":        "#EA580C",
  "Lavender & Silver":   "#7C3AED",
  "Coral & Gold":        "#DC2626",
};

function getSwatchColor(palette: string): string {
  if (COLOUR_MAP[palette]) return COLOUR_MAP[palette];
  const words = palette.split(/\s*&\s*/)[0].toLowerCase();
  const map: Record<string, string> = {
    red: "#DC2626", gold: "#D97706", navy: "#1E3A5F", blue: "#2563EB",
    pink: "#DB2777", ivory: "#F5F0E8", green: "#16A34A", purple: "#7E22CE",
    black: "#111827", white: "#E5E7EB", maroon: "#7F1D1D", teal: "#0F766E",
    peach: "#EA580C", lavender: "#8B5CF6", coral: "#EF4444", silver: "#9CA3AF",
  };
  for (const [key, val] of Object.entries(map)) {
    if (words.includes(key)) return val;
  }
  return "#6B7280";
}

export default async function TrendingPage() {
  const [outfits, celebrities, trendingSection] = await Promise.all([
    getOutfits(),
    getCelebrities(),
    getTrending(12),
  ]);

  const trendingColors     = computeTrendingColors(outfits);
  const trendingCategories = computeTrendingCategories(outfits);
  const trendingOccasions  = computeTrendingOccasions(outfits);
  const maxCategoryCount   = trendingCategories[0]?.count ?? 1;

  const outfitMap = new Map(outfits.map((o) => [o.id, o]));
  const trendingOutfits = trendingSection.items
    .map((item) => outfitMap.get(item.productId))
    .filter((o): o is Outfit => o !== undefined)
    .slice(0, 12);

  // Most expensive outfits (proxy for most aspirational / showcased)
  const luxuryOutfits = [...outfits].sort((a, b) => b.price - a.price).slice(0, 6);

  // Trending celebrities (top-represented in catalogue)
  const celebCount: Record<string, number> = {};
  for (const o of outfits) {
    celebCount[o.celebrityId] = (celebCount[o.celebrityId] || 0) + 1;
  }
  const topCelebIds = Object.entries(celebCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  const topCelebrities = topCelebIds.map((id) => celebrities.find((c) => c.id === id)).filter(Boolean);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.36em] text-accent">What's Hot Right Now</p>
          <h1 className="mt-3 font-serif text-5xl text-primary">Trending Dashboard</h1>
          <p className="mt-2 text-base text-text/60">
            Live snapshot of the most popular outfits, colours, and styles on CelebStyle.
          </p>
        </div>

        {/* Trending Outfits */}
        <div>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-accent">Hot Picks</p>
              <h2 className="mt-2 font-serif text-3xl text-primary">Trending Outfits</h2>
            </div>
            <Link href="/search" className="text-sm font-medium text-accent hover:underline underline-offset-4">
              View all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {trendingOutfits.map((outfit, i) => (
              <Link key={outfit.id} href={`/outfits/${outfit.id}`} className="group overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm hover:shadow-md transition">
                <div className="relative aspect-[3/4] overflow-hidden bg-secondary/20">
                  <img
                    src={outfit.imageUrl}
                    alt={outfit.category}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-background shadow">
                    #{i + 1}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-accent uppercase tracking-[0.2em]">{outfit.occasion}</p>
                  <p className="truncate text-sm font-medium text-primary mt-1">{outfit.category}</p>
                  <p className="truncate text-xs text-text/50">{outfit.celebrityName}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Trending Colors */}
          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.36em] text-accent mb-1">Palette Trends</p>
            <h3 className="font-serif text-2xl text-primary mb-5">Trending Colours</h3>
            <div className="space-y-3">
              {trendingColors.map(({ color, count }, i) => (
                <Link key={color} href={`/search?colorPalette=${encodeURIComponent(color)}`} className="flex items-center gap-3 group">
                  <span className="w-5 text-xs font-medium text-text/40 shrink-0">#{i + 1}</span>
                  <div
                    className="h-6 w-6 shrink-0 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: getSwatchColor(color) }}
                  />
                  <span className="flex-1 text-sm text-primary group-hover:text-accent transition truncate">{color}</span>
                  <span className="text-xs text-text/40 shrink-0">{count} looks</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Trending Categories */}
          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.36em] text-accent mb-1">Style Trends</p>
            <h3 className="font-serif text-2xl text-primary mb-5">Top Categories</h3>
            <div className="space-y-3">
              {trendingCategories.map(({ category, count }, i) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Link href={`/search?category=${encodeURIComponent(category)}`} className="text-primary hover:text-accent transition truncate">
                      {i + 1}. {category}
                    </Link>
                    <span className="text-xs text-text/40 shrink-0 ml-2">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/60 transition-all"
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Occasions */}
          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.36em] text-accent mb-1">Where to Wear</p>
            <h3 className="font-serif text-2xl text-primary mb-5">Occasion Breakdown</h3>
            <div className="space-y-3">
              {trendingOccasions.map(({ occasion, count }, i) => {
                const percent = Math.round((count / outfits.length) * 100);
                return (
                  <div key={occasion} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-medium text-text/40 shrink-0">#{i + 1}</span>
                    <span className="flex-1 text-sm text-primary truncate">{occasion}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 w-16 rounded-full bg-black/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gold/60" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-xs text-text/40 w-8 text-right">{percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trending Celebrities */}
        <div>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Most Active</p>
            <h2 className="mt-2 font-serif text-3xl text-primary">Top Celebrities</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {topCelebrities.map((celeb, i) => celeb && (
              <Link key={celeb.id} href={`/celebrities/${celeb.id}`} className="group text-center">
                <div className="relative mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border-2 border-black/8 bg-secondary/20 shadow-sm transition group-hover:border-accent">
                  <img
                    src={celeb.profileImage}
                    alt={celeb.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    #{i + 1}
                  </div>
                </div>
                <p className="text-xs font-medium text-primary group-hover:text-accent transition line-clamp-2">{celeb.name}</p>
                <p className="text-[10px] text-text/40 mt-0.5">{celebCount[celeb.id]} looks</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Luxury / Most Aspirational */}
        <div>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-accent">Investment Pieces</p>
              <h2 className="mt-2 font-serif text-3xl text-primary">Most Aspirational Looks</h2>
            </div>
            <Link href="/search?sortBy=price_desc" className="text-sm font-medium text-accent hover:underline underline-offset-4">
              Shop luxury →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {luxuryOutfits.map((outfit) => (
              <Link key={outfit.id} href={`/outfits/${outfit.id}`} className="group overflow-hidden rounded-[20px] border border-gold/20 bg-white shadow-sm hover:shadow-md transition">
                <div className="aspect-[3/4] overflow-hidden bg-secondary/20">
                  <img
                    src={outfit.imageUrl}
                    alt={outfit.category}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-medium text-primary">{outfit.category}</p>
                  <p className="text-xs text-text/50">{outfit.celebrityName}</p>
                  <p className="mt-1 text-sm font-bold text-gold">₹{outfit.price.toLocaleString("en-IN")}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-[28px] border border-black/6 bg-white p-10 text-center shadow-sm">
          <p className="font-serif text-3xl text-primary">Spot a look you love?</p>
          <p className="mt-2 text-sm text-text/60">Try it on virtually before you commit.</p>
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <Link href="/try-on" className="rounded-full bg-primary px-7 py-3 text-sm font-medium text-background transition hover:opacity-90">
              ◎ Virtual Try-On
            </Link>
            <Link href="/ai-stylist" className="rounded-full border border-black/10 px-7 py-3 text-sm font-medium text-primary transition hover:bg-black/5">
              ✨ AI Stylist
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
