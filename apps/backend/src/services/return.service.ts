import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceValidationError, CommerceForbiddenError } from "../lib/commerce.errors.js";

const RETURNABLE_STATUSES = new Set(["DELIVERED"]);

export const returnService = {
  // Customer: create a return request (order must be DELIVERED)
  async create(input: {
    userId:      string;
    orderId:     string;
    reason:      string;
    description?: string;
    items:        Array<{ orderItemId: string; quantity: number; reason?: string }>;
  }) {
    const order = await prisma.order.findUnique({
      where:   { id: input.orderId },
      include: { items: { select: { id: true, quantity: true } } },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (order.userId !== input.userId) throw new CommerceForbiddenError();
    if (!RETURNABLE_STATUSES.has(order.status)) {
      throw new CommerceValidationError(
        `Cannot return order in status ${order.status} — only DELIVERED orders are eligible`
      );
    }

    // Check no active return already exists
    const existing = await prisma.return.findFirst({
      where: { orderId: input.orderId, status: { notIn: ["REJECTED", "REFUND_COMPLETED"] } },
    });
    if (existing) throw new CommerceValidationError("An active return already exists for this order");

    // Validate items belong to the order
    const orderItemIds = new Set(order.items.map((i) => i.id));
    for (const ri of input.items) {
      if (!orderItemIds.has(ri.orderItemId)) {
        throw new CommerceValidationError(`Order item ${ri.orderItemId} does not belong to this order`);
      }
      const orderItem = order.items.find((i) => i.id === ri.orderItemId)!;
      if (ri.quantity > orderItem.quantity) {
        throw new CommerceValidationError(
          `Cannot return ${ri.quantity} of item ${ri.orderItemId} — order only has ${orderItem.quantity}`
        );
      }
    }

    const [ret] = await prisma.$transaction([
      prisma.return.create({
        data: {
          orderId:     input.orderId,
          userId:      input.userId,
          reason:      input.reason as never,
          description: input.description,
          status:      "REQUESTED",
          items: {
            create: input.items.map((i) => ({
              orderItemId: i.orderItemId,
              quantity:    i.quantity,
              reason:      i.reason,
            })),
          },
        },
        include: { items: true },
      }),
      prisma.order.update({
        where: { id: input.orderId },
        data:  { status: "RETURN_REQUESTED" },
      }),
    ]);

    return ret;
  },

  // ADMIN: approve return
  async approve(returnId: string, adminId: string) {
    const ret = await prisma.return.findUnique({ where: { id: returnId } });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (ret.status !== "REQUESTED") {
      throw new CommerceValidationError(`Cannot approve return in status ${ret.status}`);
    }
    return prisma.return.update({
      where: { id: returnId },
      data:  { status: "APPROVED", approvedAt: new Date(), approvedById: adminId },
      include: { items: true },
    });
  },

  // ADMIN: reject return
  async reject(returnId: string, adminId: string, reason?: string) {
    const ret = await prisma.return.findUnique({ where: { id: returnId } });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (!["REQUESTED", "APPROVED"].includes(ret.status)) {
      throw new CommerceValidationError(`Cannot reject return in status ${ret.status}`);
    }
    return prisma.$transaction([
      prisma.return.update({
        where: { id: returnId },
        data:  { status: "REJECTED", approvedById: adminId, description: reason ?? ret.description },
      }),
      prisma.order.update({
        where: { id: ret.orderId },
        data:  { status: "DELIVERED" },  // restore order status
      }),
    ]);
  },

  // ADMIN: mark return as picked up
  async markPickedUp(returnId: string, trackingCode?: string) {
    const ret = await prisma.return.findUnique({ where: { id: returnId } });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (ret.status !== "APPROVED") {
      throw new CommerceValidationError(`Cannot mark pickup for return in status ${ret.status}`);
    }
    return prisma.$transaction([
      prisma.return.update({
        where: { id: returnId },
        data:  { status: "PICKED_UP", trackingCode: trackingCode ?? ret.trackingCode },
      }),
      prisma.order.update({
        where: { id: ret.orderId },
        data:  { status: "RETURN_PICKED" },
      }),
    ]);
  },

  // ADMIN: mark return as received at warehouse
  async markReceived(returnId: string) {
    const ret = await prisma.return.findUnique({ where: { id: returnId } });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (ret.status !== "PICKED_UP") {
      throw new CommerceValidationError(`Cannot mark received for return in status ${ret.status}`);
    }
    return prisma.return.update({
      where: { id: returnId },
      data:  { status: "RECEIVED" },
    });
  },

  // ADMIN: complete return after inspection — triggers refund
  async complete(returnId: string, adminId: string, refundAmount: number) {
    const ret = await prisma.return.findUnique({
      where:   { id: returnId },
      include: { order: { include: { payments: true } } },
    });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (ret.status !== "RECEIVED") {
      throw new CommerceValidationError(`Cannot complete return in status ${ret.status}`);
    }
    if (refundAmount <= 0) throw new CommerceValidationError("Refund amount must be positive");

    const capturedPayment = ret.order.payments.find((p) => p.status === "CAPTURED");
    if (!capturedPayment) throw new CommerceValidationError("No captured payment found for this order");
    if (refundAmount > capturedPayment.amount - capturedPayment.refundedAmount) {
      throw new CommerceValidationError("Refund amount exceeds refundable balance");
    }

    await prisma.$transaction([
      prisma.return.update({
        where: { id: returnId },
        data:  { status: "REFUND_INITIATED", refundAmount, completedAt: new Date() },
      }),
      prisma.refund.create({
        data: {
          returnId,
          orderId:   ret.orderId,
          paymentId: capturedPayment.id,
          amount:    refundAmount,
          type:      "FULL",
          status:    "PENDING",
          notes:     `Return inspection complete — approved by admin ${adminId}`,
          processedById: adminId,
        },
      }),
    ]);

    return prisma.return.findUnique({
      where:   { id: returnId },
      include: { items: true, refund: true },
    });
  },

  async get(returnId: string, userId?: string) {
    const ret = await prisma.return.findUnique({
      where:   { id: returnId },
      include: { items: { include: { orderItem: { select: { productName: true, size: true, quantity: true } } } }, refund: true },
    });
    if (!ret) throw new CommerceNotFoundError("Return not found");
    if (userId && ret.userId !== userId) throw new CommerceForbiddenError();
    return ret;
  },

  async getForOrder(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (userId && order.userId !== userId) throw new CommerceForbiddenError();
    return prisma.return.findMany({
      where:   { orderId },
      include: { items: true, refund: true },
      orderBy: { requestedAt: "desc" },
    });
  },

  async getForUser(userId: string) {
    return prisma.return.findMany({
      where:   { userId },
      include: { items: true, refund: true },
      orderBy: { requestedAt: "desc" },
    });
  },

  async list(filters: { status?: string; limit?: number; offset?: number } = {}) {
    const where = filters.status ? { status: filters.status as never } : {};
    const [returns, total] = await prisma.$transaction([
      prisma.return.findMany({
        where,
        include: { items: true, refund: true },
        orderBy: { requestedAt: "desc" },
        take:   filters.limit  ?? 50,
        skip:   filters.offset ?? 0,
      }),
      prisma.return.count({ where }),
    ]);
    return { returns, total };
  },
};
