import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { CelebrityCard } from "@/components/celebrity-card";
import { OutfitCard } from "@/components/outfit-card";
import { RecommendationCarousel } from "@/components/recommendation-carousel";
import { OccasionSuggestions } from "@/components/occasion-suggestions";
import { getCelebrities, getOutfits, getTrending, getNewArrivals, getBlogPosts } from "@/lib/api";
import type { Outfit } from "@/lib/api";
import Link from "next/link";

// Static showcase reviews to complement live review data
const SHOWCASE_REVIEWS = [
  {
    id: "sr1",
    author: "Priya S.",
    avatar: "/assets/avatars/avatar-01.png",
    rating: 5,
    text: "The saree is absolutely stunning — exactly as shown. Got so many compliments at my cousin's wedding!",
    outfit: "Banarasi Silk Saree",
  },
  {
    id: "sr2",
    author: "Rahul M.",
    avatar: "/assets/avatars/avatar-02.png",
    rating: 5,
    text: "Ordered the sherwani for my reception and the quality blew me away. Worth every rupee.",
    outfit: "Royal Bandhgala Sherwani",
  },
  {
    id: "sr3",
    author: "Ananya K.",
    avatar: "/assets/avatars/avatar-03.png",
    rating: 4,
    text: "Love the AR Try-On feature — I tried 6 outfits before deciding. Saved me so much time!",
    outfit: "Embroidered Lehenga",
  },
];

export default async function HomePage() {
  const [celebrities, outfits, trending, newArrivals, blogResult] = await Promise.all([
    getCelebrities(),
    getOutfits(),
    getTrending(10),
    getNewArrivals(10),
    getBlogPosts({ limit: 3 }).catch(() => ({ posts: [], total: 0 })),
  ]);

  const featured = celebrities.slice(0, 6);
  const featuredOutfits = outfits.slice(0, 6);

  // Best sellers — top priced outfits (highest investment pieces)
  const bestSellers = [...outfits].sort((a, b) => b.price - a.price).slice(0, 6);

  // Luxury collection — outfits ≥ ₹28,000
  const luxuryOutfits = outfits.filter((o) => o.price >= 28000).slice(0, 6);

  const outfitMap = new Map(outfits.map((o) => [o.id, o]));
  const trendingOutfits = trending.items
    .map((item) => outfitMap.get(item.productId))
    .filter((o): o is Outfit => o !== undefined);
  const newArrivalOutfits = newArrivals.items
    .map((item) => outfitMap.get(item.productId))
    .filter((o): o is Outfit => o !== undefined);

  const blogPosts = blogResult.posts ?? [];

  return (
    <main>
      <Navbar />
      <Hero />

      {/* Trending Celebrities */}
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

      {/* Featured Looks */}
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

      {/* Trending Now */}
      <RecommendationCarousel
        subtitle="AI Picks"
        title="Trending Now"
        outfits={trendingOutfits}
        viewAllHref="/search"
      />

      {/* New Arrivals */}
      <RecommendationCarousel
        subtitle="Just Arrived"
        title="New Arrivals"
        outfits={newArrivalOutfits}
        viewAllHref="/search"
      />

      {/* Luxury Collection */}
      {luxuryOutfits.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-accent">Luxury Collection</p>
              <h2 className="mt-3 font-serif text-4xl text-primary">Statement pieces for grand occasions</h2>
            </div>
            <Link href="/search?sortBy=price_desc" className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block">
              View luxury looks →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {luxuryOutfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </section>
      )}

      {/* Best Sellers */}
      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-accent">Best Sellers</p>
              <h2 className="mt-3 font-serif text-4xl text-primary">Most coveted celebrity styles</h2>
            </div>
            <Link href="/search" className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block">
              Shop all →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {bestSellers.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.36em] text-accent">What Customers Say</p>
          <h2 className="mt-3 font-serif text-4xl text-primary">Loved by fashion enthusiasts</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SHOWCASE_REVIEWS.map((review) => (
            <div key={review.id} className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`text-sm ${i < review.rating ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-text/80">"{review.text}"</p>
              <div className="mt-4 flex items-center gap-3">
                <img src={review.avatar} alt={review.author} className="h-8 w-8 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-medium text-primary">{review.author}</p>
                  <p className="text-xs text-text/50">{review.outfit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Blog Preview */}
      {blogPosts.length > 0 && (
        <section className="bg-secondary/30 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.36em] text-accent">Style Journal</p>
                <h2 className="mt-3 font-serif text-4xl text-primary">Fashion stories &amp; styling guides</h2>
              </div>
              <Link href="/blog" className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block">
                Read all articles →
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {blogPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group rounded-[24px] border border-black/6 bg-white shadow-sm transition hover:shadow-md overflow-hidden"
                >
                  {post.coverImage && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    {post.tags.length > 0 && (
                      <p className="text-xs text-accent">#{post.tags[0]}</p>
                    )}
                    <h3 className="mt-2 font-serif text-xl text-primary line-clamp-2 group-hover:text-accent transition">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-text/60 line-clamp-2">{post.summary || post.body.slice(0, 120)}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-text/40">
                      <span>{post.authorName}</span>
                      <span>{Math.ceil(post.body.split(" ").length / 200)} min read</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <OccasionSuggestions />
    </main>
  );
}
