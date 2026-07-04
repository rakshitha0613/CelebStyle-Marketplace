import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError } from "../lib/commerce.errors.js";

export const commissionService = {
  async getForOrder(orderId: string) {
    const commission = await prisma.orderCommission.findUnique({ where: { orderId } });
    if (!commission) throw new CommerceNotFoundError("Commission record not found for this order");
    return commission;
  },

  // Aggregate revenue report across all settled/unsettled orders
  async report(filters: { from?: Date; to?: Date; settled?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.settled !== undefined) {
      where["settledAt"] = filters.settled ? { not: null } : null;
    }
    if (filters.from || filters.to) {
      where["order"] = { createdAt: { gte: filters.from, lte: filters.to } };
    }

    const agg = await prisma.orderCommission.aggregate({
      where,
      _sum: {
        platformFee:         true,
        celebrityCommission: true,
        manufacturerShare:   true,
      },
      _count: { id: true },
    });

    const settled   = await prisma.orderCommission.count({ where: { settledAt: { not: null } } });
    const unsettled = await prisma.orderCommission.count({ where: { settledAt: null } });

    return {
      count:               agg._count.id,
      platformRevenue:     agg._sum.platformFee         ?? 0,
      celebrityRevenue:    agg._sum.celebrityCommission ?? 0,
      manufacturerRevenue: agg._sum.manufacturerShare   ?? 0,
      settled,
      unsettled,
    };
  },

  // List individual commission records (admin)
  async list(filters: { settled?: boolean; limit?: number; offset?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.settled !== undefined) {
      where["settledAt"] = filters.settled ? { not: null } : null;
    }

    const [commissions, total] = await prisma.$transaction([
      prisma.orderCommission.findMany({
        where,
        include: { order: { select: { orderNumber: true, total: true, status: true, createdAt: true } } },
        orderBy: { order: { createdAt: "desc" } },
        take:   filters.limit  ?? 50,
        skip:   filters.offset ?? 0,
      }),
      prisma.orderCommission.count({ where }),
    ]);

    return { commissions, total };
  },
};
