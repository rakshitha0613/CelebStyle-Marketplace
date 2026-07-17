import Link from "next/link";
import { BrandMark } from "@/components/logo";

const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/celebrities", label: "Celebrities" },
      { href: "/collections", label: "Collections" },
      { href: "/search", label: "Search" },
      { href: "/trending", label: "Trending" },
    ],
  },
  {
    title: "Experience",
    links: [
      { href: "/try-on", label: "Virtual Try-On" },
      { href: "/ai-stylist", label: "AI Stylist" },
      { href: "/community", label: "Community" },
      { href: "/wardrobe", label: "Wardrobe" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/wishlist", label: "Wishlist" },
      { href: "/cart", label: "Cart" },
      { href: "/orders", label: "Orders" },
      { href: "/login", label: "Sign In" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-black/6 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="CelebStyle — Home">
              <BrandMark />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-text/60">
              Celebrity fashion replica marketplace — wear what your icon wears.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-text/40">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-text/70 transition hover:text-accent">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-black/6 pt-6 text-xs text-text/40">
          © {new Date().getFullYear()} CelebStyle. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
