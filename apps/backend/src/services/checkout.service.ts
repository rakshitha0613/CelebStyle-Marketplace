import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { planAndReserve, rollbackPlans, buildBatchOps } from "./reservation.service.js";
import { Money } from "../lib/money.js";
import { writeAuditLog } from "../lib/audit.js";
import { shippingService, type ShippingQuote, type ShippingSnapshot } from "./shipping.service.js";
import { couponService, type CouponValidationResult, type CouponSnapshot } from "./coupon.service.js";
import { taxService, type TaxBreakdown } from "./tax.service.js";
import {
  CheckoutError,
  CommerceNotFoundError,
  CommerceForbiddenError,
  InsufficientStockError,
} from "../lib/commerce.errors.js";

// ── Public types ──────────────────────────────────────────────────────────────

export type { ShippingQuote, TaxBreakdown, CouponValidationResult };

export type LineItem = {
  productId:       string;
  productSlug:     string;
  productName:     string;
  imageUrl:        string;
  category:        string;
  celebrityId:     string;
  celebrityName:   string;
  variantId:       string | null;
  size:            string;
  color:           string | null;
  quantity:        number;
  unitPricePaise:  number;  // current price at checkout time
  totalPricePaise: number;
  priceAtAddPaise: number;  // original price when added to cart
  priceChanged:    boolean;
  manufacturerIds: string[];
};

export type CheckoutPreview = {
  lineItems:       LineItem[];
  subtotalPaise:   number;
  shippingPaise:   number;
  discountPaise:   number;
  taxPaise:        number;
  grandTotalPaise: number;
  shipping:        ShippingQuote;
  tax:             TaxBreakdown;
  coupon:          CouponValidationResult | null;
  warnings:        string[];
  isValid:         boolean;
};

export type PreviewInput = {
  couponCode?: string;
  addressId?:  string;
};

export type ConfirmInput = {
  addressId:      string;
  couponCode?:    string;
  idempotencyKey?: string;
};

