import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { refundService } from "../services/refund.service.js";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { UserRole, NotificationType, OrderStatus, Prisma } from "@prisma/client";

export const adminRouter = Router();

adminRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// ── Dashboard Stats ──────────────────────────────────────────────────────────

adminRouter.get("/stats", async (_req: Request, res: Response) => {
  const [
    totalUsers,
    activeUsers,
    totalOrders,
    pendingOrders,
    revenue,
    totalProducts,
    totalCelebrities,
    totalManufacturers,
    totalStorefronts,
    totalReviews,
    pendingReviews,
    communityPosts,
    totalCoupons,
    activeCoupons,
    totalReturns,
    pendingReturns,
    ordersByStatus,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PLACED" } }),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.count({ where: { isActive: true, deletedAt: null } }),
    prisma.celebrity.count({ where: { isActive: true, deletedAt: null } }),
    prisma.manufacturer.count({ where: { isActive: true, deletedAt: null } }),
    prisma.storefront.count({ where: { isPublished: true } }),
    prisma.review.count({ where: { deletedAt: null } }),
    prisma.review.count({ where: { isApproved: false, deletedAt: null } }),
    prisma.communityPost.count({ where: { deletedAt: null } }),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { isActive: true } }),
    prisma.return.count(),
    prisma.return.count({ where: { status: "REQUESTED" } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        shippingName: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.product.findMany({
      take: 5,
      where: { isActive: true, deletedAt: null },
      orderBy: { orderCount: "desc" },
      select: {
        id: true,
        slug: true,
        movieName: true,
        category: true,
        imageUrl: true,
        basePrice: true,
        orderCount: true,
      },
    }),
  ]);

  const lowStockItems = await prisma.inventory.findMany({
    where: { quantity: { lte: 10 } },
    take: 10,
    orderBy: { quantity: "asc" },
    select: {
      id: true,
      quantity: true,
      lowStockThreshold: true,
      product: { select: { id: true, movieName: true, imageUrl: true } },
      variant: { select: { size: true, color: true } },
      warehouse: { select: { name: true } },
    },
  });

  res.json({
    data: {
      stats: {
        totalUsers,
        activeUsers,
        totalOrders,
        pendingOrders,
        totalRevenue: Number(revenue._sum.total ?? 0),
        totalProducts,
        totalCelebrities,
        totalManufacturers,
        totalStorefronts,
        totalReviews,
        pendingReviews,
        communityPosts,
        totalCoupons,
        activeCoupons,
        totalReturns,
        pendingReturns,
      },
      ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count._all })),
      recentOrders,
      topProducts,
      lowStockItems,
    },
  });
});

// ── User Management ──────────────────────────────────────────────────────────

adminRouter.get("/users", async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt((req.query.page  as string) || "1"));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20")));
  const search = (req.query.search as string) || undefined;
  const role   = (req.query.role   as string) || undefined;
  const status = (req.query.status as string) || undefined;

  const where = {
    ...(search && {
      OR: [
        { name:  { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(role && { role: role as UserRole }),
    ...(status === "active"   && { isActive: true,  deletedAt: null }),
    ...(status === "inactive" && { isActive: false,  deletedAt: null }),
    ...(status === "deleted"  && { deletedAt: { not: null } }),
    ...(status === undefined  && { deletedAt: null }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        deletedAt: true,
        lastLoginAt: true,
        profile: { select: { avatarUrl: true } },
        _count: { select: { orders: true, reviews: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: { users, total, page, limit } });
});

adminRouter.get("/users/:id", async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      deletedAt: true,
      lastLoginAt: true,
      profile: { select: { avatarUrl: true, bio: true } },
      _count: { select: { orders: true, reviews: true, communityPosts: true } },
    },
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ data: user });
});

adminRouter.patch("/users/:id", async (req: Request, res: Response) => {
  const id             = req.params.id as string;
  const { name, role, isActive } = req.body as { name?: string; role?: string; isActive?: boolean };

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name     !== undefined && { name }),
      ...(role     !== undefined && { role: role as UserRole }),
      ...(isActive !== undefined && { isActive }),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  res.json({ data: user });
});

