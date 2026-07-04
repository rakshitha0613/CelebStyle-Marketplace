import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { Money } from "../lib/money.js";
import { writeAuditLog } from "../lib/audit.js";
import {
  CommerceValidationError,
  CommerceNotFoundError,
  CommerceForbiddenError,
  InsufficientStockError,
} from "../lib/commerce.errors.js";

// ── Public types ──────────────────────────────────────────────────────────────

export type ProductSnapshot = {
  productName: string;
  imageUrl: string;
  category: string;
  celebritySlug: string;
  celebrityName: string;
};

export type CartItemDto = {
  id: string;
  productSlug: string;
  productName: string;
  imageUrl: string;
  variantId: string | null;
  size: string;
  color: string | null;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
  availableStock: number;
};

export type CartDto = {
  id: string;
  items: CartItemDto[];
  subtotalPaise: number;
  itemCount: number;
};

export type AddItemInput = {
  productSlug: string;
  size: string;
  color?: string;
  quantity: number;
};

export type MergeResult = {
  cart: CartDto;
  skipped: Array<{ productSlug: string; size: string; reason: string }>;
};

// ── Prisma include shape ──────────────────────────────────────────────────────

const CART_INCLUDE = {
  items: {
    orderBy: { addedAt: "asc" as const },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          movieName: true,
          imageUrl: true,
          category: true,
          basePrice: true,
          isActive: true,
          celebrity: { select: { id: true, slug: true, name: true } },
        },
      },
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          priceAdjustment: true,
          isAvailable: true,
        },
      },
    },
  },
} as const;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;
type CartItemRow = CartWithItems["items"][number];

// ── Stock helpers ─────────────────────────────────────────────────────────────

async function getAvailableStockMap(
  variantIds: string[]
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const rows = await prisma.inventory.groupBy({
    by: ["variantId"],
    where: { variantId: { in: variantIds } },
    _sum: { quantity: true, reservedQuantity: true },
  });
  return new Map(
    rows.map((r) => [
      r.variantId,
      (r._sum.quantity ?? 0) - (r._sum.reservedQuantity ?? 0),
    ])
  );
}

function resolveAvailableStock(
  item: CartItemRow,
  stockMap: Map<string, number>
): number {
  if (!item.variantId) return 999; // No variant → no inventory tracking
  if (item.variant && !item.variant.isAvailable) return 0;
  const inStock = stockMap.get(item.variantId);
  return inStock !== undefined ? inStock : 999; // No inventory record → assume available
}

// ── Converter ─────────────────────────────────────────────────────────────────

