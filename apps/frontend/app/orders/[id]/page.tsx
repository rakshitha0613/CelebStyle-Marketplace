import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getOrder, getManufacturers } from "@/lib/api";
import { OrderStatusTracker } from "./order-status-tracker";

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const [order, manufacturers] = await Promise.all([getOrder(id), getManufacturers()]);
  if (!order) notFound();

  const manufacturerMap = new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]));

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/orders" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          ← All orders
        </Link>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6 rounded-[28px] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-accent">Order #{order.id}</p>
                <h1 className="mt-2 font-serif text-4xl text-primary capitalize">{order.status}</h1>
                <p className="mt-1 text-sm text-text/60">{order.paymentStatus === "paid" ? "✓ Payment complete" : "⏳ Payment pending"}</p>
              </div>
              <div className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary">
                ₹{order.total.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {order.items.map((item) => {
                const linked = item.manufacturerIds.map((manufacturerId) => manufacturerMap.get(manufacturerId)).filter(Boolean);
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
                            By {linked.map((entry) => entry?.name).filter(Boolean).join(", ")}
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
            {/* Interactive Status Tracker */}
            <OrderStatusTracker orderId={order.id} currentStatus={order.status} />

            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Commission Breakdown</p>
              <div className="mt-4 space-y-3 text-sm text-text/70">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>₹{order.shipping.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between border-t border-black/6 pt-2 font-medium text-primary">
                  <span>Total</span>
                  <span>₹{order.total.toLocaleString("en-IN")}</span>
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
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Manufacturer Routing</p>
              <div className="mt-4 space-y-3">
                {order.routing.map((route) => (
                  <div key={`${route.outfitId}-${route.manufacturerId || "unassigned"}`} className="rounded-2xl border border-black/6 px-4 py-3 text-sm">
                    <p className="font-medium text-primary">{route.manufacturerName}</p>
                    <p className="text-xs text-text/50">{route.manufacturerId || "Needs assignment"}</p>
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
