"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getOrders, getStoredToken } from "@/lib/api";
import type { Order } from "@/lib/api";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/orders");
      return;
    }
    getOrders().then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, [router]);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Order History</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Your Orders</h1>
        <p className="mt-4 text-text/70">Placed → production started → shipped → delivered.</p>

        <div className="mt-10 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
            </div>
          ) : orders === null ? (
            <div className="rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
              <p className="font-serif text-2xl text-primary">Could not load orders</p>
              <p className="mt-3 text-sm text-text/60">Please sign in and try again.</p>
              <Link
                href="/login?redirect=/orders"
                className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign In
              </Link>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
              <p className="font-serif text-2xl text-primary">No orders yet</p>
              <Link
                href="/search"
                className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
              >
                Browse looks
              </Link>
            </div>
          ) : (
            orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-[24px] border border-black/6 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-luxe"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-accent">#{order.id}</p>
                    <h2 className="mt-2 font-serif text-3xl text-primary">{order.customerName}</h2>
                    <p className="text-sm text-text/60">{order.customerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text/60">{order.status}</p>
                    <p className="font-medium text-primary">
                      ₹{order.total.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