async function toCartDto(cart: CartWithItems): Promise<CartDto> {
  const variantIds = cart.items
    .filter((i) => i.variantId !== null)
    .map((i) => i.variantId!);

  const stockMap = await getAvailableStockMap(variantIds);

  const items: CartItemDto[] = cart.items.map((item) => ({
    id:              item.id,
    productSlug:     item.product.slug,
    productName:     item.product.movieName,
    imageUrl:        item.product.imageUrl,
    variantId:       item.variantId,
    size:            item.size,
    color:           item.color,
    quantity:        item.quantity,
    unitPricePaise:  item.priceAtAdd,
    totalPricePaise: Money.multiply(item.priceAtAdd, item.quantity),
    availableStock:  resolveAvailableStock(item, stockMap),
  }));

  const subtotalPaise = items.reduce(
    (sum, i) => Money.add(sum, i.totalPricePaise),
    0
  );

  return {
    id:             cart.id,
    items,
    subtotalPaise,
    itemCount:      items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// ── Cart retrieval / creation ─────────────────────────────────────────────────

async function getOrCreateCart(userId: string): Promise<CartWithItems> {
  // upsert is PgBouncer-safe (single statement)
  await prisma.cart.upsert({
    where:  { userId },
    update: {},
    create: { userId },
    select: { id: true },
  });
  // Re-fetch with full includes
  const cart = await prisma.cart.findUnique({
    where:   { userId },
    include: CART_INCLUDE,
  });
  return cart!;
}

// ── Stock validation ──────────────────────────────────────────────────────────

async function checkStock(
  variantId: string | null,
  productId: string,
  requestedQty: number
): Promise<void> {
  if (!variantId) return; // No variant → no inventory check

  const variant = await prisma.productVariant.findUnique({
    where:  { id: variantId },
    select: { isAvailable: true },
  });
  if (variant && !variant.isAvailable) {
    throw new InsufficientStockError(0, requestedQty);
  }

  const stocks = await prisma.inventory.findMany({
    where:  { variantId, productId },
    select: { quantity: true, reservedQuantity: true },
  });
  if (stocks.length === 0) return; // No inventory record → assume available

  const available = stocks.reduce(
    (sum, s) => sum + s.quantity - s.reservedQuantity,
    0
  );
  if (available < requestedQty) {
    throw new InsufficientStockError(available, requestedQty);
  }
}

// ── Cart service ──────────────────────────────────────────────────────────────

export const cartService = {

  async getCart(userId: string): Promise<CartDto> {
    const cart = await getOrCreateCart(userId);
    return toCartDto(cart);
  },

  async addItem(
    userId: string,
    input: AddItemInput,
    actorIp?: string
  ): Promise<CartDto> {
    const { productSlug, size, color, quantity } = input;

    if (quantity < 1) {
      throw new CommerceValidationError("quantity must be at least 1");
    }
    if (!size.trim()) {
      throw new CommerceValidationError("size is required");
    }

    // Resolve product
    const product = await prisma.product.findFirst({
      where: { slug: productSlug, isActive: true, deletedAt: null },
      select: {
        id: true, slug: true, movieName: true, imageUrl: true,
        category: true, basePrice: true,
        celebrity: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!product) throw new CommerceNotFoundError(`Product not found: ${productSlug}`);

    // Resolve variant (optional)
    const variantWhere: Record<string, unknown> = { productId: product.id, size };
    if (color !== undefined) variantWhere.color = color;
    const variant = await prisma.productVariant.findFirst({
      where: variantWhere,
      select: { id: true, priceAdjustment: true, isAvailable: true },
    });

    // Availability + stock check
    if (variant) {
      if (!variant.isAvailable) {
        throw new InsufficientStockError(0, quantity);
      }
      const stocks = await prisma.inventory.findMany({
        where:  { variantId: variant.id, productId: product.id },
        select: { quantity: true, reservedQuantity: true },
      });
      if (stocks.length > 0) {
        const available = stocks.reduce((s, r) => s + r.quantity - r.reservedQuantity, 0);
        if (available < quantity) {
          throw new InsufficientStockError(available, quantity);
        }
      }
    }

    // Price in paise: basePrice (rupees) + priceAdjustment (rupees) → paise
    const unitPricePaise = Money.toPaise(
      product.basePrice + (variant?.priceAdjustment ?? 0)
    );

    const snapshot: ProductSnapshot = {
      productName:   product.movieName,
      imageUrl:      product.imageUrl,
      category:      product.category,
      celebritySlug: product.celebrity.slug,
      celebrityName: product.celebrity.name,
    };

    // Get or create cart
    await prisma.cart.upsert({
      where:  { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    const cartRow = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    const cartId = cartRow!.id;

    // Upsert cart item — increment quantity if already present for same product+size
    const existing = await prisma.cartItem.findFirst({
      where:  { cartId, productId: product.id, size },
      select: { id: true, quantity: true },
    });

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (variant) {
        await checkStock(variant.id, product.id, newQty);
      }
      await prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId,
          productId:       product.id,
          variantId:       variant?.id ?? null,
          size,
          color:           color ?? null,
          quantity,
          priceAtAdd:      unitPricePaise,
          productSnapshot: snapshot as Record<string, string>,
        },
      });
    }

    writeAuditLog({
      actorId:      userId,
      action:       existing ? "CART_ITEM_QTY_INCREASED" : "CART_ITEM_ADDED",
      resourceType: "CartItem",
      resourceId:   cartId,
      after:        { productSlug, size, quantity },
      ipAddress:    actorIp,
    });

    const cart = await prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
    return toCartDto(cart!);
  },

  async updateItem(
    userId: string,
    itemId: string,
    quantity: number,
    actorIp?: string
  ): Promise<CartDto> {
    if (quantity < 0) {
      throw new CommerceValidationError("quantity must be >= 0");
    }

    const item = await prisma.cartItem.findUnique({
      where:   { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new CommerceNotFoundError("Cart item not found");
    if (item.cart.userId !== userId) throw new CommerceForbiddenError();

    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
      writeAuditLog({
        actorId:      userId,
        action:       "CART_ITEM_REMOVED",
        resourceType: "CartItem",
        resourceId:   itemId,
        after:        { quantity: 0 },
        ipAddress:    actorIp,
      });
    } else {
      if (item.variantId) {
        await checkStock(item.variantId, item.productId, quantity);
      }
      await prisma.cartItem.update({
        where: { id: itemId },
        data:  { quantity },
      });
      writeAuditLog({
        actorId:      userId,
        action:       "CART_ITEM_QTY_UPDATED",
        resourceType: "CartItem",
        resourceId:   itemId,
        before:       { quantity: item.quantity },
        after:        { quantity },
        ipAddress:    actorIp,
      });
    }

    const cart = await prisma.cart.findUnique({
      where:   { userId },
      include: CART_INCLUDE,
    });
    return toCartDto(cart!);
  },

  async removeItem(
    userId: string,
    itemId: string,
    actorIp?: string
  ): Promise<CartDto> {
    const item = await prisma.cartItem.findUnique({
      where:   { id: itemId },
      include: { cart: { select: { userId: true } } },
    });
    if (!item) throw new CommerceNotFoundError("Cart item not found");
    if (item.cart.userId !== userId) throw new CommerceForbiddenError();

    await prisma.cartItem.delete({ where: { id: itemId } });

    writeAuditLog({
      actorId:      userId,
      action:       "CART_ITEM_REMOVED",
      resourceType: "CartItem",
      resourceId:   itemId,
      ipAddress:    actorIp,
    });

    const cart = await prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
    return toCartDto(cart!);
  },

  async clearCart(userId: string, actorIp?: string): Promise<void> {
    const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cart) return;

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    writeAuditLog({
      actorId:      userId,
      action:       "CART_CLEARED",
      resourceType: "Cart",
      resourceId:   cart.id,
      ipAddress:    actorIp,
    });
  },

  async mergeCart(
    userId: string,
    items: AddItemInput[],
    actorIp?: string
  ): Promise<MergeResult> {
    const skipped: MergeResult["skipped"] = [];

    for (const item of items) {
      try {
        await cartService.addItem(userId, item, actorIp);
      } catch (err) {
        skipped.push({
          productSlug: item.productSlug,
          size:        item.size,
          reason:      err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const cart = await cartService.getCart(userId);
    return { cart, skipped };
  },
};
