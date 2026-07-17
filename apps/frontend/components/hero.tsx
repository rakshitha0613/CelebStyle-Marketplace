import Link from "next/link";
import { LocalImage } from "./local-image";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero text-background">
      <LocalImage
        src="/assets/banners/home-hero.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/30" />
      <div className="relative mx-auto grid min-h-[82vh] max-w-7xl items-center px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-8">
          <div className="inline-flex rounded-full border border-gold/35 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.4em] text-gold">
            Premium Bollywood fashion discovery
          </div>
          <div className="space-y-5">
            <h1 className="font-serif text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Wear What Your Icon Wears
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-background/80 sm:text-xl">
              Discover cinematic celebrity looks, movie-inspired outfits, and luxury occasion styling built for a polished Phase 1 demo.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/celebrities" className="rounded-full bg-gold px-6 py-3 font-medium text-primary transition hover:-translate-y-0.5">
              Explore Celebrities
            </Link>
            <Link href="/search" className="rounded-full border border-background/30 px-6 py-3 font-medium text-background transition hover:bg-background/10">
              Trending Looks
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}