import Link from "next/link";
import { CartBadge } from "@/components/cart-badge";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif text-2xl tracking-[0.22em] text-primary uppercase">
          CelebStyle
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-text md:flex">
          <Link href="/celebrities">Celebrities</Link>
          <Link href="/search">Search</Link>
          <Link href="/storefronts">Storefronts</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/admin">Admin CMS</Link>
        </nav>
        <div className="flex items-center gap-3">
          <CartBadge />
          <Link
            href="/search"
            className="rounded-full border border-gold/40 bg-primary px-5 py-2 text-sm font-medium text-background shadow-luxe transition hover:scale-[1.02]"
          >
            Explore Looks
          </Link>
        </div>
      </div>
    </header>
  );
}