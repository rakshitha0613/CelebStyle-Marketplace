'use client';

import type { WishlistEntry, Outfit } from '@/lib/ar/fit.types';

interface Props {
  wishlist: WishlistEntry[];
  savedOutfits: Outfit[];
  wishlistCount: number;
  onRemoveFromWishlist: (entryId: string) => void;
  onDeleteSavedOutfit: (outfitId: string) => void;
  onAddAllToCart: (outfit: Outfit) => void;
  onShare: (outfit: Outfit) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function OutfitCard({
  outfit,
  subtitle,
  onDelete,
  onAddToCart,
  onShare,
}: {
  outfit: Outfit;
  subtitle: string;
  onDelete: () => void;
  onAddToCart: () => void;
  onShare: () => void;
}) {
  const itemCount = outfit.items.length;
  const totalPrice = outfit.items.reduce((sum, i) => sum + (i.price ?? 999), 0);

  return (
    <article className="bg-white/5 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm text-white font-medium truncate">{outfit.name}</h4>
          <p className="text-xs text-white/40">{subtitle}</p>
        </div>
        <button
          onClick={onDelete}
          className="text-white/20 hover:text-red-400 transition-colors text-xs flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
          aria-label={`Remove ${outfit.name}`}
        >
          ✕
        </button>
      </div>

      {/* Item pills */}
      <div className="flex flex-wrap gap-1" aria-label={`${itemCount} items`}>
        {outfit.items.map((item) => (
          <span
            key={item.garmentId}
            className="text-[10px] text-white/50 bg-white/5 rounded-full px-2 py-0.5 truncate max-w-[100px]"
            title={item.garmentName}
          >
            {item.garmentName}
          </span>
        ))}
      </div>

      {/* Price + actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60 tabular-nums">
          ₹{totalPrice.toLocaleString('en-IN')}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={onShare}
            className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={`Share ${outfit.name}`}
          >
            Share
          </button>
          <button
            onClick={onAddToCart}
            className="text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={`Add all items from ${outfit.name} to cart`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}

export function WishlistPanel({
  wishlist,
  savedOutfits,
  wishlistCount,
  onRemoveFromWishlist,
  onDeleteSavedOutfit,
  onAddAllToCart,
  onShare,
  isCollapsed = false,
  onToggleCollapse,
}: Props) {
  const totalCount = wishlist.length + savedOutfits.length;

  return (
    <section
      className="bg-white/5 rounded-2xl overflow-hidden"
      aria-labelledby="wishlist-heading"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-expanded={!isCollapsed}
        aria-controls="wishlist-body"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <h3
            id="wishlist-heading"
            className="text-sm font-semibold text-white/80 tracking-wide uppercase"
          >
            Wishlist &amp; Saved
          </h3>
          {totalCount > 0 && (
            <span className="text-xs bg-white/10 text-white/60 rounded-full px-1.5 py-0.5 tabular-nums">
              {totalCount}
            </span>
          )}
        </div>
        <span
          className={`text-white/40 text-xs transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          aria-hidden="true"
        >
          ▲
        </span>
      </button>

      {/* Body */}
      {!isCollapsed && (
        <div id="wishlist-body" className="px-4 pb-4 space-y-4">
          {/* Wishlist section */}
          {wishlist.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wide">Wishlist</p>
              {wishlist.map((entry) => (
                <OutfitCard
                  key={entry.id}
                  outfit={entry.outfit}
                  subtitle={`Added ${formatDate(entry.addedAt)}${entry.notes ? ` · ${entry.notes}` : ''}`}
                  onDelete={() => onRemoveFromWishlist(entry.id)}
                  onAddToCart={() => onAddAllToCart(entry.outfit)}
                  onShare={() => onShare(entry.outfit)}
                />
              ))}
            </div>
          )}

          {/* Saved outfits section */}
          {savedOutfits.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wide">Saved Outfits</p>
              {savedOutfits.map((outfit) => (
                <OutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  subtitle={`Saved ${formatDate(outfit.createdAt)}`}
                  onDelete={() => onDeleteSavedOutfit(outfit.id)}
                  onAddToCart={() => onAddAllToCart(outfit)}
                  onShare={() => onShare(outfit)}
                />
              ))}
            </div>
          )}

          {totalCount === 0 && (
            <p className="text-xs text-white/30 text-center py-2">
              No saved outfits yet. Build and save an outfit to see it here.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
