import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { celebrityStore } from "./celebrities.js";
import { outfitStore } from "./outfits.js";
import { orderRepository } from "../repositories/order.repository.js";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";
import { refundService } from "../services/refund.service.js";
import { sendOrderConfirmation, sendOrderShipped } from "../services/email.service.js";

// ── Public type re-exports ─────────────────────────────────────────────────────
export type {
  OrderStatus,
  PaymentStatus,
  OrderItem,
  OrderEntry,
} from "../repositories/order.repository.js";

// ── Router ─────────────────────────────────────────────────────────────────────
export const ordersRouter = Router();

// GET orders — ADMIN/SUPER_ADMIN returns all; any authenticated user returns own orders
ordersRouter.get("/", authenticate, async (req: Request, res: Response) => {
  const role = req.user!.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const orders = isAdmin
    ? await orderRepository.findAll()
    : await orderRepository.findByCustomerEmail(req.user!.email);
  res.json({ data: orders });
});

// GET single order — authenticated; owner or admin may view
ordersRouter.get("/:id", authenticate, async (req: Request, res: Response) => {
  const order = await orderRepository.findByOrderNumber(req.params.id as string);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  const role = req.user!.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  if (!isAdmin && order.customerEmail !== req.user!.email) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  res.json({ data: order });
});

// POST create order — any authenticated user
ordersRouter.post("/", authenticate, async (req: Request, res: Response) => {
  const { customerName, customerEmail, address, items, paymentMethod = "Razorpay Demo" } =
    req.body as Record<string, unknown>;

  if (
    !customerName ||
    !customerEmail ||
    !address ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    res
      .status(400)
      .json({ message: "customerName, customerEmail, address, and items are required" });
    return;
  }

  if (
    typeof customerName === "string" && customerName.length > 200 ||
    typeof customerEmail === "string" && customerEmail.length > 254 ||
    typeof address === "string" && address.length > 1000 ||
    items.length > 50
  ) {
    res.status(400).json({ message: "Request fields exceed maximum allowed length" });
    return;
  }

  // Enrich cart items with outfit/celebrity data from the compatibility stores
  const normalizedItems = (items as any[]).map((item) => {
    const outfit = outfitStore.find((entry) => entry.id === item.outfitId);
    const celebrity = celebrityStore.find(
      (entry) => entry.id === (outfit?.celebrityId || item.celebrityId)
    );
    return {
      outfitId: (item.outfitId as string) ?? "",
      outfitName: (item.outfitName as string) || outfit?.movieName || "Unknown look",
      celebrityId: outfit?.celebrityId || (item.celebrityId as string) || "",
      celebrityName:
        celebrity?.name || (item.celebrityName as string) || "Unknown celebrity",
      category: (item.category as string) || outfit?.category || "Look",
      price: Number(item.price) || Number(outfit?.price) || 0,
      size: (item.size as string) || "M",
      imageUrl: (item.imageUrl as string) || outfit?.imageUrl || "",
      manufacturerIds: Array.isArray(item.manufacturerIds)
        ? (item.manufacturerIds as string[])
        : outfit?.manufacturerIds || [],
    };
  });

  const order = await orderRepository.create({
    customerName: customerName as string,
    customerEmail: customerEmail as string,
    address: address as string,
    paymentMethod: paymentMethod as string,
    items: normalizedItems,
    userId: req.user!.id,
  });

  const orderTotal = normalizedItems.reduce((s: number, i: { price: number; size: string }) => s + i.price, 0);
  sendOrderConfirmation(customerEmail as string, order.id, orderTotal).catch(() => {});

  res.status(201).json({ data: order });
});

// POST pay — authenticated; owner or admin
ordersRouter.post("/:id/pay", authenticate, async (req: Request, res: Response) => {
  const existing = await orderRepository.findByOrderNumber(req.params.id as string);
  if (!existing) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  const role = req.user!.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  if (!isAdmin && existing.customerEmail !== req.user!.email) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const order = await orderRepository.pay(req.params.id as string);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json({ data: order });
});

// PATCH status — ADMIN / SUPER_ADMIN only
ordersRouter.patch("/:id/status", authenticate, authorize("ADMIN", "SUPER_ADMIN"), async (req: Request, res: Response) => {
  const status = (req.body as Record<string, unknown>).status as string | undefined;
  if (!status) {
    res.status(400).json({ message: "status is required" });
    return;
  }
  const order = await orderRepository.updateStatus(req.params.id as string, status);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  if (status === "SHIPPED" && order.customerEmail) {
    sendOrderShipped(order.customerEmail, order.id, order.id).catch(() => {});
  }
  res.json({ data: order });
});

// GET /api/orders/:orderId/refunds — auth (owner or admin)
ordersRouter.get("/:orderId/refunds", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import("../lib/prisma.js");
    const order = await prisma.order.findUnique({
      where:  { id: req.params.orderId as string },
      select: { userId: true },
    });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "SUPER_ADMIN";
    if (!isAdmin && order.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const data = await refundService.getForOrder(req.params.orderId as string);
    res.status(200).json({ data });
  } catch (err) { next(err); }
});
