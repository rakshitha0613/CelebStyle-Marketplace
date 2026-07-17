"use client";

import { useMemo, useState } from "react";
import type { Outfit } from "@/lib/api";

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
  quantity: number;
  manufacturerIds: string[];
};

type Props = {
  outfit: Outfit;
};

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function AddToCartButton({ outfit }: Props) {
  const [selectedSize, setSelectedSize] = useState("M");
  const [message, setMessage] = useState("");

  const sizes = useMemo(() => ["XS", "S", "M", "L", "XL", "XXL"], []);

  const handleAdd = () => {
    if (typeof window === "undefined") return;
    const cart = readCart();
    const exists = cart.find((item) => item.outfitId === outfit.id && item.size === selectedSize);
    if (exists) {
      exists.quantity = (exists.quantity ?? 1) + 1;
      setMessage(`Quantity updated (${exists.quantity}) ✓`);
    } else {
      cart.push({
        outfitId: outfit.id,
        outfitName: outfit.movieName,
        celebrityId: outfit.celebrityId,
        celebrityName: outfit.celebrityName,
        price: outfit.price,
        imageUrl: outfit.imageUrl,
        category: outfit.category,
        size: selectedSize,
        quantity: 1,
        manufacturerIds: outfit.manufacturerIds ?? [],
      });
      setMessage("Added to cart ✓");
    }
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    setTimeout(() => setMessage(""), 2000);
  };

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.28em] text-accent">Order Ready</p>
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Select Size</label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setSelectedSize(size)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${selectedSize === size ? "border-accent bg-accent text-white" : "border-black/10 bg-white text-primary hover:bg-secondary"}`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90"
      >
        Add to Cart
      </button>
      <p className="mt-3 min-h-5 text-sm text-text/60">{message}</p>
    </div>
  );
}
