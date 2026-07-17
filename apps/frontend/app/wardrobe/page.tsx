"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getWishlist, getStoredToken, removeFromWishlist, isUnauthorizedError } from "@/lib/api";
import type { WishlistItem } from "@/lib/api";
import { LocalImage } from "@/components/local-image";

// ── localStorage keys ─────────────────────────────────────────────────────────
const RV_KEY      = "celebstyle-recently-viewed";
const TRYON_KEY   = "celebstyle-tryon-history";

type RecentlyViewedItem = {
  id: string;
  imageUrl: string;
  category: string;
  price: number;
  celebrityName: string;
};

type TryOnHistoryItem = {
  id: string;
  outfitId: string;
  outfitName: string;
  outfitImage: string;
  tryOnImage: string;
  timestamp: number;
};

// ── Tab ──────────────────────────────────────────────────────────────────────
type Tab = "recently-viewed" | "wishlist" | "tryon-history";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "recently-viewed", label: "Recently Viewed",  icon: "👁" },
  { id: "wishlist",        label: "Wishlist",         icon: "♥" },
  { id: "tryon-history",  label: "Try-On History",   icon: "◎" },
];

// ── Mini outfit card ─────────────────────────────────────────────────────────
function MiniOutfitCard({ id, imageUrl, category, price, celebrityName }: RecentlyViewedItem) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm">
      <Link href={`/outfits/${id}`}>
        <div className="aspect-[3/4] overflow-hidden">
          <LocalImage
            src={imageUrl}
            alt={category}
            className="h-full w-full object-cover transition duration-300 hover:scale-105"
          />
        </div>
      </Link>
      <div className="p-4">
        <p className="truncate text-sm font-medium text-primary">{category}</p>
        <p className="truncate text-xs text-text/50">{celebrityName}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-primary">₹{price.toLocaleString("en-IN")}</p>
          <div className="flex gap-1.5">
            <Link
              href={`/try-on?outfitId=${id}`}
              className="rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-background transition hover:opacity-80"
            >
              Try On
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TryOn History Card ─────────────────────────────────────────────────────
function TryOnCard({ item, onDelete }: { item: TryOnHistoryItem; onDelete: (id: string) => void }) {
  const [showCompare, setShowCompare] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = item.tryOnImage;
    a.download = `tryon-${item.outfitName}-${item.id}.png`;
    a.click();
  };

  return (
    <div className="overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm">
      {showCompare ? (
        <div className="relative aspect-[3/4] overflow-hidden bg-black select-none">
          {/* Before (original) */}
          <img
            src={item.outfitImage}
            alt="Original outfit"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* After (try-on) — clipped right side */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src={item.tryOnImage}
              alt="Try-on result"
              className="h-full w-full object-cover"
            />
          </div>
          {/* Slider handle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize"
            style={{ left: `${sliderPos}%` }}
            onMouseDown={(e) => {
              const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const move = (ev: MouseEvent) => setSliderPos(Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100)));
              const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
              document.addEventListener("mousemove", move);
              document.addEventListener("mouseup", up);
            }}
            onTouchMove={(e) => {
              const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              setSliderPos(Math.max(5, Math.min(95, ((e.touches[0].clientX - rect.left) / rect.width) * 100)));
            }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center text-xs font-bold text-primary select-none">
              ↔
            </div>
          </div>
          {/* Labels */}
          <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">Before</div>
          <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">After</div>
        </div>
      ) : (
        <div className="aspect-[3/4] overflow-hidden">
          <LocalImage
            src={item.tryOnImage}
            alt={`Try-on: ${item.outfitName}`}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <p className="truncate text-sm font-medium text-primary">{item.outfitName}</p>
          <p className="text-xs text-text/40">{new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCompare((v) => !v)}
            className="flex-1 rounded-full border border-black/10 py-1.5 text-xs font-medium text-primary transition hover:bg-black/5"
          >
            {showCompare ? "◎ Result" : "⟺ Compare"}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 rounded-full bg-primary py-1.5 text-xs font-medium text-background transition hover:opacity-80"
          >
            ↓ Save
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const [activeTab, setActiveTab] = useState<Tab>("recently-viewed");
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [tryOnHistory, setTryOnHistory] = useState<TryOnHistoryItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [removingWishlistId, setRemovingWishlistId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Load recently viewed from localStorage
    try {
      const raw = localStorage.getItem(RV_KEY);
      if (raw) setRecentlyViewed(JSON.parse(raw));
    } catch {}

    // Load try-on history from localStorage
    try {
      const raw = localStorage.getItem(TRYON_KEY);
      if (raw) setTryOnHistory(JSON.parse(raw));
    } catch {}

    // Load wishlist if logged in
    const token = getStoredToken();
    setIsLoggedIn(!!token);
    if (token) {
      setWishlistLoading(true);
      getWishlist()
        .then(setWishlist)
        .catch((err) => {
          // A stale/expired session (e.g. after a server-side reset) should
          // fall back to the existing "sign in to see your wishlist" state
          // rather than silently rendering as an empty wishlist.
          if (isUnauthorizedError(err)) setIsLoggedIn(false);
        })
        .finally(() => setWishlistLoading(false));
    }
  }, []);

  const deleteTryOn = (id: string) => {
    const updated = tryOnHistory.filter((h) => h.id !== id);
    setTryOnHistory(updated);
    try { localStorage.setItem(TRYON_KEY, JSON.stringify(updated)); } catch {}
  };

  const clearRecentlyViewed = () => {
    setRecentlyViewed([]);
    try { localStorage.removeItem(RV_KEY); } catch {}
  };

  const handleRemoveWishlistItem = async (itemId: string) => {
    setRemovingWishlistId(itemId);
    try {
      await removeFromWishlist(itemId);
      setWishlist((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      if (isUnauthorizedError(err)) setIsLoggedIn(false);
      /* otherwise leave item in place on failure */
    } finally {
      setRemovingWishlistId(null);
    }
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.36em] text-accent">Your Personal Space</p>
          <h1 className="mt-3 font-serif text-5xl text-primary">My Wardrobe</h1>
          <p className="mt-2 text-base text-text/60">Browse your saved outfits, wishlist, and virtual try-on history.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-black/8 pb-0 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-b-2 border-primary bg-white text-primary shadow-sm"
                  : "text-text/50 hover:text-primary"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === "recently-viewed" && recentlyViewed.length > 0 && (
                <span className="ml-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{recentlyViewed.length}</span>
              )}
              {tab.id === "wishlist" && wishlist.length > 0 && (
                <span className="ml-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{wishlist.length}</span>
              )}
              {tab.id === "tryon-history" && tryOnHistory.length > 0 && (
                <span className="ml-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{tryOnHistory.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Recently Viewed */}
        {activeTab === "recently-viewed" && (
          <div>
            {recentlyViewed.length === 0 ? (
              <EmptyState
                image="/assets/banners/home-hero.webp"
                title="No recently viewed outfits"
                message="Browse outfits and they will automatically appear here."
                cta={{ label: "Browse Looks", href: "/search" }}
              />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-text/50">{recentlyViewed.length} outfit{recentlyViewed.length !== 1 ? "s" : ""} viewed</p>
                  <button onClick={clearRecentlyViewed} className="text-xs text-text/40 underline underline-offset-4 hover:text-accent transition">
                    Clear history
                  </button>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {recentlyViewed.map((item) => (
                    <MiniOutfitCard key={item.id} {...item} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Wishlist */}
        {activeTab === "wishlist" && (
          <div>
            {!isLoggedIn ? (
              <EmptyState
                image="/assets/banners/red-carpet-banner.webp"
                title="Sign in to see your wishlist"
                message="Save outfits while browsing and find them here."
                cta={{ label: "Sign In", href: "/login?redirect=/wardrobe" }}
              />
            ) : wishlistLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
              </div>
            ) : wishlist.length === 0 ? (
              <EmptyState
                image="/assets/banners/red-carpet-banner.webp"
                title="Your wishlist is empty"
                message='Press "Save to Wishlist" on any outfit to add it here.'
                cta={{ label: "Discover Outfits", href: "/search" }}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {wishlist.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-[20px] border border-black/6 bg-white shadow-sm">
                    <Link href={`/outfits/${item.productSlug}`}>
                      <div className="aspect-[3/4] overflow-hidden transition hover:opacity-90">
                        <LocalImage
                          src={item.imageUrl}
                          alt={item.productName || item.category}
                          className="h-full w-full object-cover transition duration-300 hover:scale-105"
                        />
                      </div>
                    </Link>
                    <div className="p-4">
                      <p className="truncate text-sm font-medium text-primary">{item.productName || item.category}</p>
                      <p className="truncate text-xs text-text/50">{item.celebrityName}</p>
                      <p className="mt-1 text-sm font-semibold text-primary">₹{item.price.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-text/40">{new Date(item.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      <div className="mt-2 flex gap-2">
                        <Link
                          href={`/outfits/${item.productSlug}`}
                          className="flex-1 flex items-center justify-center rounded-full bg-primary py-1.5 text-xs font-medium text-background transition hover:opacity-80"
                        >
                          View →
                        </Link>
                        <Link
                          href={`/try-on?outfitId=${item.productSlug}`}
                          className="flex-1 flex items-center justify-center rounded-full border border-black/10 py-1.5 text-xs font-medium text-primary transition hover:bg-black/5"
                        >
                          Try On
                        </Link>
                      </div>
                      <button
                        onClick={() => handleRemoveWishlistItem(item.id)}
                        disabled={removingWishlistId === item.id}
                        className="mt-2 w-full rounded-full border border-black/10 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {removingWishlistId === item.id ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Try-On History */}
        {activeTab === "tryon-history" && (
          <div>
            {tryOnHistory.length === 0 ? (
              <EmptyState
                image="/assets/banners/luxury-banner.webp"
                title="No try-on history yet"
                message="When you try on outfits, your results will be saved here automatically."
                cta={{ label: "Try On Now", href: "/try-on" }}
              />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-text/50">{tryOnHistory.length} try-on{tryOnHistory.length !== 1 ? "s" : ""} saved</p>
                  <p className="text-xs text-text/40">Drag the slider on each card to compare before/after</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {tryOnHistory.map((item) => (
                    <TryOnCard key={item.id} item={item} onDelete={deleteTryOn} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({
  image,
  title,
  message,
  cta,
}: {
  image: string;
  title: string;
  message: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 h-40 w-40 overflow-hidden rounded-[24px]">
        <LocalImage src={image} alt="" className="h-full w-full object-cover" />
      </div>
      <p className="font-serif text-2xl text-primary">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-text/50">{message}</p>
      <Link
        href={cta.href}
        className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
      >
        {cta.label}
      </Link>
    </div>
  );
}
