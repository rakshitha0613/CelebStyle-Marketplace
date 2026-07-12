"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getStoredToken, addToWishlist } from "@/lib/api";
import { LocalImage } from "@/components/local-image";

// ── Recently-Viewed tracking ──────────────────────────────────────────────────
const RV_KEY = "celebstyle-recently-viewed";
const RV_MAX = 10;

function trackView(outfit: { id: string; imageUrl: string; category: string; price: number; celebrityName: string }) {
  try {
    const raw = localStorage.getItem(RV_KEY);
    const list: typeof outfit[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((o) => o.id !== outfit.id);
    filtered.unshift(outfit);
    localStorage.setItem(RV_KEY, JSON.stringify(filtered.slice(0, RV_MAX)));
  } catch {}
}

// ── Image Zoom Lightbox ──────────────────────────────────────────────────────
function ZoomLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close zoom"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Share Button ──────────────────────────────────────────────────────────────
function ShareButton({ outfit }: { outfit: { category: string; celebrityName: string; id: string } }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/outfits/${outfit.id}`;
    const text = `Check out ${outfit.celebrityName}'s ${outfit.category} on CelebStyle`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: text, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleShare}
      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
    >
      {copied ? "✓ Link Copied!" : "↗ Share"}
    </button>
  );
}

// ── Wishlist Button ───────────────────────────────────────────────────────────
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
        className="flex items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
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

// ── Rating Stars ──────────────────────────────────────────────────────────────
function RatingStars({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`text-base ${i < full ? "text-yellow-400" : i === full && half ? "text-yellow-300" : "text-gray-200"}`}>
            ★
          </span>
        ))}
      </div>
      <span className="text-sm text-text/60">
        {rating.toFixed(1)} ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}

// ── Main Gallery Component ───────────────────────────────────────────────────
export function OutfitGallery({
  outfit,
  manufacturers,
  avgRating,
  reviewCount,
}: {
  outfit: any;
  manufacturers: any[];
  avgRating?: number;
  reviewCount?: number;
}) {
  const allImages =
    outfit.images && outfit.images.length > 0 ? outfit.images : [outfit.imageUrl];
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    trackView({
      id: outfit.id,
      imageUrl: outfit.imageUrl,
      category: outfit.category,
      price: outfit.price,
      celebrityName: outfit.celebrityName,
    });
  }, [outfit.id]);

  const linkedManufacturers = (outfit.manufacturerIds || [])
    .map((mid: string) => manufacturers.find((m) => m.id === mid))
    .filter(Boolean);

  const handlePrev = useCallback(() => setActiveIdx((i) => (i - 1 + allImages.length) % allImages.length), [allImages.length]);
  const handleNext = useCallback(() => setActiveIdx((i) => (i + 1) % allImages.length), [allImages.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (zoom) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePrev, handleNext, zoom]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {zoom && (
        <ZoomLightbox
          src={allImages[activeIdx]}
          alt={`${outfit.celebrityName} ${outfit.category}`}
          onClose={() => setZoom(false)}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT — image gallery */}
        <div className="space-y-4">
          <Link href="/search" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            ← Back to looks
          </Link>

          <div className="relative overflow-hidden rounded-[32px] border border-black/6 bg-white shadow-sm">
            <div className="aspect-[4/5] cursor-zoom-in" onClick={() => setZoom(true)}>
              <LocalImage
                src={allImages[activeIdx]}
                alt={`${outfit.celebrityName} ${outfit.category} - view ${activeIdx + 1}`}
                className="h-full w-full object-cover transition-all duration-300"
              />
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80">
              🔍 Click to zoom
            </div>
            {allImages.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-primary shadow transition hover:bg-white"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-primary shadow transition hover:bg-white"
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
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
                  <LocalImage
                    src={img}
                    alt={`Angle ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {allImages.length > 1 && (
            <p className="text-center text-xs text-text/40">
              {activeIdx + 1} / {allImages.length} views · use ← → to navigate
            </p>
          )}

          <div className="space-y-4 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">{outfit.occasion}</p>
                <h1 className="mt-2 font-serif text-4xl text-primary">{outfit.category}</h1>
                <p className="mt-1 text-sm text-text/60">{outfit.celebrityName}</p>
                {avgRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
                  <div className="mt-2">
                    <RatingStars rating={avgRating} count={reviewCount} />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-medium text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs text-green-600">✓ In stock · Free shipping ≥ ₹25,000</p>
              </div>
            </div>
            <p className="text-base leading-7 text-text/75">{outfit.description}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-secondary px-4 py-2 text-primary">🎬 {outfit.movieName}</span>
              {outfit.characterName && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">🎭 {outfit.characterName}</span>
              )}
              {outfit.year && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">📅 {outfit.year}</span>
              )}
              {outfit.colorPalette && (
                <span className="rounded-full bg-secondary px-4 py-2 text-primary">🎨 {outfit.colorPalette}</span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — purchase panel */}
        <div className="space-y-4">
          <AddToCartButton outfit={outfit} />
          <WishlistButton outfitId={outfit.id} />

          <div className="flex gap-3">
            <Link
              href={`/try-on?outfitId=${outfit.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
            >
              ◎ Try On (AR)
            </Link>
            <ShareButton outfit={outfit} />
          </div>

          <Link
            href={`/customizations/new?outfitId=${outfit.id}&outfitName=${encodeURIComponent(outfit.category)}`}
            className="flex items-center justify-center gap-2 rounded-full border border-accent/10 bg-accent/5 px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            ✂ Customise This Outfit
          </Link>

          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Delivery & Fit</p>
            <div className="mt-4 space-y-3 text-sm text-text/70">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Estimated dispatch: 7–10 working days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Premium replica fabric — catalogue-matched</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Sizes: XS · S · M · L · XL · XXL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>Free shipping on orders ≥ ₹25,000</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>7-day hassle-free returns</span>
              </div>
            </div>
          </div>

          {linkedManufacturers.length > 0 && (
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Verified Manufacturers</p>
              <div className="mt-4 space-y-3">
                {linkedManufacturers.map((manufacturer: any) =>
                  manufacturer ? (
                    <div key={manufacturer.id} className="rounded-2xl border border-black/6 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">{manufacturer.name}</p>
                        <p className="text-sm text-yellow-500">★ {manufacturer.rating?.toFixed(1) ?? "—"}</p>
                      </div>
                      <p className="text-sm text-text/60">{manufacturer.location}</p>
                      <p className="text-xs text-text/50">
                        {manufacturer.verified ? "✓ Verified manufacturer" : "Pending verification"}
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-accent/15 bg-accent/5 p-5">
            <p className="text-sm font-medium text-accent">Why CelebStyle?</p>
            <ul className="mt-3 space-y-1.5 text-xs text-text/70">
              <li>✓ Celebrity-authentic designs, not replicas</li>
              <li>✓ Virtual AR Try-On before you buy</li>
              <li>✓ AI-powered size recommendations</li>
              <li>✓ Partnered with verified Indian manufacturers</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
