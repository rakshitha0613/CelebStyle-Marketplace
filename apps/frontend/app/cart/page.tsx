"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { LocalImage } from "@/components/local-image";

type CartItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  price: number;
  imageUrl: string;
  category: string;
  size: string;
  quantity?: number;
  manufacturerIds: string[];
};

const CART_KEY = "celebstyle-cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + (item.quantity ?? 1), 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0), [items]);
  const shipping = subtotal > 0 && subtotal >= 25000 ? 0 : 499;
  const total = subtotal + (subtotal > 0 ? shipping : 0);

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("storage"));
  };

  const updateQuantity = (index: number, delta: number) => {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const nextQty = (item.quantity ?? 1) + delta;
      return { ...item, quantity: Math.max(1, nextQty) };
    });
    setItems(next);
    window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("storage"));
  };

  const clearCart = () => {
    setItems([]);
    window.localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Cart</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">Your selected looks</h1>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-sm font-medium text-red-600 underline-offset-4 hover:underline">
              Clear cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
            <p className="font-serif text-2xl text-primary">Your cart is empty</p>
            <p className="mt-2 text-sm text-text/60">Browse looks and add one to continue toward checkout.</p>
            <Link href="/search" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90">
              Browse looks
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={`${item.outfitId}-${item.size}-${index}`} className="flex gap-4 rounded-[24px] border border-black/6 bg-white p-4 shadow-sm">
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-2xl">
                    <LocalImage
                      src={item.imageUrl}
                      alt={item.outfitName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-accent">{item.category}</p>
                        <h2 className="mt-2 font-serif text-2xl text-primary">{item.outfitName}</h2>
                        <p className="text-sm text-text/60">{item.celebrityName}</p>
                        <p className="mt-2 text-sm text-text/60">Size: {item.size}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-primary">₹{(item.price * (item.quantity ?? 1)).toLocaleString("en-IN")}</p>
                        <p className="text-xs text-text/40">₹{item.price.toLocaleString("en-IN")} each</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, -1)}
                          disabled={(item.quantity ?? 1) <= 1}
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-primary transition hover:bg-secondary disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium text-primary">{item.quantity ?? 1}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(index, 1)}
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-primary transition hover:bg-secondary"
                        >
                          +
                        </button>
                      </div>
                      <button onClick={() => removeItem(index)} className="text-sm font-medium text-red-600 underline-offset-4 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Order Summary</p>
              <div className="mt-4 space-y-3 text-sm text-text/70">
                <div className="flex justify-between">
                  <span>Items</span>
                  <span>{totalQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? "Free (order ≥ ₹25,000)" : `₹${shipping.toLocaleString("en-IN")}`}</span>
                </div>
                <div className="flex justify-between border-t border-black/6 pt-3 text-base font-medium text-primary">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <Link href="/checkout" className="mt-6 block w-full rounded-full bg-primary py-3 text-center text-sm font-medium text-background transition hover:opacity-90">
                Proceed to Checkout
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
