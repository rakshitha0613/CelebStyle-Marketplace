import type { WishlistEntry, Outfit, OutfitItem, StorageAdapter } from './fit.types.js';

const WISHLIST_KEY      = 'celebstyle-wishlist';
const SAVED_OUTFITS_KEY = 'celebstyle-saved-outfits';
const CART_KEY          = 'celebstyle-cart';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Safe localStorage adapter — falls back to a no-op in SSR/test environments */
function defaultStorage(): StorageAdapter {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}

function parseJson<T>(json: string | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; } catch { return null; }
}

export class WishlistOverlayService {
  private readonly storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? defaultStorage();
  }

  // ── Wishlist ───────────────────────────────────────────────────────────────

  addToWishlist(outfit: Outfit, notes = ''): WishlistEntry {
    const entries = this.getWishlist();
    const existing = entries.findIndex((e) => e.outfit.id === outfit.id);
    const entry: WishlistEntry = { id: randomId(), outfit, addedAt: Date.now(), notes };
    if (existing >= 0) {
      entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    this.storage.setItem(WISHLIST_KEY, JSON.stringify(entries));
    return entry;
  }

  removeFromWishlist(entryId: string): void {
    const entries = this.getWishlist().filter((e) => e.id !== entryId);
    this.storage.setItem(WISHLIST_KEY, JSON.stringify(entries));
  }

  getWishlist(): WishlistEntry[] {
    return parseJson<WishlistEntry[]>(this.storage.getItem(WISHLIST_KEY)) ?? [];
  }

  isInWishlist(outfitId: string): boolean {
    return this.getWishlist().some((e) => e.outfit.id === outfitId);
  }

  clearWishlist(): void {
    this.storage.removeItem(WISHLIST_KEY);
  }

  // ── Saved outfits ──────────────────────────────────────────────────────────

  saveOutfit(outfit: Outfit): void {
    const saved = this.loadSavedOutfits();
    const idx   = saved.findIndex((o) => o.id === outfit.id);
    const updated = { ...outfit, updatedAt: Date.now() };
    if (idx >= 0) { saved[idx] = updated; } else { saved.push(updated); }
    this.storage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(saved));
  }

  loadSavedOutfits(): Outfit[] {
    return parseJson<Outfit[]>(this.storage.getItem(SAVED_OUTFITS_KEY)) ?? [];
  }

  deleteSavedOutfit(outfitId: string): void {
    const saved = this.loadSavedOutfits().filter((o) => o.id !== outfitId);
    this.storage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(saved));
  }

  // ── Cart integration ───────────────────────────────────────────────────────

  /**
   * Adds all outfit items to the localStorage cart (existing celebstyle-cart format).
   */
  addAllToCart(outfit: Outfit): void {
    const existing: object[] = parseJson<object[]>(this.storage.getItem(CART_KEY)) ?? [];

    for (const item of outfit.items) {
      const cartItem = {
        id:       `${item.garmentId}-${item.size}`,
        name:     item.garmentName,
        size:     item.size,
        price:    item.price ?? 999,
        quantity: 1,
        imageUrl: item.imageUrl,
        outfitId: outfit.id,
      };

      const existingIdx = (existing as Array<{ id: string; quantity: number }>)
        .findIndex((c) => c.id === cartItem.id);

      if (existingIdx >= 0) {
        (existing[existingIdx] as { quantity: number }).quantity += 1;
      } else {
        existing.push(cartItem);
      }
    }

    this.storage.setItem(CART_KEY, JSON.stringify(existing));
  }

  // ── Sharing ────────────────────────────────────────────────────────────────

  /**
   * Generates a shareable URL fragment with outfit data encoded as base64.
   * The actual share URL depends on the deployment origin.
   */
  generateShareableUrl(outfit: Outfit): string {
    const payload = JSON.stringify({ id: outfit.id, name: outfit.name, items: outfit.items.map((i) => i.garmentId) });
    const encoded = typeof btoa !== 'undefined' ? btoa(encodeURIComponent(payload)) : Buffer.from(payload).toString('base64');
    return `/try-on?outfit=${encoded}`;
  }

  /**
   * Generates a plain-text share message with garment names.
   */
  generateShareText(outfit: Outfit): string {
    const names = outfit.items.map((i) => i.garmentName).join(', ');
    return `Check out my CelebStyle outfit: ${outfit.name} featuring ${names}`;
  }

  getWishlistCount(): number  { return this.getWishlist().length; }
  getSavedCount(): number      { return this.loadSavedOutfits().length; }
}
