import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceForbiddenError } from "../lib/commerce.errors.js";
import { reservationService } from "./reservation.service.js";

// Order statuses that allow shipment
const PRE_SHIP_STATUSES = new Set(["CONFIRMED", "PRODUCTION_STARTED", "QUALITY_CHECK"]);

export const fulfillmentService = {
  // Get fulfillment status: order status + reservation details
  async getStatus(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        id: true, orderNumber: true, status: true, paymentStatus: true,
        userId: true,
        inventoryReservations: {
          select: {
            id: true, status: true, quantity: true, variantId: true,
            reservedAt: true, allocatedAt: true, releasedAt: true, deductedAt: true,
            warehouse: { select: { id: true, name: true, city: true } },
          },
        },
      },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (userId && order.userId !== userId) throw new CommerceForbiddenError();
    return order;
  },

  // ADMIN / SYSTEM: after payment succeeds — move PLACED → CONFIRMED, RESERVED → ALLOCATED
  async allocate(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");

    if (order.status !== "PLACED") {
      throw new CommerceForbiddenError(
        `Cannot allocate order in status ${order.status} (expected PLACED)`
      );
    }

    await reservationService.allocate(orderId);
    await prisma.order.update({
      where: { id: orderId },
      data:  { status: "CONFIRMED" },
    });
  },

  // ADMIN: physically ship the order — deducts stock, moves to SHIPPED
  async ship(
    orderId: string,
    opts: { trackingCode?: string; carrier?: string } = {}
  ): Promise<void> {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");

    if (!PRE_SHIP_STATUSES.has(order.status)) {
      throw new CommerceForbiddenError(
        `Cannot ship order in status ${order.status} (expected CONFIRMED, PRODUCTION_STARTED, or QUALITY_CHECK)`
      );
    }

    // Deduct stock (ALLOCATED → DEDUCTED, quantity-- reservedQuantity--)
    await reservationService.deduct(orderId);

    await prisma.order.update({
      where: { id: orderId },
      data:  { status: "SHIPPED" },
    });
  },

  // ADMIN: mark order as delivered
  async deliver(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");

    if (order.status !== "SHIPPED" && order.status !== "OUT_FOR_DELIVERY") {
      throw new CommerceForbiddenError(
        `Cannot deliver order in status ${order.status} (expected SHIPPED or OUT_FOR_DELIVERY)`
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data:  { status: "DELIVERED", deliveredAt: new Date() },
    });
  },

  // ADMIN: manually release all active reservations for an order
  async releaseReservations(orderId: string, reason: "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED" = "CANCELLED"): Promise<void> {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");

    await reservationService.release(orderId, reason);
  },
};
