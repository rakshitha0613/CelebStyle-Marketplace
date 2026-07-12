"use client";

import Link from "next/link";
import { useState } from "react";
import { CartBadge } from "@/components/cart-badge";
import { NavAuth } from "@/components/nav-auth";

const NAV_LINKS = [
  { href: "/",           label: "Home" },
  { href: "/celebrities",label: "Celebrities" },
  { href: "/search",     label: "Search" },
  { href: "/trending",   label: "Trending" },
  { href: "/try-on",     label: "Try-On",    accent: true, icon: "◎" },
  { href: "/ai-stylist", label: "AI Stylist", accent: true, icon: "✨" },
  { href: "/wardrobe",   label: "Wardrobe" },
  { href: "/community",  label: "Community" },
  { href: "/blog",       label: "Blog" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif text-2xl tracking-[0.22em] text-primary uppercase">
          CelebStyle
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 text-sm font-medium text-text lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 transition hover:text-accent ${link.accent ? "text-accent" : ""}`}
            >
              {link.icon && <span className="text-xs">{link.icon}</span>}
              {link.label}
            </Link>
          ))}
          <NavAuth />
        </nav>

        <div className="flex items-center gap-3">
          <CartBadge />
          <Link
            href="/search"
            className="hidden rounded-full border border-gold/40 bg-primary px-5 py-2 text-sm font-medium text-background shadow-luxe transition hover:scale-[1.02] sm:block"
          >
            Explore Looks
          </Link>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-primary transition hover:bg-black/5 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-black/5 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="grid gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-secondary ${link.accent ? "text-accent" : "text-text"}`}
                >
                  {link.icon && <span>{link.icon}</span>}
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-black/6 pt-3">
                <NavAuth />
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
