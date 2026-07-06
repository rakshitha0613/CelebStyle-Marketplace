"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getOrder, getManufacturers, getStoredToken } from "@/lib/api";
import type { Order } from "@/lib/api";
import { OrderStatusTracker } from "./order-status-tracker";

function PaymentSuccessBanner() {
  const params = useSearchParams();
  if (params.get("paid") !== "1") return null;
  return (
    <div className="mb-6 rounded-[20px] border border-green-200 bg-green-50 px-6 py-4 text-sm text-green-800">
      <p className="font-medium">Payment successful!</p>
      <p className="mt-0.5 text-green-700">Your order has been confirmed and is now in production.</p>
    </div>
  );
}

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [manufacturers, setManufacturers] = useState<Awaited<ReturnType<typeof getManufacturers>>>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      window.location.replace(`/login?redirect=/orders/${params.id}`);
      return;
    }
    Promise.all([getOrder(params.id), getManufacturers()])
      .then(([o, m]) => {
        if (!o) {
          setNotFound(true);
        } else {
          setOrder(o);
          setManufacturers(m);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
        </div>
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main>
        <Navbar />
        <section className="mx-auto max-w-2xl px-4 py-32 text-center">
          <p className="font-serif text-3xl text-primary">Order not found</p>
          <Link href="/orders" className="mt-6 inline-flex text-sm font-medium text-accent underline-offset-4 hover:underline">
            ← Back to orders
          </Link>
        </section>
      </main>
    );
  }

  const manufacturerMap = new Map(manufacturers.map((m) => [m.id, m]));

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/orders" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          ← All orders
        </Link>

        <div className="mt-4">
          <Suspense>
            <PaymentSuccessBanner />
          </Suspense>
        </div>

        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6 rounded-[28px] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-accent">Order #{order.id}</p>
                <h1 className="mt-2 font-serif text-4xl text-primary capitalize">{order.status}</h1>
                <p className="mt-1 text-sm text-text/60">
                  {order.paymentStatus === "paid" ? "✓ Payment complete" : "⏳ Payment pending"}
                </p>
              </div>
              <div className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary">
                ₹{order.total.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {order.items.map((item) => {
                const linked = item.manufacturerIds
                  .map((mId) => manufacturerMap.get(mId))
                  .filter(Boolean);
                return (
                  <div key={`${item.outfitId}-${item.size}`} className="rounded-[24px] border border-black/6 p-4">
                    <div className="flex gap-4">
                      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-primary">
                        <img src={item.imageUrl} alt={item.outfitName} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-[0.24em] text-accent">{item.category}</p>
                        <p className="mt-1 font-medium text-primary">{item.outfitName}</p>
                        <p className="text-sm text-text/60">{item.celebrityName} · Size {item.size}</p>
                        <p className="mt-2 text-sm font-medium text-primary">₹{item.price.toLocaleString("en-IN")}</p>
                        {linked.length > 0 && (
                          <p className="mt-2 text-xs text-text/50">
                            By {linked.map((e) => e?.name).filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-black/6 bg-secondary/30 p-4 text-sm text-text/70">
              <p><span className="font-medium text-primary">Customer:</span> {order.customerName}</p>
              <p className="mt-1"><span className="font-medium text-primary">Email:</span> {order.customerEmail}</p>
              <p className="mt-1"><span className="font-medium text-primary">Address:</span> {order.address}</p>
              <p className="mt-1"><span className="font-medium text-primary">Payment:</span> {order.paymentMethod}</p>
            </div>
          </div>

          <aside className="space-y-6">
            <OrderStatusTracker orderId={order.id} currentStatus={order.status} />

            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Commission Breakdown</p>
              <div className="mt-4 space-y-3 text-sm text-text/70">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>₹{order.shipping.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between border-t border-black/6 pt-2 font-medium text-primary">
                  <span>Total</span><span>₹{order.total.toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-black/6 pt-2 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Platform fee (10%)</span>
                    <span>₹{order.commission.platformFee.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-xs text-accent font-medium">
                    <span>Celebrity commission (5%)</span>
                    <span>₹{order.commission.celebrityCommission.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Manufacturer share</span>
                    <span>₹{order.commission.manufacturerShare.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Shipment Tracking</p>
              <div className="mt-4 space-y-3">
                {order.routing.map((route) => (
                  <div
                    key={`${route.outfitId}-${route.manufacturerId || "unassigned"}`}
                    className="rounded-2xl border border-black/6 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-primary">{route.manufacturerName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        route.routingStatus === "DISPATCHED" || route.routingStatus === "DELIVERED"
                          ? "bg-green-100 text-green-700"
                          : route.routingStatus === "ACCEPTED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-secondary text-text/60"
                      }`}>
                        {route.routingStatus.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </div>
                    {route.trackingCode ? (
                      <p className="mt-1 text-xs font-mono text-accent">
                        Tracking: {route.trackingCode}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-text/40">
                        {route.manufacturerId ? "Awaiting dispatch" : "Needs assignment"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
