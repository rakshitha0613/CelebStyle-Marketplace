import { prisma } from "../lib/prisma.js";
import type { OrderStatus as PrismaOrderStatus, Prisma } from "@prisma/client";

// ── Public API types (byte-for-byte match of the existing route contract) ──────
export type OrderStatus = "placed" | "production started" | "shipped" | "delivered";
export type PaymentStatus = "pending" | "paid";

export type OrderItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  category: string;
  price: number;
  size: string;
  imageUrl: string;
  manufacturerIds: string[];
};

export type OrderEntry = {
  id: string;
  customerName: string;
  customerEmail: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  status: OrderStatus;
  commission: {
    platformFee: number;
    celebrityCommission: number;
    manufacturerShare: number;
  };
  routing: Array<{
    outfitId: string;
    manufacturerId: string | null;
    manufacturerName: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type CreateInput = {
  customerName: string;
  customerEmail: string;
  address: string;
  paymentMethod: string;
  items: OrderItem[];
};

// ── Enum mappings ──────────────────────────────────────────────────────────────
const STATUS_TO_PRISMA: Record<string, PrismaOrderStatus> = {
  "placed": "PLACED",
  "production started": "PRODUCTION_STARTED",
  "shipped": "SHIPPED",
  "delivered": "DELIVERED",
};

const STATUS_FROM_PRISMA: Partial<Record<PrismaOrderStatus, OrderStatus>> = {
  PLACED: "placed",
  PRODUCTION_STARTED: "production started",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
};

// ── Include / Row type ─────────────────────────────────────────────────────────
const INCLUDE = {
  items: true,
  commission: true,
  routing: {
    include: {
      orderItem: { select: { productSlug: true } },
      manufacturer: { select: { slug: true } },
    },
  },
} as const;

type Row = Prisma.OrderGetPayload<{
  include: {
    items: true;
    commission: true;
    routing: {
      include: {
        orderItem: { select: { productSlug: true } };
        manufacturer: { select: { slug: true } };
      };
    };
  };
}>;

// ── Converters ─────────────────────────────────────────────────────────────────
function toApi(row: Row): OrderEntry {
  const commission = row.commission;
  return {
    id: row.orderNumber,
    customerName: row.shippingName,
    customerEmail: row.customerEmail,
    address: row.shippingAddress,
    items: row.items.map((item) => ({
      outfitId: item.productSlug,
      outfitName: item.productName,
      celebrityId: item.celebrityId,
      celebrityName: item.celebrityName,
      category: item.category,
      price: item.unitPrice,
      size: item.size,
      imageUrl: item.imageUrl,
      manufacturerIds: item.manufacturerIds,
    })),
    subtotal: row.subtotal,
    shipping: row.shippingAmount,
    total: row.total,
    // PENDING / AUTHORIZED / FAILED → "pending"; CAPTURED → "paid"
    paymentStatus: row.paymentStatus === "CAPTURED" ? "paid" : "pending",
    // Raw payment method string is stored in Order.notes for backward compat
    paymentMethod: row.notes ?? "Razorpay Demo",
    status: STATUS_FROM_PRISMA[row.status] ?? "placed",
    commission: commission
      ? {
          platformFee: commission.platformFee,
          celebrityCommission: commission.celebrityCommission,
          manufacturerShare: commission.manufacturerShare,
        }
      : { platformFee: 0, celebrityCommission: 0, manufacturerShare: 0 },
    routing: row.routing.map((r) => ({
      outfitId: r.orderItem.productSlug,
      manufacturerId: r.manufacturer?.slug ?? null,
      manufacturerName: r.manufacturerName,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Commission model: 10% platform / 5% celebrity / 85% manufacturer of subtotal
function computeTotals(items: OrderItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shipping = subtotal >= 25_000 ? 0 : 499;
  const total = subtotal + shipping;
  const platformFee = Math.round(subtotal * 0.1);
  const celebrityCommission = Math.round(subtotal * 0.05);
  const manufacturerShare = subtotal - platformFee - celebrityCommission;
  return { subtotal, shipping, total, platformFee, celebrityCommission, manufacturerShare };
}

// ── Repository ─────────────────────────────────────────────────────────────────
export const orderRepository = {
  async findAll(): Promise<OrderEntry[]> {
    const rows = await prisma.order.findMany({
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toApi);
  },

  async findByOrderNumber(orderNumber: string): Promise<OrderEntry | null> {
    const row = await prisma.order.findUnique({
      where: { orderNumber },
      include: INCLUDE,
    });
    return row ? toApi(row) : null;
  },

  async create(data: CreateInput): Promise<OrderEntry> {
    const { subtotal, shipping, total, platformFee, celebrityCommission, manufacturerShare } =
      computeTotals(data.items);

    const orderNumber = `ord-${Date.now()}`;

    // Pre-fetch lookups to avoid N+1 queries inside the transaction
    const uniqueProductSlugs = [...new Set(data.items.map((i) => i.outfitId))];
    const uniqueMfrSlugs = [
      ...new Set(data.items.flatMap((i) => i.manufacturerIds).filter(Boolean)),
    ];

    const [products, manufacturers] = await Promise.all([
      prisma.product.findMany({
        where: { slug: { in: uniqueProductSlugs }, isActive: true, deletedAt: null },
        select: { id: true, slug: true },
      }),
      uniqueMfrSlugs.length > 0
        ? prisma.manufacturer.findMany({
            where: { slug: { in: uniqueMfrSlugs }, isActive: true, deletedAt: null },
            select: { id: true, slug: true, name: true },
          })
        : Promise.resolve([] as Array<{ id: string; slug: string; name: string }>),
    ]);

    const productMap = new Map(products.map((p) => [p.slug, p.id]));
    const mfrMap = new Map(manufacturers.map((m) => [m.slug, m]));

    const missing = data.items.find((i) => !productMap.has(i.outfitId));
    if (missing) throw new Error(`Product not found in database: ${missing.outfitId}`);

    // Step 1: Create Order with nested OrderItems and OrderCommission in one query.
    // Nested creates are a single DB operation — no interactive transaction needed,
    // which makes this compatible with PgBouncer's transaction-mode pooler.
    const order = await prisma.order.create({
      data: {
        orderNumber,
        shippingName: data.customerName,
        shippingPhone: "",
        shippingAddress: data.address,
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
        customerEmail: data.customerEmail,
        subtotal,
        shippingAmount: shipping,
        total,
        notes: data.paymentMethod,
        items: {
          create: data.items.map((item) => ({
            productId: productMap.get(item.outfitId)!,
            productSlug: item.outfitId,
            productName: item.outfitName,
            celebrityId: item.celebrityId,
            celebrityName: item.celebrityName,
            category: item.category,
            size: item.size,
            imageUrl: item.imageUrl,
            unitPrice: item.price,
            totalPrice: item.price,
            manufacturerIds: item.manufacturerIds,
          })),
        },
        commission: {
          create: {
            platformFee,
            celebrityCommission,
            manufacturerShare,
            platformFeePercent: 10,
            celebrityPercent: 5,
            manufacturerPercent: 85,
          },
        },
      },
      // Minimal include — need item IDs to create ManufacturerRouting below
      include: { items: { select: { id: true, productSlug: true } } },
    });

    // Step 2: Create ManufacturerRouting records (one per OrderItem) in batch.
    // Batch $transaction is PgBouncer-compatible — each query runs in its own
    // DB transaction rather than a single shared interactive transaction.
    await prisma.$transaction(
      order.items.map((orderItem) => {
        const src = data.items.find((i) => i.outfitId === orderItem.productSlug);
        const mfrSlug = src?.manufacturerIds[0] ?? null;
        const mfr = mfrSlug ? (mfrMap.get(mfrSlug) ?? null) : null;
        return prisma.manufacturerRouting.create({
          data: {
            orderId: order.id,
            orderItemId: orderItem.id,
            manufacturerId: mfr?.id ?? null,
            manufacturerName: mfr?.name ?? "Unassigned",
          },
        });
      })
    );

    // Step 3: Re-fetch with full includes for toApi conversion
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: INCLUDE,
    });

    return toApi(row);
  },

  async pay(orderNumber: string): Promise<OrderEntry | null> {
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, total: true, paymentStatus: true },
    });
    if (!existing) return null;

    // Idempotent: already captured → return current state without a new Payment record
    if (existing.paymentStatus === "CAPTURED") {
      const row = await prisma.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: INCLUDE,
      });
      return toApi(row);
    }

    // Batch $transaction: update Order then create Payment record.
    // Each query runs in its own DB transaction (PgBouncer-compatible).
    await prisma.$transaction([
      prisma.order.update({
        where: { id: existing.id },
        data: { paymentStatus: "CAPTURED", status: "PRODUCTION_STARTED" },
      }),
      prisma.payment.create({
        data: {
          orderId: existing.id,
          provider: "RAZORPAY",
          method: "CARD",
          amount: existing.total,
          status: "CAPTURED",
          capturedAt: new Date(),
        },
      }),
    ]);

    const row = await prisma.order.findUniqueOrThrow({
      where: { id: existing.id },
      include: INCLUDE,
    });

    return toApi(row);
  },

  async updateStatus(orderNumber: string, status: string): Promise<OrderEntry | null> {
    const prismaStatus = STATUS_TO_PRISMA[status];
    if (!prismaStatus) return null;

    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (!existing) return null;

    const row = await prisma.order.update({
      where: { id: existing.id },
      data: { status: prismaStatus },
      include: INCLUDE,
    });

    return toApi(row);
  },
};
