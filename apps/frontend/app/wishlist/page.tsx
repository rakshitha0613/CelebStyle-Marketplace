"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getStoredToken,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
  getWishlistPrivacy,
  setWishlistPrivacy,
} from "@/lib/api";
import type { WishlistItem } from "@/lib/api";

const CART_KEY = "celebstyle-cart";

type CartItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  price: number;
  imageUrl: string;
  category: string;
  size: string;
  manufacturerIds: string[];
};

function addToLocalCart(item: WishlistItem): void {
  const raw = window.localStorage.getItem(CART_KEY);
  const cart: CartItem[] = raw ? (JSON.parse(raw) as CartItem[]) : [];
  const exists = cart.some((c) => c.outfitId === item.productSlug);
  if (!exists) {
    cart.push({
      outfitId: item.productSlug,
      outfitName: item.productName,
      celebrityId: item.celebrityId,
      celebrityName: item.celebrityName,
      price: item.price,
      imageUrl: item.imageUrl,
      category: item.category,
      size: "M",
      manufacturerIds: item.manufacturerIds,
    });
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
  }
}

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [movedIds, setMovedIds] = useState<Set<string>>(new Set());
  const [isPublic, setIsPublic] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await getWishlist();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/wishlist");
      return;
    }
    load();
    getWishlistPrivacy().then((p) => setIsPublic(p.isPublic));
  }, [router, load]);

  const handleTogglePrivacy = async () => {
    setPrivacyLoading(true);
    try {
      const result = await setWishlistPrivacy(!isPublic);
      setIsPublic(result.isPublic);
    } catch { /* ignore */ }
    finally { setPrivacyLoading(false); }
  };

  const handleRemove = async (itemId: string) => {
    setRemovingId(itemId);
    try {
      await removeFromWishlist(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove item.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveToCart = async (item: WishlistItem) => {
    addToLocalCart(item);
    setMovedIds((prev) => new Set(prev).add(item.id));

    // Remove from wishlist after moving to cart
    try {
      await removeFromWishlist(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      // Moved to cart even if wishlist removal failed — don't alert
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Remove all items from your wishlist?")) return;
    setClearing(true);
    try {
      await clearWishlist();
      setItems([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clear wishlist.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Saved</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">Wishlist</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Privacy toggle */}
            <button
              onClick={handleTogglePrivacy}
              disabled={privacyLoading}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${isPublic ? "border-green-200 bg-green-50 text-green-700" : "border-black/10 bg-black/[0.02] text-text/60"} disabled:opacity-50`}
              title={isPublic ? "Wishlist is public — click to make private" : "Wishlist is private — click to make public"}
            >
              <span>{isPublic ? "🔓 Public" : "🔒 Private"}</span>
            </button>
            {items.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-sm font-medium text-red-500 underline-offset-4 hover:underline disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear all"}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
            <p className="font-serif text-2xl text-primary">Your wishlist is empty</p>
            <p className="mt-3 text-sm text-text/60">
              Save outfits you love and come back for them later.
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              Browse Looks
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden"
              >
                {/* Image */}
                <Link href={`/outfits/${item.productSlug}`} className="block">
                  <div className="aspect-[3/4] bg-secondary">
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-full w-full object-cover transition hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/300x400?text=No+Image";
                      }}
                    />
                  </div>
                </Link>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs text-accent">{item.category}</p>
                  <Link
                    href={`/outfits/${item.productSlug}`}
                    className="mt-1 font-medium text-primary line-clamp-2 hover:underline underline-offset-4"
                  >
                    {item.productName}
                  </Link>
                  <Link
                    href={`/celebrities/${item.celebrityId}`}
                    className="text-sm text-text/60 hover:underline underline-offset-4"
                  >
                    {item.celebrityName}
                  </Link>
                  <p className="mt-2 font-medium text-primary">
                    ₹{item.price.toLocaleString("en-IN")}
                  </p>
                  {!item.isAvailable && (
                    <p className="mt-1 text-xs text-red-500">Currently unavailable</p>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-2 mt-auto pt-3 border-t border-black/5">
                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={!item.isAvailable || movedIds.has(item.id)}
                      className="w-full rounded-full bg-primary py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
                    >
                      {movedIds.has(item.id) ? "Moved to Cart ✓" : "Move to Cart"}
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                      className="w-full rounded-full border border-black/10 py-2 text-sm font-medium text-text/70 transition hover:bg-black/5 disabled:opacity-50"
                    >
                      {removingId === item.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
