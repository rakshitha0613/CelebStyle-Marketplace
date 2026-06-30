"use client";

import Link from "next/link";
import type { Outfit } from "@/lib/api";

type OutfitCardProps = {
  outfit: Outfit;
  onTagClick?: (filterType: "occasion" | "category" | "color", value: string) => void;
};

export function OutfitCard({ outfit, onTagClick }: OutfitCardProps) {
  return (
    <article className="group rounded-[28px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe">
      <Link href={`/outfits/${outfit.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-t-[28px] bg-primary">
          <img
            src={outfit.imageUrl}
            alt={`${outfit.celebrityName} ${outfit.category}`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/42 via-transparent to-transparent" />
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">{outfit.occasion}</p>
          <p className="text-sm font-medium text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <Link href={`/outfits/${outfit.id}`} className="inline-block">
            <h3 className="font-serif text-2xl text-primary transition group-hover:text-accent">{outfit.celebrityName}</h3>
          </Link>
          <p className="text-sm text-text/70">{outfit.category} · {outfit.movieName}</p>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-text/75">{outfit.description}</p>

        <Link href={`/outfits/${outfit.id}`} className="inline-flex text-sm font-medium text-accent underline-offset-4 hover:underline">
          View details →
        </Link>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 pt-2">
          {outfit.colorPalette && (
            <button
              onClick={() => onTagClick?.("color", outfit.colorPalette)}
              className="rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium text-primary transition hover:bg-secondary"
            >
              {outfit.colorPalette}
            </button>
          )}
          <button
            onClick={() => onTagClick?.("category", outfit.category)}
            className="rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium text-primary transition hover:bg-secondary"
          >
            {outfit.category}
          </button>
        </div>
      </div>
    </article>
  );
}