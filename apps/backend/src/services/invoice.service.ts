import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceForbiddenError } from "../lib/commerce.errors.js";

function generateInvoiceNumber(): string {
  const d    = new Date();
  const year = d.getFullYear();
  const mon  = String(d.getMonth() + 1).padStart(2, "0");
  const day  = String(d.getDate()).padStart(2, "0");
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `INV-${year}${mon}${day}-${rand}`;
}

export const invoiceService = {
  // Idempotent: returns existing invoice or creates a new one
  async generateForOrder(orderId: string) {
    const existing = await prisma.invoice.findUnique({ where: { orderId } });
    if (existing) return existing;

    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: {
        items: {
          select: {
            id: true, productName: true, productSlug: true,
            size: true, quantity: true, unitPrice: true, totalPrice: true,
            celebrityName: true, category: true,
          },
        },
        user:   { select: { id: true, email: true, name: true } },
      },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");

    const orderSnapshot = {
      orderNumber:    order.orderNumber,
      status:         order.status,
      subtotal:       order.subtotal,
      discountAmount: order.discountAmount,
      shippingAmount: order.shippingAmount,
      taxAmount:      order.taxAmount,
      total:          order.total,
      couponCode:     order.couponCode,
      items:          order.items,
      taxSnapshot:    order.taxSnapshot,
      createdAt:      order.createdAt,
    };

    const customerSnapshot = {
      name:            order.shippingName,
      email:           order.customerEmail,
      shippingAddress: order.shippingAddress,
      shippingCity:    order.shippingCity,
      shippingState:   order.shippingState,
      shippingPincode: order.shippingPincode,
      phone:           order.shippingPhone,
    };

    return prisma.invoice.create({
      data: {
        orderId,
        invoiceNumber:   generateInvoiceNumber(),
        taxBreakdown:    order.taxSnapshot  as Prisma.InputJsonValue ?? Prisma.JsonNull,
        orderSnapshot:   orderSnapshot      as Prisma.InputJsonValue,
        customerSnapshot: customerSnapshot  as Prisma.InputJsonValue,
      },
    });
  },

  async getForOrder(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { userId: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (userId && order.userId !== userId) throw new CommerceForbiddenError();

    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    if (!invoice) {
      // Auto-generate on first access
      return this.generateForOrder(orderId);
    }
    return invoice;
  },

  async get(invoiceId: string, userId?: string) {
    const invoice = await prisma.invoice.findUnique({
      where:   { id: invoiceId },
      include: { order: { select: { userId: true } } },
    });
    if (!invoice) throw new CommerceNotFoundError("Invoice not found");
    if (userId && invoice.order.userId !== userId) throw new CommerceForbiddenError();
    return invoice;
  },
};