adminRouter.delete("/users/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (id === req.user!.id) {
    res.status(400).json({ message: "Cannot delete your own account" });
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  res.json({ message: "User deleted" });
});

adminRouter.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  const tempPassword = randomBytes(6).toString("hex") + "A1!";
  const hash         = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data:  { passwordHash: hash },
    select: { email: true },
  });

  res.json({ data: { email: user.email, tempPassword } });
});

adminRouter.get("/users/:id/orders", async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where:   { userId: req.params.id as string },
    orderBy: { createdAt: "desc" },
    select:  {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  res.json({ data: orders });
});

adminRouter.get("/users/:id/addresses", async (req: Request, res: Response) => {
  const addresses = await prisma.address.findMany({
    where:   { userId: req.params.id as string },
    orderBy: { createdAt: "desc" },
  });

  res.json({ data: addresses });
});

// ── Storefront Management ────────────────────────────────────────────────────

adminRouter.get("/storefronts", async (_req: Request, res: Response) => {
  const storefronts = await prisma.storefront.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      celebrity: { select: { id: true, name: true, slug: true } },
    },
  });

  res.json({ data: storefronts });
});

adminRouter.patch("/storefronts/:id", async (req: Request, res: Response) => {
  const { isPublished, verified } = req.body as { isPublished?: boolean; verified?: boolean };

  const storefront = await prisma.storefront.update({
    where: { id: req.params.id as string },
    data: {
      ...(isPublished !== undefined && {
        isPublished,
        ...(isPublished && { publishedAt: new Date() }),
      }),
      ...(verified !== undefined && { verified }),
    },
  });

  res.json({ data: storefront });
});

// ── Audit Logs ───────────────────────────────────────────────────────────────

adminRouter.get("/audit-logs", async (req: Request, res: Response) => {
  const page         = Math.max(1, parseInt((req.query.page  as string) || "1"));
  const limit        = Math.min(100, parseInt((req.query.limit as string) || "50"));
  const action       = (req.query.action       as string) || undefined;
  const resourceType = (req.query.resourceType as string) || undefined;

  const where = {
    ...(action       && { action }),
    ...(resourceType && { resourceType }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      take:    limit,
      skip:    (page - 1) * limit,
      orderBy: { createdAt: "desc" },
      select:  {
        id: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
        ipAddress: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data: { logs, total, page, limit } });
});

// ── System Settings ──────────────────────────────────────────────────────────

adminRouter.get("/settings", async (_req: Request, res: Response) => {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  res.json({ data: settings });
});

adminRouter.patch("/settings", async (req: Request, res: Response) => {
  const { key, value, description } = req.body as { key: string; value: string; description?: string };

  if (!key || value === undefined) {
    res.status(400).json({ message: "key and value are required" });
    return;
  }

  const setting = await prisma.systemSetting.upsert({
    where:  { key },
    create: { key, value: String(value), ...(description && { description }) },
    update: { value: String(value),       ...(description && { description }) },
  });

  res.json({ data: setting });
});

adminRouter.delete("/settings/:key", authorize("SUPER_ADMIN"), async (req: Request, res: Response) => {
  await prisma.systemSetting.delete({ where: { key: req.params.key as string } });
  res.json({ message: "Setting deleted" });
});

// ── Notification Broadcast ───────────────────────────────────────────────────

adminRouter.post("/notifications/broadcast", async (req: Request, res: Response) => {
  const { title, body, type = "SYSTEM", roles, actionUrl } = req.body as {
    title:      string;
    body:       string;
    type?:      string;
    roles?:     string[];
    actionUrl?: string;
  };

  if (!title || !body) {
    res.status(400).json({ message: "title and body are required" });
    return;
  }

  const where = {
    isActive:  true,
    deletedAt: null,
    ...(roles?.length && { role: { in: roles as UserRole[] } }),
  };

  const users = await prisma.user.findMany({ where, select: { id: true } });

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId:    u.id,
      type:      type as NotificationType,
      title,
      body,
      actionUrl: actionUrl ?? null,
      isRead:    false,
    })),
  });

  res.json({ data: { sentCount: users.length } });
});

