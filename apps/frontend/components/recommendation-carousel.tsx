"use client";

import Link from "next/link";
import type { Outfit } from "@/lib/api";
import { LocalImage } from "./local-image";

type Props = {
  title: string;
  subtitle?: string;
  outfits: Outfit[];
  viewAllHref?: string;
};

export function RecommendationCarousel({ title, subtitle, outfits, viewAllHref }: Props) {
  if (outfits.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          {subtitle && (
            <p className="text-xs uppercase tracking-[0.36em] text-accent">{subtitle}</p>
          )}
          <h2 className="mt-1 font-serif text-3xl text-primary">{title}</h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="hidden shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline md:block"
          >
            View all →
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin" }}>
        {outfits.map((outfit) => (
          <div
            key={outfit.id}
            className="group w-44 shrink-0 overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-luxe flex flex-col"
          >
            <Link href={`/outfits/${outfit.id}`} className="block">
              <div className="aspect-[3/4] overflow-hidden relative">
                <LocalImage
                  src={outfit.imageUrl}
                  alt={`${outfit.celebrityName} ${outfit.category}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="space-y-1 p-3 pb-2">
                <p className="truncate text-xs uppercase tracking-[0.2em] text-accent">
                  {outfit.occasion}
                </p>
                <p className="truncate font-serif text-sm text-primary">{outfit.celebrityName}</p>
                <p className="truncate text-xs text-text/60">{outfit.category}</p>
                <p className="text-sm font-medium text-primary">
                  ₹{outfit.price.toLocaleString("en-IN")}
                </p>
              </div>
            </Link>
            <div className="px-3 pb-3">
              <Link
                href={`/try-on?outfitId=${outfit.id}`}
                className="flex w-full items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-xs font-medium text-background transition hover:opacity-80"
              >
                ◎ Try On
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
