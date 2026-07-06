"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getStoredToken, addToWishlist } from "@/lib/api";

function TryOnButton({ outfitId }: { outfitId: string }) {
  return (
    <Link
      href={`/try-on?outfitId=${outfitId}`}
      className="flex items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
    >
      ◎ Try On (AR)
    </Link>
  );
}

function WishlistButton({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleClick = async () => {
    if (!getStoredToken()) {
      router.push(`/login?redirect=/outfits/${outfitId}`);
      return;
    }
    setState("saving");
    try {
      await addToWishlist(outfitId);
      setState("saved");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  if (state === "saved") {
    return (
      <Link
        href="/wishlist"
        className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
      >
        ♥ Saved — View Wishlist
      </Link>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "saving"}
      className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5 disabled:opacity-50"
    >
      {state === "saving" ? "Saving…" : state === "error" ? "Try again" : "♡ Save to Wishlist"}
    </button>
  );
}

export function OutfitGallery({ outfit, manufacturers }: { outfit: any; manufacturers: any[] }) {
  const allImages =
    outfit.images && outfit.images.length > 0 ? outfit.images : [outfit.imageUrl];
  const [activeIdx, setActiveIdx] = useState(0);

  const linkedManufacturers = (outfit.manufacturerIds || [])
    .map((manufacturerId: string) => manufacturers.find((m) => m.id === manufacturerId))
    .filter(Boolean);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT — Myntra-style image gallery */}
        <div className="space-y-4">
          <Link
            href="/search"
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            ← Back to looks
          </Link>

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

          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {allImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`h-20 w-16 shrink-0 overflow-hidden rounded-[12px] border-2 transition-all ${
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

          {allImages.length > 1 && (
            <p className="text-center text-xs text-text/40">
              {activeIdx + 1} / {allImages.length} views
            </p>
          )}

          <div className="space-y-4 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">{outfit.occasion}</p>
                <h1 className="mt-2 font-serif text-4xl text-primary">{outfit.category}</h1>
                <p className="mt-1 text-sm text-text/60">{outfit.celebrityName}</p>
              </div>
              <p className="text-2xl font-medium text-primary">
                ₹{outfit.price.toLocaleString("en-IN")}
              </p>
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
          <WishlistButton outfitId={outfit.id} />
          <TryOnButton outfitId={outfit.id} />

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
                    <div
                      key={manufacturer.id}
                      className="rounded-2xl border border-black/6 px-4 py-3"
                    >
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
