import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getOrders } from "@/lib/api";

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Order Management</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Order lifecycle</h1>
        <p className="mt-4 text-text/70">Placed → production started → shipped → delivered.</p>

        <div className="mt-10 space-y-4">
          {orders === null ? (
            <div className="rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
              <p className="font-serif text-2xl text-primary">Admin access required</p>
              <p className="mt-3 text-sm text-text/60">Sign in as an administrator to view all orders.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
              <p className="font-serif text-2xl text-primary">No orders yet</p>
              <Link href="/search" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90">
                Browse looks
              </Link>
            </div>
          ) : (
            orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[24px] border border-black/6 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-luxe">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-accent">#{order.id}</p>
                    <h2 className="mt-2 font-serif text-3xl text-primary">{order.customerName}</h2>
                    <p className="text-sm text-text/60">{order.customerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text/60">{order.status}</p>
                    <p className="font-medium text-primary">₹{order.total.toLocaleString("en-IN")}</p>
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
