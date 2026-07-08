"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetchAdmin } from "../admin-api";
import type { AdminOrder } from "../admin-api";

type OrderDetail = AdminOrder & {
  shippingAddress: string;
  shippingName: string;
  subtotal: number;
  shipping: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  couponCode: string | null;
  cancelReason: string | null;
  items: Array<{
    id: string;
    productName: string;
    size: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    imageUrl: string;
  }>;
};

const ORDER_STATUSES = [
  "PLACED","CONFIRMED","PRODUCTION_STARTED","QUALITY_CHECK",
  "SHIPPED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED","RETURN_REQUESTED","REFUNDED",
];

const STATUS_BADGE: Record<string, string> = {
  PLACED:             "bg-blue-50 text-blue-700",
  CONFIRMED:          "bg-indigo-50 text-indigo-700",
  PRODUCTION_STARTED: "bg-violet-50 text-violet-700",
  QUALITY_CHECK:      "bg-amber-50 text-amber-700",
  SHIPPED:            "bg-orange-50 text-orange-700",
  OUT_FOR_DELIVERY:   "bg-lime-50 text-lime-700",
  DELIVERED:          "bg-green-50 text-green-700",
  CANCELLED:          "bg-red-50 text-red-700",
  RETURN_REQUESTED:   "bg-rose-50 text-rose-700",
  REFUNDED:           "bg-gray-50 text-gray-700",
};

const PAYMENT_BADGE: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700",
  CAPTURED:  "bg-green-50 text-green-700",
  REFUNDED:  "bg-gray-50 text-gray-700",
  FAILED:    "bg-red-50 text-red-700",
};

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition";
const BTN_GHOST = `${BTN_SM} border border-black/10 text-text/70 hover:bg-black/5`;

export function OrdersTab() {
  const [orders, setOrders]   = useState<AdminOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail]   = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [error, setError]     = useState("");

  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("limit", String(LIMIT));
    qs.set("page",  String(page));
    if (search)       qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);
    apiFetchAdmin<{ data: AdminOrder[] }>(`/api/orders?${qs}`)
      .then((res) => { setOrders(res.data); setTotal(res.data.length >= LIMIT ? page * LIMIT + 1 : (page - 1) * LIMIT + res.data.length); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (order: AdminOrder) => {
    setDetailLoading(true);
    setNewStatus(order.status);
    try {
      const res = await apiFetchAdmin<{ data: OrderDetail }>(`/api/orders/${order.id}`);
      setDetail(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!detail || !newStatus || newStatus === detail.status) return;
    setStatusUpdating(true);
    try {
      const res = await apiFetchAdmin<{ data: OrderDetail }>(`/api/orders/${detail.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setDetail(res.data);
      setOrders((prev) => prev.map((o) => o.id === res.data.id ? { ...o, status: res.data.status } : o));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusUpdating(false);
    }
  };

  const exportCSV = () => {
    const header = "Order Number,Customer,Email,Amount,Status,Payment,Date";
    const rows = orders.map((o) =>
      `${o.orderNumber},${o.shippingName},${o.customerEmail},${Number(o.total).toFixed(2)},${o.status},${o.paymentStatus},${new Date(o.createdAt).toISOString()}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by order number or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={exportCSV}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition">
          ↓ Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-text/70">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary truncate max-w-[130px]">{o.shippingName}</p>
                      <p className="text-xs text-text/50 truncate max-w-[130px]">{o.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">₹{Number(o.total).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status] ?? "bg-gray-50 text-gray-600"}`}>
                        {o.status.replace(/_/g," ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGE[o.paymentStatus] ?? "bg-gray-50 text-gray-600"}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text/50">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(o)} className={BTN_GHOST}>View</button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-text/40">No orders found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/6 px-6 py-4">
            <p className="text-xs text-text/50">Page {page}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary">← Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={orders.length < LIMIT}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Order detail drawer */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <div className="border-b border-black/6 px-6 py-5 flex items-start justify-between sticky top-0 bg-white z-10">
              <div>
                <p className="font-serif text-2xl text-primary">{detail?.orderNumber ?? "Loading…"}</p>
                <p className="text-sm text-text/60">{detail?.customerEmail}</p>
              </div>
              <button onClick={() => setDetail(null)} className="mt-1 text-text/40 hover:text-primary text-xl">✕</button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
              </div>
            ) : detail && (
              <div className="p-6 space-y-6">
                {/* Status update */}
                <div className="rounded-xl border border-black/6 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text/50">Update Status</p>
                  <div className="flex gap-2">
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                      className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                    </select>
                    <button onClick={handleStatusUpdate} disabled={statusUpdating || newStatus === detail.status}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
                      {statusUpdating ? "…" : "Update"}
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-2 text-sm">
                  {[
                    ["Ship to",  detail.shippingName],
                    ["Address",  detail.shippingAddress],
                    ["Subtotal", `₹${Number(detail.subtotal).toLocaleString("en-IN")}`],
                    ["Discount", `₹${Number(detail.discountAmount ?? 0).toLocaleString("en-IN")}`],
                    ["Shipping", `₹${Number(detail.shipping ?? 0).toLocaleString("en-IN")}`],
                    ["Total",    `₹${Number(detail.total).toLocaleString("en-IN")}`],
                    ["Payment",  detail.paymentStatus],
                    ...(detail.couponCode ? [["Coupon", detail.couponCode]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-black/4 pb-1.5">
                      <span className="text-text/50">{k}</span>
                      <span className="font-medium text-primary">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Items */}
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text/50">Items</p>
                  <div className="space-y-2">
                    {detail.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl border border-black/6 p-3">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.productName} className="h-10 w-10 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-primary">{item.productName}</p>
                          <p className="text-xs text-text/50">Size: {item.size} × {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-primary shrink-0">₹{Number(item.totalPrice).toLocaleString("en-IN")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
