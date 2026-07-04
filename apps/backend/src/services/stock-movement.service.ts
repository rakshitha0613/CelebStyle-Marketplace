import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type StockMovementInput = {
  inventoryId:    string;
  type:           "INBOUND" | "OUTBOUND" | "RETURN" | "ADJUSTMENT" | "TRANSFER" | "WRITE_OFF" | "RESERVATION" | "RELEASE";
  quantityChange: number;
  quantityBefore: number;
  quantityAfter:  number;
  referenceId?:   string;
  referenceType?: string;
  notes?:         string;
  createdById?:   string;
};

export const stockMovementService = {
  async record(input: StockMovementInput): Promise<void> {
    await prisma.stockMovement.create({
      data: {
        inventoryId:    input.inventoryId,
        type:           input.type,
        quantityChange: input.quantityChange,
        quantityBefore: input.quantityBefore,
        quantityAfter:  input.quantityAfter,
        referenceId:    input.referenceId    ?? null,
        referenceType:  input.referenceType  ?? null,
        notes:          input.notes          ?? null,
        createdById:    input.createdById    ?? null,
      },
    });
  },

  buildRecord(input: StockMovementInput): Prisma.PrismaPromise<unknown> {
    return prisma.stockMovement.create({
      data: {
        inventoryId:    input.inventoryId,
        type:           input.type,
        quantityChange: input.quantityChange,
        quantityBefore: input.quantityBefore,
        quantityAfter:  input.quantityAfter,
        referenceId:    input.referenceId    ?? null,
        referenceType:  input.referenceType  ?? null,
        notes:          input.notes          ?? null,
        createdById:    input.createdById    ?? null,
      },
    });
  },

  async getForInventory(inventoryId: string, limit = 50): Promise<Prisma.StockMovementGetPayload<object>[]> {
    return prisma.stockMovement.findMany({
      where:   { inventoryId },
      orderBy: { createdAt: "desc" },
      take:    limit,
    });
  },

  async getForOrder(orderId: string): Promise<Prisma.StockMovementGetPayload<object>[]> {
    const reservations = await prisma.inventoryReservation.findMany({
      where:  { orderId },
      select: { inventoryId: true },
    });
    const inventoryIds = [...new Set(reservations.map((r) => r.inventoryId))];
    if (inventoryIds.length === 0) return [];

    return prisma.stockMovement.findMany({
      where:   { inventoryId: { in: inventoryIds }, referenceId: orderId },
      orderBy: { createdAt: "desc" },
    });
  },
};
