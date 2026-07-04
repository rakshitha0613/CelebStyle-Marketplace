import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceValidationError } from "../lib/commerce.errors.js";
import { stockMovementService } from "./stock-movement.service.js";

export const inventoryService = {
  // Total available (across all warehouses) for a product
  async getForProduct(productId: string) {
    const rows = await prisma.inventory.findMany({
      where:   { productId },
      include: {
        warehouse: { select: { id: true, name: true, city: true, priority: true, isActive: true } },
        variant:   { select: { id: true, size: true, color: true, sku: true } },
      },
      orderBy: { warehouse: { priority: "asc" } },
    });
    return rows.map((r) => ({
      ...r,
      available: r.quantity - r.reservedQuantity,
    }));
  },

  // Available units for a specific variant (sum across warehouses)
  async getAvailableForVariant(variantId: string): Promise<number> {
    const agg = await prisma.inventory.aggregate({
      where: { variantId },
      _sum:  { quantity: true, reservedQuantity: true },
    });
    return (agg._sum.quantity ?? 0) - (agg._sum.reservedQuantity ?? 0);
  },

  // ADMIN: manual stock adjustment (positive = add, negative = remove)
  async adjust(
    warehouseId: string,
    variantId:   string,
    delta:       number,
    notes?:      string,
    adminId?:    string
  ) {
    if (delta === 0) throw new CommerceValidationError("Adjustment delta cannot be zero");

    const inv = await prisma.inventory.findFirst({ where: { variantId, warehouseId } });
    if (!inv) throw new CommerceNotFoundError("Inventory record not found for this variant/warehouse");

    const newQty = inv.quantity + delta;
    if (newQty < 0) {
      throw new CommerceValidationError(
        `Cannot reduce stock below zero (current: ${inv.quantity}, delta: ${delta})`
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inv.id },
        data:  { quantity: newQty },
      }),
      stockMovementService.buildRecord({
        inventoryId:    inv.id,
        type:           "ADJUSTMENT",
        quantityChange: delta,
        quantityBefore: inv.quantity,
        quantityAfter:  newQty,
        notes,
        createdById:    adminId,
      }),
    ]);

    return updated;
  },

  // ADMIN: inbound restock (always positive)
  async restock(
    warehouseId: string,
    variantId:   string,
    productId:   string,
    quantity:    number,
    notes?:      string,
    adminId?:    string
  ) {
    if (quantity <= 0) throw new CommerceValidationError("Restock quantity must be positive");

    // Upsert inventory record
    const existing = await prisma.inventory.findFirst({ where: { variantId, warehouseId } });

    let inv: Prisma.InventoryGetPayload<object>;
    if (existing) {
      const [updated] = await prisma.$transaction([
        prisma.inventory.update({
          where: { id: existing.id },
          data:  { quantity: { increment: quantity } },
        }),
        stockMovementService.buildRecord({
          inventoryId:    existing.id,
          type:           "INBOUND",
          quantityChange: quantity,
          quantityBefore: existing.quantity,
          quantityAfter:  existing.quantity + quantity,
          referenceType:  "RESTOCK",
          notes,
          createdById:    adminId,
        }),
      ]);
      inv = updated;
    } else {
      // First-time inventory for this variant/warehouse combo
      inv = await prisma.inventory.create({
        data: { productId, variantId, warehouseId, quantity },
      });
      await stockMovementService.record({
        inventoryId:    inv.id,
        type:           "INBOUND",
        quantityChange: quantity,
        quantityBefore: 0,
        quantityAfter:  quantity,
        referenceType:  "RESTOCK",
        notes,
        createdById:    adminId,
      });
    }

    return inv;
  },
};
