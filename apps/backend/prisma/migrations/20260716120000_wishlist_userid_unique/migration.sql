-- Fixes the "Save to Wishlist" bug: Wishlist.userId had no uniqueness
-- constraint, so a race between two near-simultaneous "add to wishlist"
-- requests (getOrCreateWishlist doing a findFirst-then-create) could create
-- two Wishlist rows for the same user. Reads (GET /api/wishlist) use
-- findFirst with no explicit ordering, so which row comes back is
-- nondeterministic — items saved into the "other" row silently disappear
-- from the user's view.

-- 1. Merge WishlistItem rows from duplicate wishlists into the oldest
--    wishlist per user, skipping products already present there.
INSERT INTO "WishlistItem" ("id", "wishlistId", "productId", "variantId", "addedAt")
SELECT wi."id", keep."id", wi."productId", wi."variantId", wi."addedAt"
FROM "WishlistItem" wi
JOIN "Wishlist" dup ON dup."id" = wi."wishlistId"
JOIN (
  SELECT DISTINCT ON ("userId") "id", "userId"
  FROM "Wishlist"
  ORDER BY "userId", "createdAt" ASC, "id" ASC
) keep ON keep."userId" = dup."userId"
WHERE dup."id" <> keep."id"
  AND NOT EXISTS (
    SELECT 1 FROM "WishlistItem" existing
    WHERE existing."wishlistId" = keep."id" AND existing."productId" = wi."productId"
  );

-- 2. Drop the now-redundant duplicate wishlists (cascades their remaining items).
DELETE FROM "Wishlist" w
WHERE w."id" NOT IN (
  SELECT DISTINCT ON ("userId") "id"
  FROM "Wishlist"
  ORDER BY "userId", "createdAt" ASC, "id" ASC
);

-- 3. Enforce one wishlist per user going forward.
CREATE UNIQUE INDEX "Wishlist_userId_key" ON "Wishlist"("userId");