export type ConfirmResult = {
  orderNumber:     string;
  orderId:         string;
  status:          string;
  grandTotalPaise: number;
  subtotalPaise:   number;
  shippingPaise:   number;
  discountPaise:   number;
  taxPaise:        number;
  itemCount:       number;
  isIdempotentRepeat: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOrderNumber(): string {
  const d    = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `CS${date}${rand}`;
}

async function resolveLineItems(userId: string): Promise<{
  cartId: string;
  lineItems: LineItem[];
}> {
  const cart = await prisma.cart.findUnique({
    where:   { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, slug: true, movieName: true, imageUrl: true,
              category: true, basePrice: true, isActive: true, deletedAt: true,
              celebrity: { select: { id: true, name: true } },
            },
          },
          variant: { select: { id: true, priceAdjustment: true, isAvailable: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("Cart is empty", "CART_EMPTY");
  }

  // Batch-fetch manufacturer IDs for all products
  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const mfrLinks   = await prisma.manufacturerProduct.findMany({
    where:   { productId: { in: productIds } },
    select:  { productId: true, manufacturerId: true },
    orderBy: { isPrimary: "desc" },
  });
  const mfrMap = new Map<string, string[]>();
  for (const link of mfrLinks) {
    const list = mfrMap.get(link.productId) ?? [];
    list.push(link.manufacturerId);
    mfrMap.set(link.productId, list);
  }

  const lineItems: LineItem[] = cart.items.map((item) => {
    const p            = item.product;
    const currentPrice = Money.toPaise(p.basePrice + (item.variant?.priceAdjustment ?? 0));
    const priceChanged = currentPrice !== item.priceAtAdd;

    return {
      productId:       p.id,
      productSlug:     p.slug,
      productName:     p.movieName,
      imageUrl:        p.imageUrl,
      category:        p.category,
      celebrityId:     p.celebrity.id,
      celebrityName:   p.celebrity.name,
      variantId:       item.variantId,
      size:            item.size,
      color:           item.color,
      quantity:        item.quantity,
      unitPricePaise:  currentPrice,
      totalPricePaise: Money.multiply(currentPrice, item.quantity),
      priceAtAddPaise: item.priceAtAdd,
      priceChanged,
      manufacturerIds: mfrMap.get(p.id) ?? [],
    };
  });

  return { cartId: cart.id, lineItems };
}

async function validateStock(lineItems: LineItem[]): Promise<string[]> {
  const warnings: string[] = [];
  const variantIds         = lineItems.filter((i) => i.variantId !== null).map((i) => i.variantId!);

  if (variantIds.length === 0) return warnings;

  const stocks = await prisma.inventory.groupBy({
    by:    ["variantId"],
    where: { variantId: { in: variantIds } },
    _sum:  { quantity: true, reservedQuantity: true },
  });
  const stockMap = new Map(
    stocks.map((r) => [r.variantId, (r._sum.quantity ?? 0) - (r._sum.reservedQuantity ?? 0)])
  );

  for (const item of lineItems) {
    if (!item.variantId) continue;
    const available = stockMap.get(item.variantId);
    if (available === undefined) continue; // No inventory record → assume available
    if (available < item.quantity) {
      throw new InsufficientStockError(available, item.quantity);
    }
  }

  return warnings;
}

function buildWarnings(lineItems: LineItem[], inactiveProductSlugs: string[]): string[] {
  const warnings: string[] = [];

  for (const item of lineItems) {
    if (inactiveProductSlugs.includes(item.productSlug)) {
      warnings.push(`"${item.productName}" is no longer available`);
    }
    if (item.priceChanged) {
      warnings.push(
        `Price of "${item.productName}" changed from ${Money.format(item.priceAtAddPaise)} to ${Money.format(item.unitPricePaise)}`
      );
    }
  }

  return warnings;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const checkoutService = {

  async preview(userId: string, input: PreviewInput): Promise<CheckoutPreview> {
    const { cartId, lineItems } = await resolveLineItems(userId);

    // Identify inactive / deleted products
    const activeProductSlugs = lineItems
      .filter((i) => {
        // We need isActive; it's not on LineItem — fetch inline below
        return true;
      })
      .map((i) => i.productSlug);

    // Fetch active status for all products
    const productStatuses = await prisma.product.findMany({
      where:  { id: { in: lineItems.map((i) => i.productId) } },
      select: { id: true, isActive: true, deletedAt: true },
    });
    const inactiveIds    = productStatuses.filter((p) => !p.isActive || p.deletedAt !== null).map((p) => p.id);
    const inactiveSlugs  = lineItems.filter((i) => inactiveIds.includes(i.productId)).map((i) => i.productSlug);

    const subtotalPaise = lineItems.reduce((sum, i) => Money.add(sum, i.totalPricePaise), 0);

    // Shipping
    const shipping = await shippingService.calculate(subtotalPaise);

    // Coupon
    let coupon: CouponValidationResult | null = null;
    if (input.couponCode) {
      coupon = await couponService.validate(
        input.couponCode,
        userId,
        subtotalPaise,
        shipping.ratePaise,
        lineItems.map((i) => ({ productId: i.productId, quantity: i.quantity, totalPricePaise: i.totalPricePaise }))
      );
    }
    const discountPaise = coupon?.valid ? coupon.discountPaise : 0;

    // Tax (on amount after discount)
    const taxableAmount = Math.max(0, subtotalPaise - discountPaise);
    const avgUnitPrice  = lineItems.length > 0
      ? Math.round(taxableAmount / lineItems.reduce((s, i) => s + i.quantity, 0))
      : 0;
    const tax = taxService.calculate(taxableAmount, undefined, avgUnitPrice);

    const shippingAfterDiscount = coupon?.type === "FREE_SHIPPING" ? 0 : shipping.ratePaise;
    const grandTotalPaise = Money.add(taxableAmount, shippingAfterDiscount, tax.totalTaxAmount);

    // Stock validation (throws InsufficientStockError if not enough)
    let stockWarnings: string[] = [];
    let isValid                 = inactiveSlugs.length === 0;
    try {
      stockWarnings = await validateStock(lineItems);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        stockWarnings = [err.message];
        isValid       = false;
      } else {
        throw err;
      }
    }

    const warnings = [...buildWarnings(lineItems, inactiveSlugs), ...stockWarnings];

    return {
      lineItems,
      subtotalPaise,
      shippingPaise:   shippingAfterDiscount,
      discountPaise,
      taxPaise:        tax.totalTaxAmount,
      grandTotalPaise,
      shipping,
      tax,
      coupon,
      warnings,
      isValid: isValid && stockWarnings.length === 0,
    };
  },

  async confirm(
    userId: string,
    userEmail: string,
    input: ConfirmInput,
    actorIp?: string
  ): Promise<ConfirmResult> {
    const { addressId, couponCode, idempotencyKey } = input;

    // Idempotency: return existing order if key already used
    if (idempotencyKey) {
      const existing = await prisma.order.findFirst({
        where:  { idempotencyKey, userId },
        select: {
          id: true, orderNumber: true, status: true,
          total: true, subtotal: true, shippingAmount: true,
          discountAmount: true, taxAmount: true,
          items: { select: { quantity: true } },
        },
      });
      if (existing) {
        return {
          orderNumber:        existing.orderNumber,
          orderId:            existing.id,
          status:             existing.status,
          grandTotalPaise:    existing.total,
          subtotalPaise:      existing.subtotal,
          shippingPaise:      existing.shippingAmount,
          discountPaise:      existing.discountAmount,
          taxPaise:           existing.taxAmount,
          itemCount:          existing.items.reduce((s, i) => s + i.quantity, 0),
          isIdempotentRepeat: true,
        };
      }
    }

    // Validate address ownership
    const address = await prisma.address.findUnique({
      where:  { id: addressId },
      select: { id: true, userId: true, isActive: true, fullName: true, phone: true, line1: true, line2: true, city: true, state: true, pincode: true, country: true },
    });
    if (!address || !address.isActive) throw new CommerceNotFoundError("Address not found");
    if (address.userId !== userId)      throw new CommerceForbiddenError("This address does not belong to you");

    // Resolve and validate cart
    const { cartId, lineItems } = await resolveLineItems(userId);
    if (lineItems.length === 0) throw new CheckoutError("Cart is empty", "CART_EMPTY");

    // Validate all products are active
    const productStatuses = await prisma.product.findMany({
      where:  { id: { in: lineItems.map((i) => i.productId) } },
      select: { id: true, isActive: true, deletedAt: true },
    });
    const inactive = productStatuses.filter((p) => !p.isActive || p.deletedAt !== null);
    if (inactive.length > 0) {
      const names = lineItems.filter((i) => inactive.some((p) => p.id === i.productId)).map((i) => i.productName);
      throw new CheckoutError(`The following items are no longer available: ${names.join(", ")}`, "INACTIVE_PRODUCT");
    }

    // Validate stock (throws if insufficient)
    await validateStock(lineItems);

    // Calculate amounts
    const subtotalPaise = lineItems.reduce((sum, i) => Money.add(sum, i.totalPricePaise), 0);
    const shipping      = await shippingService.calculate(subtotalPaise, address.pincode);

    let coupon: CouponValidationResult | null = null;
    if (couponCode) {
      coupon = await couponService.validate(
        couponCode,
        userId,
        subtotalPaise,
        shipping.ratePaise,
        lineItems.map((i) => ({ productId: i.productId, quantity: i.quantity, totalPricePaise: i.totalPricePaise }))
      );
      if (!coupon.valid) {
        throw new CheckoutError(coupon.message, "INVALID_COUPON");
      }
    }
    const discountPaise       = coupon?.discountPaise ?? 0;
    const shippingAfterDiscount = coupon?.type === "FREE_SHIPPING" ? 0 : shipping.ratePaise;
    const taxableAmount       = Math.max(0, subtotalPaise - discountPaise);
    const avgUnitPrice        = Math.round(taxableAmount / lineItems.reduce((s, i) => s + i.quantity, 0));
    const tax                 = taxService.calculate(taxableAmount, address.state, avgUnitPrice);
    const grandTotalPaise     = Money.add(taxableAmount, shippingAfterDiscount, tax.totalTaxAmount);

    // Build commission amounts (applied to after-discount subtotal)
    const commissionBase      = subtotalPaise - discountPaise;
    const platformFee         = Money.percentOf(commissionBase, 10);
    const celebrityCommission = Money.percentOf(commissionBase, 5);
    const manufacturerShare   = Money.percentOf(commissionBase, 85);

    // Warehouse-aware CAS reservation (prevents overselling under concurrent checkout)
    const variantItems = lineItems.filter((i) => i.variantId !== null);
    const reservationPlans = await planAndReserve(
      variantItems.map((i) => ({ variantId: i.variantId!, quantity: i.quantity }))
    );
    // Build a map: variantId → plan index (for InventoryReservation linking)
    const planIndexByVariant = new Map(reservationPlans.map((p, idx) => [p.variantId, idx]));

    const orderNumber = generateOrderNumber();
    // Pre-generate IDs so InventoryReservation records can reference them in the same batch
    const orderId     = randomUUID();
    const orderItemIds = lineItems.map(() => randomUUID());

    const couponUsageNested = coupon
      ? {
          couponUsage: {
            create: {
              couponId:       coupon.couponId,
              userId,
              discountApplied: coupon.discountPaise,
            },
          },
        }
      : {};

    const couponIncrement: Prisma.PrismaPromise<unknown>[] = coupon
      ? [prisma.coupon.update({ where: { id: coupon.couponId }, data: { usedCount: { increment: 1 } } })]
      : [];

    // Build order snapshot fields
    const shippingAddress = [address.line1, address.line2].filter(Boolean).join(", ");

    const couponSnapshot: CouponSnapshot | null = coupon
      ? coupon.snapshot
      : null;

    // Build InventoryReservation + StockMovement ops for the batch
    const batchMapping = lineItems
      .map((item, idx) => {
        const planIdx = item.variantId ? planIndexByVariant.get(item.variantId) : undefined;
        return planIdx !== undefined ? { orderId, orderItemId: orderItemIds[idx], planIndex: planIdx } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const reservationBatchOps = buildBatchOps(reservationPlans, batchMapping);

    // Atomic batch: order + reservation records + movements + coupon + cart clear
    let results: unknown[];
    try {
      results = await prisma.$transaction([
        prisma.order.create({
          data: {
            id:              orderId,
            orderNumber,
            userId,
            addressId,
            shippingName:    address.fullName,
            shippingPhone:   address.phone,
            shippingAddress,
            shippingCity:    address.city,
            shippingState:   address.state,
            shippingPincode: address.pincode,
            customerEmail:   userEmail,
            subtotal:        subtotalPaise,
            discountAmount:  discountPaise,
            shippingAmount:  shippingAfterDiscount,
            taxAmount:       tax.totalTaxAmount,
            total:           grandTotalPaise,
            status:          "AWAITING_PAYMENT",
            paymentStatus:   "PENDING",
            idempotencyKey:  idempotencyKey ?? null,
            couponId:        coupon?.couponId ?? null,
            couponCode:      coupon?.code     ?? null,
            taxSnapshot:     tax              as unknown as Prisma.InputJsonValue,
            shippingSnapshot: shipping.snapshot as unknown as Prisma.InputJsonValue,
            couponSnapshot:  couponSnapshot   as unknown as Prisma.InputJsonValue ?? Prisma.JsonNull,
            items: {
              create: lineItems.map((item, idx) => ({
                id:             orderItemIds[idx],
                productId:      item.productId,
                variantId:      item.variantId,
                productSlug:    item.productSlug,
                productName:    item.productName,
                celebrityId:    item.celebrityId,
                celebrityName:  item.celebrityName,
                category:       item.category,
                size:           item.size,
                imageUrl:       item.imageUrl,
                unitPrice:      item.unitPricePaise,
                quantity:       item.quantity,
                totalPrice:     item.totalPricePaise,
                manufacturerIds: item.manufacturerIds,
              })),
            },
            commission: {
              create: {
                platformFee,
                celebrityCommission,
                manufacturerShare,
                platformFeePercent:  10,
                celebrityPercent:    5,
                manufacturerPercent: 85,
              },
            },
            ...couponUsageNested,
          },
          select: { id: true, orderNumber: true, status: true, total: true },
        }),
        ...reservationBatchOps,
        ...couponIncrement,
        prisma.cartItem.deleteMany({ where: { cartId } }),
      ]);
    } catch (err) {
      // Rollback CAS reservations if order creation fails
      await rollbackPlans(reservationPlans);
      throw err;
    }

    const createdOrder = results[0] as { id: string; orderNumber: string; status: string; total: number };

    writeAuditLog({
      actorId:      userId,
      actorEmail:   userEmail,
      action:       "ORDER_CREATED",
      resourceType: "Order",
      resourceId:   createdOrder.id,
      after:        { orderNumber, total: grandTotalPaise, status: "AWAITING_PAYMENT" },
      ipAddress:    actorIp,
    });

    return {
      orderNumber:        createdOrder.orderNumber,
      orderId:            createdOrder.id,
      status:             createdOrder.status,
      grandTotalPaise,
      subtotalPaise,
      shippingPaise:      shippingAfterDiscount,
      discountPaise,
      taxPaise:           tax.totalTaxAmount,
      itemCount:          lineItems.reduce((s, i) => s + i.quantity, 0),
      isIdempotentRepeat: false,
    };
  },
};
