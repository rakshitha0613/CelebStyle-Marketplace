"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getOrders, getInvoiceForOrder, getStoredToken } from "@/lib/api";
import type { Order, Invoice } from "@/lib/api";

export default function InvoicesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Record<string, Invoice | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/invoices");
      return;
    }
    getOrders().then((data) => {
      setOrders(data ?? []);
      setLoading(false);
    });
  }, [router]);

  const handleLoadInvoice = async (orderId: string) => {
    if (invoices[orderId] !== undefined) return;
    setLoadingInvoices((prev) => ({ ...prev, [orderId]: true }));
    const inv = await getInvoiceForOrder(orderId);
    setInvoices((prev) => ({ ...prev, [orderId]: inv }));
    setLoadingInvoices((prev) => ({ ...prev, [orderId]: false }));
  };

  const handlePrint = (inv: Invoice) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 28px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 32px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 8px 12px; background: #f5f5f5; font-size: 13px; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .right { text-align: right; }
        .total { font-weight: bold; font-size: 15px; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
        .label { font-size: 11px; text-transform: uppercase; color: #999; }
        .value { font-size: 14px; margin-top: 2px; }
      </style>
      </head><body>
      <h1>CelebStyle</h1>
      <p class="subtitle">Invoice #${inv.invoiceNumber}</p>
      <div class="info">
        <div><p class="label">Customer</p><p class="value">${inv.customerName}</p><p class="value">${inv.customerEmail}</p></div>
        <div><p class="label">Issued</p><p class="value">${new Date(inv.issuedAt).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })}</p></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th class="right">Unit</th><th class="right">Subtotal</th></tr></thead>
        <tbody>
          ${inv.items.map((i) => `<tr><td>${i.name}</td><td>${i.quantity}</td><td class="right">₹${i.price.toLocaleString("en-IN")}</td><td class="right">₹${i.subtotal.toLocaleString("en-IN")}</td></tr>`).join("")}
        </tbody>
      </table>
      <div style="text-align:right; margin-top:16px; font-size:13px;">
        <p>Subtotal: ₹${inv.subtotal.toLocaleString("en-IN")}</p>
        <p>Shipping: ₹${inv.shipping.toLocaleString("en-IN")}</p>
        <p>Tax (18% GST): ₹${inv.tax.toLocaleString("en-IN")}</p>
        <p class="total" style="font-size:16px; margin-top:8px;">Total: ₹${inv.total.toLocaleString("en-IN")}</p>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

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

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Invoices</h1>
        <p className="mt-2 text-sm text-text/60">Download or print invoices for your paid orders.</p>

        {paidOrders.length === 0 && (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">📄</p>
            <p className="text-sm">No paid orders yet.</p>
            <Link href="/orders" className="mt-3 inline-block text-sm text-accent hover:underline">
              View all orders
            </Link>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {paidOrders.map((order) => {
            const inv = invoices[order.id];
            const isLoading = loadingInvoices[order.id];
            return (
              <div
                key={order.id}
                className="rounded-[20px] border border-black/6 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-text/40 uppercase tracking-wide">Order</p>
                    <p className="font-medium text-primary mt-0.5">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-text/60 mt-1">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""} •{" "}
                      ₹{order.total.toLocaleString("en-IN")} •{" "}
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  {!inv && !isLoading && (
                    <button
                      onClick={() => handleLoadInvoice(order.id)}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition flex-shrink-0"
                    >
                      View Invoice
                    </button>
                  )}
                  {isLoading && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
                  )}
                </div>

                {inv && (
                  <div className="mt-5 border-t border-black/6 pt-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs text-text/40 uppercase tracking-wide">
                        Invoice #{inv.invoiceNumber}
                      </p>
                      <button
                        onClick={() => handlePrint(inv)}
                        className="text-xs text-accent hover:underline"
                      >
                        Print / Download
                      </button>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-text/50 uppercase tracking-wide">
                          <th className="text-left pb-2 font-medium">Item</th>
                          <th className="text-right pb-2 font-medium">Qty</th>
                          <th className="text-right pb-2 font-medium">Price</th>
                          <th className="text-right pb-2 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items.map((item, i) => (
                          <tr key={i} className="border-t border-black/5">
                            <td className="py-2 pr-4 text-text">{item.name}</td>
                            <td className="py-2 text-right text-text/60">{item.quantity}</td>
                            <td className="py-2 text-right text-text/60">
                              ₹{item.price.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 text-right text-text">
                              ₹{item.subtotal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-4 border-t border-black/6 pt-4 text-sm text-right space-y-1">
                      <p className="text-text/60">Subtotal: ₹{inv.subtotal.toLocaleString("en-IN")}</p>
                      <p className="text-text/60">Shipping: ₹{inv.shipping.toLocaleString("en-IN")}</p>
                      <p className="text-text/60">Tax: ₹{inv.tax.toLocaleString("en-IN")}</p>
                      <p className="font-semibold text-primary text-base">
                        Total: ₹{inv.total.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