// ── Admin Orders Management ───────────────────────────────────────────────────

const VALID_ORDER_STATUSES: OrderStatus[] = [
  "PLACED","CONFIRMED","PRODUCTION_STARTED","QUALITY_CHECK",
  "SHIPPED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED","RETURN_REQUESTED","REFUNDED",
];

function serializeOrderDetail(order: Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: { orderBy: { createdAt: "desc" } };
    commission: true;
    routing: { include: { manufacturer: { select: { slug: true; name: true } } }; orderBy: { assignedAt: "asc" } };
  };
}>) {
  return {
    id:              order.id,
    orderNumber:     order.orderNumber,
    customerEmail:   order.customerEmail,
    shippingName:    order.shippingName,
    shippingAddress: order.shippingAddress,
    shippingCity:    order.shippingCity,
    shippingState:   order.shippingState,
    shippingPincode: order.shippingPincode,
    subtotal:        Number(order.subtotal),
    shippingAmount:  Number(order.shippingAmount),
    discountAmount:  Number((order as Record<string, unknown>).discountAmount ?? 0),
    total:           Number(order.total),
    status:          order.status,
    paymentStatus:   order.paymentStatus,
    notes:           order.notes ?? null,
    deliveredAt:     order.deliveredAt?.toISOString() ?? null,
    createdAt:       order.createdAt.toISOString(),
    updatedAt:       order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id:          item.id,
      productSlug: item.productSlug,
      productName: item.productName,
      category:    item.category,
      size:        item.size,
      quantity:    (item as Record<string, unknown>).quantity as number ?? 1,
      unitPrice:   Number(item.unitPrice),
      totalPrice:  Number(item.totalPrice),
      imageUrl:    item.imageUrl,
    })),
    payments: order.payments.map((p) => ({
      id:         p.id,
      amount:     Number(p.amount),
      status:     p.status,
      method:     p.method,
      provider:   p.provider,
      capturedAt: p.capturedAt?.toISOString() ?? null,
    })),
    routing: order.routing.map((r) => ({
      id:              r.id,
      manufacturerName: r.manufacturerName,
      manufacturerSlug: r.manufacturer?.slug ?? null,
      trackingCode:    r.trackingCode ?? null,
      status:          r.status,
    })),
    commission: order.commission ? {
      platformFee:         Number(order.commission.platformFee),
      celebrityCommission: Number(order.commission.celebrityCommission),
      manufacturerShare:   Number(order.commission.manufacturerShare),
    } : null,
  };
}

