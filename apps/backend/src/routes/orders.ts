import { Router } from "express";
import type { Request, Response } from "express";
import { celebrityStore } from "./celebrities.js";
import { outfitStore } from "./outfits.js";
import { manufacturerStore } from "./manufacturers.js";

export type OrderStatus = "placed" | "production started" | "shipped" | "delivered";
export type PaymentStatus = "pending" | "paid";

export type OrderItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  category: string;
  price: number;
  size: string;
  imageUrl: string;
  manufacturerIds: string[];
};

export type OrderEntry = {
  id: string;
  customerName: string;
  customerEmail: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  status: OrderStatus;
  commission: {
    platformFee: number;
    celebrityCommission: number;
    manufacturerShare: number;
  };
  routing: Array<{
    outfitId: string;
    manufacturerId: string | null;
    manufacturerName: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export const orderStore: OrderEntry[] = [];
export const ordersRouter = Router();

function computeOrderTotals(items: OrderItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shipping = subtotal >= 25000 ? 0 : 499;
  const total = subtotal + shipping;
  const platformFee = Math.round(subtotal * 0.1);
  const celebrityCommission = Math.round(subtotal * 0.05);
  const manufacturerShare = subtotal - platformFee - celebrityCommission;
  return { subtotal, shipping, total, commission: { platformFee, celebrityCommission, manufacturerShare } };
}

function routeManufacturers(items: OrderItem[]) {
  return items.map((item) => {
    const manufacturerId = item.manufacturerIds[0] || null;
    const manufacturer = manufacturerId ? manufacturerStore.find((entry) => entry.id === manufacturerId) : null;
    return {
      outfitId: item.outfitId,
      manufacturerId,
      manufacturerName: manufacturer?.name || "Unassigned"
    };
  });
}

ordersRouter.get("/", (_req: Request, res: Response) => {
  res.json({ data: orderStore });
});

ordersRouter.get("/:id", (req: Request, res: Response) => {
  const item = orderStore.find((order) => order.id === req.params.id);
  if (!item) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json({ data: item });
});

ordersRouter.post("/", (req: Request, res: Response) => {
  const { customerName, customerEmail, address, items, paymentMethod = "Razorpay Demo" } = req.body;
  if (!customerName || !customerEmail || !address || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "customerName, customerEmail, address, and items are required" });
    return;
  }

  const normalizedItems: OrderItem[] = items.map((item: any) => {
    const outfit = outfitStore.find((entry) => entry.id === item.outfitId);
    const celebrity = celebrityStore.find((entry) => entry.id === (outfit?.celebrityId || item.celebrityId));
    return {
      outfitId: item.outfitId,
      outfitName: item.outfitName || outfit?.movieName || "Unknown look",
      celebrityId: outfit?.celebrityId || item.celebrityId,
      celebrityName: celebrity?.name || item.celebrityName || "Unknown celebrity",
      category: item.category || outfit?.category || "Look",
      price: Number(item.price) || Number(outfit?.price) || 0,
      size: item.size || "M",
      imageUrl: item.imageUrl || outfit?.imageUrl || "",
      manufacturerIds: Array.isArray(item.manufacturerIds) ? item.manufacturerIds : outfit?.manufacturerIds || []
    };
  });

  const { subtotal, shipping, total, commission } = computeOrderTotals(normalizedItems);
  const now = new Date().toISOString();
  const order: OrderEntry = {
    id: `ord-${Date.now()}`,
    customerName,
    customerEmail,
    address,
    items: normalizedItems,
    subtotal,
    shipping,
    total,
    paymentStatus: "pending",
    paymentMethod,
    status: "placed",
    commission,
    routing: routeManufacturers(normalizedItems),
    createdAt: now,
    updatedAt: now
  };
  orderStore.unshift(order);
  res.status(201).json({ data: order });
});

ordersRouter.post("/:id/pay", (req: Request, res: Response) => {
  const order = orderStore.find((entry) => entry.id === req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  order.paymentStatus = "paid";
  order.status = "production started";
  order.updatedAt = new Date().toISOString();
  res.json({ data: order });
});

ordersRouter.patch("/:id/status", (req: Request, res: Response) => {
  const order = orderStore.find((entry) => entry.id === req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  const status = req.body.status as OrderStatus | undefined;
  if (!status) {
    res.status(400).json({ message: "status is required" });
    return;
  }
  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json({ data: order });
});
