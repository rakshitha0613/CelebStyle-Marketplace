import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { CelebrityCard } from "@/components/celebrity-card";
import { OutfitCard } from "@/components/outfit-card";
import { RecommendationCarousel } from "@/components/recommendation-carousel";
import { OccasionSuggestions } from "@/components/occasion-suggestions";
import { getCelebrities, getOutfits, getTrending, getNewArrivals } from "@/lib/api";
import type { Outfit } from "@/lib/api";
import Link from "next/link";

export default async function HomePage() {
  const [celebrities, outfits, trending, newArrivals] = await Promise.all([
    getCelebrities(),
    getOutfits(),
    getTrending(10),
    getNewArrivals(10),
  ]);
  const featured = celebrities.slice(0, 6);
  const featuredOutfits = outfits.slice(0, 6);

  const outfitMap = new Map(outfits.map((o) => [o.id, o]));
  const trendingOutfits = trending.items
    .map((item) => outfitMap.get(item.productId))
    .filter((o): o is Outfit => o !== undefined);
  const newArrivalOutfits = newArrivals.items
    .map((item) => outfitMap.get(item.productId))
    .filter((o): o is Outfit => o !== undefined);

  return (
    <main>
      <Navbar />
      <Hero />
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Trending Celebrities</p>
            <h2 className="mt-3 font-serif text-4xl text-primary">Cinematic icons curated for browsing</h2>
          </div>
          <Link href="/celebrities" className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block">
            View all {celebrities.length} →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((celebrity) => (
            <CelebrityCard key={celebrity.id} celebrity={celebrity} />
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Featured Looks</p>
            <h2 className="mt-3 font-serif text-4xl text-primary">Celebrity outfit catalogue</h2>
          </div>
          <Link href="/search" className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block">
            Browse all looks →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featuredOutfits.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>
      </section>

      <RecommendationCarousel
        subtitle="AI Picks"
        title="Trending Now"
        outfits={trendingOutfits}
        viewAllHref="/search"
      />

      <RecommendationCarousel
        subtitle="Just Arrived"
        title="New Arrivals"
        outfits={newArrivalOutfits}
        viewAllHref="/search"
      />

      <OccasionSuggestions />
    </main>
  );
}
