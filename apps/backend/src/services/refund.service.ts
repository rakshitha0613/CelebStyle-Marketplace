import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CommerceNotFoundError, CommerceValidationError, CommerceForbiddenError } from "../lib/commerce.errors.js";
import { getGateway } from "../payments/gateway.factory.js";

export const refundService = {
  // ADMIN / system: create a refund record
  async initiate(input: {
    orderId:   string;
    paymentId: string;
    amount:    number;
    type?:     "FULL" | "PARTIAL" | "AUTOMATIC" | "MANUAL" | "GATEWAY";
    returnId?: string;
    notes?:    string;
    adminId?:  string;
  }) {
    const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) throw new CommerceNotFoundError("Payment not found");
    if (payment.orderId !== input.orderId) throw new CommerceValidationError("Payment does not belong to this order");
    if (payment.status !== "CAPTURED" && payment.status !== "PARTIALLY_REFUNDED") {
      throw new CommerceValidationError(`Cannot refund payment in status ${payment.status}`);
    }

    const refundable = payment.amount - payment.refundedAmount;
    if (input.amount <= 0) throw new CommerceValidationError("Refund amount must be positive");
    if (input.amount > refundable) {
      throw new CommerceValidationError(
        `Refund amount ${input.amount} exceeds refundable balance ${refundable}`
      );
    }

    // Prevent duplicate refund for same return
    if (input.returnId) {
      const dup = await prisma.refund.findUnique({ where: { returnId: input.returnId } });
      if (dup) throw new CommerceValidationError("A refund already exists for this return");
    }

    const type = input.type ?? (input.amount === payment.amount ? "FULL" : "PARTIAL");

    return prisma.refund.create({
      data: {
        orderId:       input.orderId,
        paymentId:     input.paymentId,
        returnId:      input.returnId ?? null,
        amount:        input.amount,
        type:          type as never,
        status:        "PENDING",
        notes:         input.notes,
        processedById: input.adminId ?? null,
      },
    });
  },

  // ADMIN: process via gateway (calls gateway.refundPayment, marks REFUNDED)
  async processGateway(refundId: string, adminId: string) {
    const refund = await prisma.refund.findUnique({
      where:   { id: refundId },
      include: { payment: true, order: true },
    });
    if (!refund) throw new CommerceNotFoundError("Refund not found");
    if (refund.status !== "PENDING") {
      throw new CommerceValidationError(`Refund already in status ${refund.status}`);
    }

    let providerRefundId: string | undefined;

    if (refund.payment.provider !== "SIMULATED" && refund.payment.providerPaymentId) {
      const gateway = getGateway();
      try {
        const result = await gateway.refundPayment({
          gatewayPaymentId: refund.payment.providerPaymentId,
          amountPaise:      refund.amount,
          reason:           refund.notes ?? "Customer return",
        });
        providerRefundId = result.refundId;
      } catch (err) {
        throw new CommerceValidationError(`Gateway refund failed: ${(err as Error).message}`);
      }
    } else {
      // Simulated / COD — generate a local refund ID
      providerRefundId = `sim_refund_${Date.now()}`;
    }

    const newRefundedAmount = refund.payment.refundedAmount + refund.amount;
    const paymentStatus = newRefundedAmount >= refund.payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
    const orderStatus   = paymentStatus === "REFUNDED" ? "REFUNDED" : refund.order.status;

    await prisma.$transaction([
      prisma.refund.update({
        where: { id: refundId },
        data: {
          status:          "REFUNDED",
          providerRefundId,
          processedAt:     new Date(),
          processedById:   adminId,
        },
      }),
      prisma.payment.update({
        where: { id: refund.paymentId },
        data:  { refundedAmount: newRefundedAmount, status: paymentStatus as never },
      }),
      prisma.order.update({
        where: { id: refund.orderId },
        data:  { status: orderStatus as never, paymentStatus: paymentStatus as never },
      }),
      // Update Return status if linked
      ...(refund.returnId
        ? [prisma.return.update({
            where: { id: refund.returnId },
            data:  { status: "REFUND_COMPLETED" },
          })]
        : []),
    ]);

    return prisma.refund.findUnique({ where: { id: refundId } });
  },

  // ADMIN: manual refund (mark processed without calling gateway — e.g. wallet credit)
  async processManual(refundId: string, adminId: string, notes?: string) {
    const refund = await prisma.refund.findUnique({
      where:   { id: refundId },
      include: { payment: true, order: true },
    });
    if (!refund) throw new CommerceNotFoundError("Refund not found");
    if (refund.status !== "PENDING") {
      throw new CommerceValidationError(`Refund already in status ${refund.status}`);
    }

    const newRefundedAmount = refund.payment.refundedAmount + refund.amount;
    const paymentStatus = newRefundedAmount >= refund.payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
    const orderStatus   = paymentStatus === "REFUNDED" ? "REFUNDED" : refund.order.status;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.refund.update({
        where: { id: refundId },
        data: {
          status:        "REFUNDED",
          processedAt:   new Date(),
          processedById: adminId,
          type:          "MANUAL",
          notes:         notes ?? refund.notes,
        },
      }),
      prisma.payment.update({
        where: { id: refund.paymentId },
        data:  { refundedAmount: newRefundedAmount, status: paymentStatus as never },
      }),
      prisma.order.update({
        where: { id: refund.orderId },
        data:  { status: orderStatus as never, paymentStatus: paymentStatus as never },
      }),
    ];

    if (refund.returnId) {
      ops.push(
        prisma.return.update({
          where: { id: refund.returnId },
          data:  { status: "REFUND_COMPLETED" },
        })
      );
    }

    await prisma.$transaction(ops);
    return prisma.refund.findUnique({ where: { id: refundId } });
  },

  async get(refundId: string) {
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new CommerceNotFoundError("Refund not found");
    return refund;
  },

  async getForOrder(orderId: string) {
    return prisma.refund.findMany({
      where:   { orderId },
      orderBy: { createdAt: "desc" },
    });
  },
};
