"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CART_KEY = "celebstyle-cart";

type CartItem = { outfitId: string; quantity?: number };

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(readCart().reduce((sum, item) => sum + (item.quantity ?? 1), 0));
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <Link
      href="/cart"
      className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-secondary"
    >
      Cart
      {count > 0 && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
      )}
    </Link>
  );
}
