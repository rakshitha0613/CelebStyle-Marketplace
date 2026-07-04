import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { InsufficientStockError } from "../lib/commerce.errors.js";
import { stockMovementService } from "./stock-movement.service.js";

export type ReservationPlan = {
  inventoryId:       string;
  warehouseId:       string;
  variantId:         string;
  quantity:          number;
  quantityBefore:    number;    // physical qty before CAS
  reservedBefore:    number;    // reservedQty before CAS
};

// Called by checkout.service.ts before the main $transaction.
// For each item that has a known variant, finds the best warehouse and
// atomically increments reservedQuantity using a CAS raw-SQL update.
// If any reservation fails (race condition), rolls back all previously
// reserved items and throws InsufficientStockError.
export async function planAndReserve(
  items: Array<{ variantId: string; quantity: number }>
): Promise<ReservationPlan[]> {
  const committed: ReservationPlan[] = [];

  for (const item of items) {
    // Find highest-priority warehouse with enough stock
    const inv = await prisma.inventory.findFirst({
      where:   { variantId: item.variantId, warehouse: { isActive: true } },
      include: { warehouse: { select: { id: true, priority: true } } },
      orderBy: { warehouse: { priority: "asc" } },
    });

    if (!inv) continue; // No inventory record → treat as unlimited, skip

    const available = inv.quantity - inv.reservedQuantity;
    if (available < item.quantity) {
      await rollbackPlans(committed);
      throw new InsufficientStockError(available, item.quantity);
    }

    // Atomic CAS: only update if still enough available (prevents race conditions)
    const updated = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Inventory"
      SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
      WHERE id = ${inv.id}
        AND ("quantity" - "reservedQuantity") >= ${item.quantity}
      RETURNING id
    `;

    if (updated.length === 0) {
      // Race condition: concurrent checkout grabbed the stock between our read and write
      await rollbackPlans(committed);
      throw new InsufficientStockError(0, item.quantity);
    }

    committed.push({
      inventoryId:    inv.id,
      warehouseId:    inv.warehouseId,
      variantId:      item.variantId,
      quantity:       item.quantity,
      quantityBefore: inv.quantity,
      reservedBefore: inv.reservedQuantity,
    });
  }

  return committed;
}

// Undo CAS reservations (called in catch block if order creation fails)
export async function rollbackPlans(plans: ReservationPlan[]): Promise<void> {
  for (const plan of plans) {
    await prisma.inventory.update({
      where: { id: plan.inventoryId },
      data:  { reservedQuantity: { decrement: plan.quantity } },
    }).catch((err) => {
      console.error("[reservation] Failed to rollback plan:", plan.inventoryId, err);
    });
  }
}

// Build Prisma operations for the main batch:
// - InventoryReservation creates (need orderId / orderItemId pre-generated)
// - StockMovement creates (RESERVATION type)
export function buildBatchOps(
  plans: ReservationPlan[],
  mapping: Array<{ orderId: string; orderItemId: string; planIndex: number }>
): Prisma.PrismaPromise<unknown>[] {
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const m of mapping) {
    const plan = plans[m.planIndex];
    if (!plan) continue;

    ops.push(
      prisma.inventoryReservation.create({
        data: {
          orderId:     m.orderId,
          orderItemId: m.orderItemId,
          inventoryId: plan.inventoryId,
          warehouseId: plan.warehouseId,
          variantId:   plan.variantId,
          quantity:    plan.quantity,
          status:      "RESERVED",
        },
      })
    );

    ops.push(
      stockMovementService.buildRecord({
        inventoryId:    plan.inventoryId,
        type:           "RESERVATION",
        quantityChange: plan.quantity,
        quantityBefore: plan.reservedBefore,
        quantityAfter:  plan.reservedBefore + plan.quantity,
        referenceId:    m.orderId,
        referenceType:  "ORDER",
        notes:          `Checkout reservation — qty ${plan.quantity}`,
      })
    );
  }

  return ops;
}

export const reservationService = {
  // Update all RESERVED reservations for an order to ALLOCATED.
  // Called after payment is captured.
  async allocate(orderId: string): Promise<void> {
    await prisma.inventoryReservation.updateMany({
      where: { orderId, status: "RESERVED" },
      data:  { status: "ALLOCATED", allocatedAt: new Date() },
    });
  },

  // Release all active reservations for an order (payment failed, order cancelled, etc.)
  // Decrements reservedQuantity for each reservation, creates RELEASE StockMovement.
  async release(orderId: string, reason: "PAYMENT_FAILED" | "EXPIRED" | "CANCELLED"): Promise<void> {
    const reservations = await prisma.inventoryReservation.findMany({
      where:   { orderId, status: { in: ["RESERVED", "ALLOCATED"] } },
      include: { inventory: true },
    });

    if (reservations.length === 0) return;

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const res of reservations) {
      ops.push(
        prisma.inventoryReservation.update({
          where: { id: res.id },
          data:  { status: "RELEASED", releasedAt: new Date() },
        })
      );
      ops.push(
        prisma.inventory.update({
          where: { id: res.inventoryId },
          data:  { reservedQuantity: { decrement: res.quantity } },
        })
      );
      ops.push(
        stockMovementService.buildRecord({
          inventoryId:    res.inventoryId,
          type:           "RELEASE",
          quantityChange: -res.quantity,
          quantityBefore: res.inventory.reservedQuantity,
          quantityAfter:  res.inventory.reservedQuantity - res.quantity,
          referenceId:    orderId,
          referenceType:  "ORDER",
          notes:          `Reservation released — reason: ${reason}`,
        })
      );
    }

    await prisma.$transaction(ops);
  },

  // Deduct stock when order is shipped.
  // Converts reservedQuantity into an actual OUTBOUND — decrements both quantity and reservedQuantity.
  async deduct(orderId: string): Promise<void> {
    const reservations = await prisma.inventoryReservation.findMany({
      where:   { orderId, status: "ALLOCATED" },
      include: { inventory: true },
    });

    if (reservations.length === 0) return;

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    for (const res of reservations) {
      ops.push(
        prisma.inventoryReservation.update({
          where: { id: res.id },
          data:  { status: "DEDUCTED", deductedAt: new Date() },
        })
      );
      ops.push(
        prisma.inventory.update({
          where: { id: res.inventoryId },
          data: {
            quantity:         { decrement: res.quantity },
            reservedQuantity: { decrement: res.quantity },
          },
        })
      );
      ops.push(
        stockMovementService.buildRecord({
          inventoryId:    res.inventoryId,
          type:           "OUTBOUND",
          quantityChange: -res.quantity,
          quantityBefore: res.inventory.quantity,
          quantityAfter:  res.inventory.quantity - res.quantity,
          referenceId:    orderId,
          referenceType:  "ORDER",
          notes:          `Shipped — qty ${res.quantity}`,
        })
      );
    }

    await prisma.$transaction(ops);
  },

  async getForOrder(orderId: string) {
    return prisma.inventoryReservation.findMany({
      where:   { orderId },
      include: {
        warehouse: { select: { id: true, name: true, city: true } },
        inventory: { select: { quantity: true, reservedQuantity: true } },
      },
      orderBy: { reservedAt: "desc" },
    });
  },
};