// GET /api/admin/orders — paginated with search & status filter
adminRouter.get("/orders", async (req: Request, res: Response) => {
  const page   = Math.max(1, parseInt((req.query.page  as string) || "1"));
  const limit  = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20")));
  const search = ((req.query.search as string) || "").trim();
  const status = (req.query.status as string) || undefined;

  const where: Prisma.OrderWhereInput = {
    ...(search && {
      OR: [
        { orderNumber:   { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { shippingName:  { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && VALID_ORDER_STATUSES.includes(status as OrderStatus) && { status: status as OrderStatus }),
  };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerEmail: true,
        shippingName: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const orders = rows.map((o) => ({
    ...o,
    total: Number(o.total),
    createdAt: o.createdAt.toISOString(),
  }));

  res.json({ data: { orders, total, page, limit } });
});

// GET /api/admin/orders/:id — full detail
adminRouter.get("/orders/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      commission: true,
      routing: {
        include: { manufacturer: { select: { slug: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
  if (!order) { res.status(404).json({ message: "Order not found" }); return; }
  res.json({ data: serializeOrderDetail(order) });
});

// PATCH /api/admin/orders/:id/status
adminRouter.patch("/orders/:id/status", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body as { status?: string };

  if (!status || !VALID_ORDER_STATUSES.includes(status as OrderStatus)) {
    res.status(400).json({ message: `status must be one of: ${VALID_ORDER_STATUSES.join(", ")}` });
    return;
  }

  const existing = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    select: { id: true },
  });
  if (!existing) { res.status(404).json({ message: "Order not found" }); return; }

  await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: status as OrderStatus,
      ...(status === "DELIVERED" && { deliveredAt: new Date() }),
    },
  });

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: existing.id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      commission: true,
      routing: {
        include: { manufacturer: { select: { slug: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  res.json({ data: serializeOrderDetail(order) });
});

// PATCH /api/admin/orders/:id/tracking
adminRouter.patch("/orders/:id/tracking", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { trackingCode, routingId } = req.body as { trackingCode?: string; routingId?: string };

  if (!trackingCode?.trim()) {
    res.status(400).json({ message: "trackingCode is required" }); return;
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    select: {
      id: true,
      routing: { select: { id: true }, orderBy: { assignedAt: "asc" }, take: 1 },
      items: { select: { id: true, productName: true }, take: 1 },
    },
  });
  if (!order) { res.status(404).json({ message: "Order not found" }); return; }

  let targetId = routingId ?? order.routing[0]?.id;

  // Auto-create routing entry if none exists yet
  if (!targetId && order.items[0]) {
    const newRouting = await prisma.manufacturerRouting.create({
      data: {
        orderId: order.id,
        orderItemId: order.items[0].id,
        manufacturerName: "Assigned",
        trackingCode: trackingCode.trim(),
        assignedAt: new Date(),
      },
    });
    targetId = newRouting.id;
  }

  if (!targetId) {
    res.status(400).json({ message: "No order items found to attach routing" }); return;
  }

  await prisma.manufacturerRouting.update({
    where: { id: targetId },
    data: { trackingCode: trackingCode.trim() },
  });

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      commission: true,
      routing: {
        include: { manufacturer: { select: { slug: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  res.json({ data: serializeOrderDetail(updated) });
});

// POST /api/admin/orders/:id/cancel
adminRouter.post("/orders/:id/cancel", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { reason } = req.body as { reason?: string };

  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    select: { id: true, status: true },
  });
  if (!order) { res.status(404).json({ message: "Order not found" }); return; }

  const terminal = ["DELIVERED", "CANCELLED", "REFUNDED"];
  if (terminal.includes(order.status)) {
    res.status(400).json({ message: `Cannot cancel an order in status ${order.status}` }); return;
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      ...(reason && { notes: reason }),
    },
    select: {
      id: true, orderNumber: true, customerEmail: true, shippingName: true,
      total: true, status: true, paymentStatus: true, createdAt: true,
      _count: { select: { items: true } },
    },
  });

  res.json({ data: { ...updated, total: Number(updated.total), createdAt: updated.createdAt.toISOString() } });
});

// POST /api/admin/orders/:id/refund
adminRouter.post("/orders/:id/refund", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { amount, notes } = req.body as { amount?: number; notes?: string };

  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { payments: { where: { status: "CAPTURED" }, take: 1 } },
  });
  if (!order) { res.status(404).json({ message: "Order not found" }); return; }

  const payment = order.payments[0];
  if (!payment) {
    res.status(400).json({ message: "No captured payment found for this order" }); return;
  }

  const refundAmount = amount ?? Number(order.total);

  const refund = await refundService.initiate({
    orderId:   order.id,
    paymentId: payment.id,
    amount:    refundAmount,
    type:      "MANUAL",
    notes:     notes ?? "Admin manual refund",
    adminId:   req.user!.id,
  });
  await refundService.processManual(refund.id, req.user!.id, notes);

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    select: {
      id: true, orderNumber: true, customerEmail: true, shippingName: true,
      total: true, status: true, paymentStatus: true, createdAt: true,
      _count: { select: { items: true } },
    },
  });

  res.json({ data: { ...updated, total: Number(updated.total), createdAt: updated.createdAt.toISOString() } });
});
