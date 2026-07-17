import { prisma } from "../lib/prisma.js";
import {
  CommerceNotFoundError,
  CommerceForbiddenError,
} from "../lib/commerce.errors.js";

export type WishlistItemDto = {
  id: string;
  productSlug: string;
  productName: string;
  category: string;
  price: number;
  imageUrl: string;
  celebrityId: string;
  celebrityName: string;
  manufacturerIds: string[];
  isAvailable: boolean;
  addedAt: string;
};

type ProductRow = {
  slug: string;
  movieName: string;
  category: string;
  basePrice: number;
  imageUrl: string;
  isActive: boolean;
  isPublished: boolean;
  deletedAt: Date | null;
  celebrity: { slug: string; name: string };
  manufacturerLinks: Array<{ manufacturer: { slug: string } }>;
};

type ItemRow = {
  id: string;
  addedAt: Date;
  product: ProductRow;
};

function toDto(item: ItemRow): WishlistItemDto {
  return {
    id: item.id,
    productSlug: item.product.slug,
    productName: item.product.movieName,
    category: item.product.category,
    price: item.product.basePrice,
    imageUrl: item.product.imageUrl,
    celebrityId: item.product.celebrity.slug,
    celebrityName: item.product.celebrity.name,
    manufacturerIds: item.product.manufacturerLinks.map((l) => l.manufacturer.slug),
    isAvailable:
      item.product.isActive &&
      item.product.isPublished &&
      item.product.deletedAt === null,
    addedAt: item.addedAt.toISOString(),
  };
}

const ITEM_SELECT = {
  id: true,
  addedAt: true,
  product: {
    select: {
      slug: true,
      movieName: true,
      category: true,
      basePrice: true,
      imageUrl: true,
      isActive: true,
      isPublished: true,
      deletedAt: true,
      celebrity: { select: { slug: true, name: true } },
      manufacturerLinks: {
        select: { manufacturer: { select: { slug: true } } },
        orderBy: { priority: "asc" as const },
      },
    },
  },
};

async function getOrCreateWishlist(userId: string): Promise<{ id: string }> {
  // Atomic upsert on the unique userId — avoids the find-then-create race
  // that used to let two concurrent "add to wishlist" requests create two
  // Wishlist rows for the same user (see migration 20260716120000).
  try {
    return await prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
  } catch {
    // Falls back to the pre-fix lookup on environments where migration
    // 20260716120000 (adds the unique index) hasn't been applied to the
    // running database yet — upsert's ON CONFLICT target requires the
    // constraint to exist. Safe to remove once every environment is migrated.
    const existing = await prisma.wishlist.findFirst({ where: { userId }, select: { id: true } });
    if (existing) return existing;
    return prisma.wishlist.create({ data: { userId }, select: { id: true } });
  }
}

export const wishlistService = {
  async getItems(userId: string): Promise<WishlistItemDto[]> {
    const wishlist = await prisma.wishlist.findFirst({
      where: { userId },
      select: {
        items: {
          select: ITEM_SELECT,
          orderBy: { addedAt: "desc" },
        },
      },
    });
    if (!wishlist) return [];
    return (wishlist.items as unknown as ItemRow[]).map(toDto);
  },

  async addItem(userId: string, productSlug: string): Promise<WishlistItemDto> {
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!product || !product.isActive || product.deletedAt !== null)
      throw new CommerceNotFoundError("Product not found");

    const wishlist = await getOrCreateWishlist(userId);

    const item = await prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId: { wishlistId: wishlist.id, productId: product.id },
      },
      create: { wishlistId: wishlist.id, productId: product.id },
      update: {},
      select: ITEM_SELECT,
    });

    return toDto(item as unknown as ItemRow);
  },

  async removeItem(userId: string, itemId: string): Promise<void> {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: { wishlist: { select: { userId: true } } },
    });
    if (!item) throw new CommerceNotFoundError("Wishlist item not found");
    if (item.wishlist.userId !== userId) throw new CommerceForbiddenError();
    await prisma.wishlistItem.delete({ where: { id: itemId } });
  },

  async clearWishlist(userId: string): Promise<void> {
    const wishlist = await prisma.wishlist.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!wishlist) return;
    await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
  },
};
