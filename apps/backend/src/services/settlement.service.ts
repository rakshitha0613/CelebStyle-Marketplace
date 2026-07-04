import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";

export const settlementService = {
  // Calculate settlement amounts from the order's commission record
  async calculate(orderId: string) {
    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { commission: true, refunds: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (!order.commission) throw new CommerceValidationError("Order has no commission record");

    const totalRefunded = order.refunds
      .filter((r) => r.status === "REFUNDED")
      .reduce((s, r) => s + r.amount, 0);

    const netSubtotal = order.subtotal - totalRefunded;

    // Apply commission percentages to net amount
    const platformFee         = Math.round(netSubtotal * Number(order.commission.platformFeePercent)  / 100);
    const celebrityCommission = Math.round(netSubtotal * Number(order.commission.celebrityPercent)    / 100);
    const manufacturerShare   = Math.round(netSubtotal * Number(order.commission.manufacturerPercent) / 100);

    // Simple TDS deduction: 5% of celebrity commission (India TDS on commissions)
    const taxDeducted = Math.round(celebrityCommission * 0.05);

    return {
      platformFee,
      celebrityCommission,
      manufacturerShare,
      taxDeducted,
      netCelebrityAmount:    celebrityCommission - taxDeducted,
      netManufacturerAmount: manufacturerShare,
      totalRefunded,
      netSubtotal,
    };
  },

  // ADMIN: create a settlement record for an order
  async createForOrder(orderId: string, adminId: string, notes?: string) {
    const order = await prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true, settlement: true },
    });
    if (!order) throw new CommerceNotFoundError("Order not found");
    if (order.settlement) throw new CommerceValidationError("Settlement already exists for this order");
    if (!["DELIVERED", "REFUNDED"].includes(order.status)) {
      throw new CommerceValidationError(
        `Cannot settle order in status ${order.status} — must be DELIVERED or REFUNDED`
      );
    }

    const calc = await this.calculate(orderId);

    return prisma.settlement.create({
      data: {
        orderId,
        platformFee:           calc.platformFee,
        celebrityCommission:   calc.celebrityCommission,
        manufacturerShare:     calc.manufacturerShare,
        taxDeducted:           calc.taxDeducted,
        netCelebrityAmount:    calc.netCelebrityAmount,
        netManufacturerAmount: calc.netManufacturerAmount,
        status:                "PENDING",
        settledById:           adminId,
        notes,
      },
    });
  },

  // ADMIN: mark a settlement as paid out
  async markPaid(settlementId: string, adminId: string) {
    const s = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new CommerceNotFoundError("Settlement not found");
    if (s.status === "COMPLETED") throw new CommerceValidationError("Settlement already completed");

    const [updated] = await prisma.$transaction([
      prisma.settlement.update({
        where: { id: settlementId },
        data:  { status: "COMPLETED", settledAt: new Date(), settledById: adminId },
      }),
      prisma.orderCommission.updateMany({
        where: { orderId: s.orderId },
        data:  { settledAt: new Date(), settledById: adminId },
      }),
    ]);
    return updated;
  },

  async get(settlementId: string) {
    const s = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new CommerceNotFoundError("Settlement not found");
    return s;
  },

  async getForOrder(orderId: string) {
    return prisma.settlement.findUnique({ where: { orderId } });
  },

  async list(filters: { status?: string; limit?: number; offset?: number } = {}) {
    const where = filters.status ? { status: filters.status as never } : {};
    const [settlements, total] = await prisma.$transaction([
      prisma.settlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:   filters.limit  ?? 50,
        skip:   filters.offset ?? 0,
      }),
      prisma.settlement.count({ where }),
    ]);
    return { settlements, total };
  },

  // ADMIN: aggregate revenue report
  async report(filters: { from?: Date; to?: Date } = {}) {
    const where = {
      ...(filters.from || filters.to
        ? { createdAt: { gte: filters.from, lte: filters.to } }
        : {}),
    };

    const agg = await prisma.settlement.aggregate({
      where,
      _sum: {
        platformFee:           true,
        celebrityCommission:   true,
        manufacturerShare:     true,
        taxDeducted:           true,
        netCelebrityAmount:    true,
        netManufacturerAmount: true,
      },
      _count: { id: true },
    });

    const byStatus = await prisma.settlement.groupBy({
      by:    ["status"],
      where,
      _count: { id: true },
      _sum:   { platformFee: true },
    });

    return {
      totals: {
        count:                 agg._count.id,
        platformFee:           agg._sum.platformFee           ?? 0,
        celebrityCommission:   agg._sum.celebrityCommission   ?? 0,
        manufacturerShare:     agg._sum.manufacturerShare     ?? 0,
        taxDeducted:           agg._sum.taxDeducted           ?? 0,
        netCelebrityAmount:    agg._sum.netCelebrityAmount    ?? 0,
        netManufacturerAmount: agg._sum.netManufacturerAmount ?? 0,
      },
      byStatus: byStatus.map((r) => ({
        status:      r.status,
        count:       r._count.id,
        platformFee: r._sum.platformFee ?? 0,
      })),
    };
  },
};
