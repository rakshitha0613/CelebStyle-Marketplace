"use client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useState, use } from "react";
import { Navbar } from "@/components/navbar";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getManufacturers, getOutfit } from "@/lib/api";

type OutfitDetailPageProps = {
  params: Promise<{ id: string }>;
};

// Inner client component for gallery interactions
function OutfitGallery({ outfit, manufacturers }: { outfit: any; manufacturers: any[] }) {
  const allImages = outfit.images && outfit.images.length > 0
    ? outfit.images
    : [outfit.imageUrl];

  const [activeIdx, setActiveIdx] = useState(0);

  const linkedManufacturers = (outfit.manufacturerIds || [])
    .map((manufacturerId: string) => manufacturers.find((m) => m.id === manufacturerId))
    .filter(Boolean);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT — Myntra-style image gallery */}
        <div className="space-y-4">
          <Link href="/search" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            ← Back to looks
          </Link>

          {/* Main image */}
          <div className="overflow-hidden rounded-[32px] border border-black/6 bg-white shadow-sm">
            <div className="aspect-[4/5] bg-primary">
              <img
                src={allImages[activeIdx]}
                alt={`${outfit.celebrityName} ${outfit.category} - view ${activeIdx + 1}`}
                className="h-full w-full object-cover transition-all duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = outfit.imageUrl;
                }}
              />
            </div>
          </div>

          {/* Thumbnail strip (Myntra-style) */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {allImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`shrink-0 h-20 w-16 overflow-hidden rounded-[12px] border-2 transition-all ${
                    activeIdx === idx
                      ? "border-primary shadow-md"
                      : "border-black/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt={`Angle ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = outfit.imageUrl;
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image count badge */}
          {allImages.length > 1 && (
            <p className="text-xs text-text/40 text-center">
              {activeIdx + 1} / {allImages.length} views
            </p>
          )}

          {/* Outfit info below images */}
          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">{outfit.occasion}</p>
                <h1 className="mt-2 font-serif text-4xl text-primary">{outfit.category}</h1>
                <p className="mt-1 text-sm text-text/60">{outfit.celebrityName}</p>
              </div>
              <p className="text-2xl font-medium text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
            </div>
            <p className="text-base leading-7 text-text/75">{outfit.description}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-secondary px-4 py-2 text-primary">
                🎬 {outfit.movieName}
              </span>
              {outfit.characterName && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">
                  🎭 {outfit.characterName}
                </span>
              )}
              {outfit.year && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">
                  📅 {outfit.year}
                </span>
              )}
              {outfit.colorPalette && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">
                  🎨 {outfit.colorPalette}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — purchase panel */}
        <div className="space-y-6">
          <AddToCartButton outfit={outfit} />

          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Delivery & Fit</p>
            <div className="mt-4 space-y-3 text-sm text-text/70">
              <p>Estimated dispatch: 7-10 working days</p>
              <p>Fabric: premium replica selection based on catalogue metadata</p>
              <p>Size options: XS to XXL</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Linked Manufacturers</p>
            <div className="mt-4 space-y-3">
              {linkedManufacturers.length > 0 ? (
                linkedManufacturers.map((manufacturer: any) =>
                  manufacturer ? (
                    <div key={manufacturer.id} className="rounded-2xl border border-black/6 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">{manufacturer.name}</p>
                        <p className="text-sm text-text/60">★ {manufacturer.rating.toFixed(1)}</p>
                      </div>
                      <p className="text-sm text-text/60">{manufacturer.location}</p>
                      <p className="text-xs text-text/50">
                        {manufacturer.verified ? "Verified manufacturer" : "Pending verification"}
                      </p>
                    </div>
                  ) : null
                )
              ) : (
                <p className="text-sm text-text/60">No manufacturer linked yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Server component wrapper
export default async function OutfitDetailPage({ params }: OutfitDetailPageProps) {
  const { id } = await params;
  const [outfit, manufacturers] = await Promise.all([getOutfit(id), getManufacturers()]);

  if (!outfit) notFound();

  return (
    <main>
      <Navbar />
      <OutfitGallery outfit={outfit} manufacturers={manufacturers} />
    </main>
  );
}
