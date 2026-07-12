"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getAdminOrdersList,
  getAdminOrderDetail,
  updateAdminOrderStatus,
  updateAdminOrderTracking,
  cancelAdminOrder,
  refundAdminOrder,
} from "../admin-api";
import type { AdminOrderListItem, AdminOrderDetail } from "../admin-api";

// ── Constants ──────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "PLACED","CONFIRMED","PRODUCTION_STARTED","QUALITY_CHECK",
  "SHIPPED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED","RETURN_REQUESTED","REFUNDED",
] as const;

type OrderStatus = typeof ORDER_STATUSES[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED:             "Order Placed",
  CONFIRMED:          "Accepted",
  PRODUCTION_STARTED: "Production Started",
  QUALITY_CHECK:      "Quality Check",
  SHIPPED:            "Shipped",
  OUT_FOR_DELIVERY:   "Out for Delivery",
  DELIVERED:          "Delivered",
  CANCELLED:          "Cancelled",
  RETURN_REQUESTED:   "Return Requested",
  REFUNDED:           "Refunded",
};

const STATUS_BADGE: Record<string, string> = {
  PLACED:             "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRMED:          "bg-indigo-50 text-indigo-700 border-indigo-200",
  PRODUCTION_STARTED: "bg-violet-50 text-violet-700 border-violet-200",
  QUALITY_CHECK:      "bg-amber-50 text-amber-700 border-amber-200",
  SHIPPED:            "bg-orange-50 text-orange-700 border-orange-200",
  OUT_FOR_DELIVERY:   "bg-lime-50 text-lime-700 border-lime-200",
  DELIVERED:          "bg-green-50 text-green-700 border-green-200",
  CANCELLED:          "bg-red-50 text-red-700 border-red-200",
  RETURN_REQUESTED:   "bg-rose-50 text-rose-700 border-rose-200",
  REFUNDED:           "bg-gray-50 text-gray-600 border-gray-200",
};

const PAYMENT_BADGE: Record<string, string> = {
  PENDING:             "bg-amber-50 text-amber-700",
  CAPTURED:            "bg-green-50 text-green-700",
  REFUNDED:            "bg-gray-50 text-gray-600",
  FAILED:              "bg-red-50 text-red-700",
  PARTIALLY_REFUNDED:  "bg-rose-50 text-rose-700",
};

const BTN_SM   = "rounded-lg px-3 py-1.5 text-xs font-medium transition";
const BTN_GHOST = `${BTN_SM} border border-black/10 text-text/70 hover:bg-black/5`;
const BTN_PRIMARY = `${BTN_SM} bg-primary text-background disabled:opacity-50 hover:bg-primary/90`;
const BTN_DANGER  = `${BTN_SM} bg-red-600 text-white disabled:opacity-50 hover:bg-red-700`;

const LIMIT = 20;

// ── Invoice generator (client-side) ───────────────────────────────────────────

function printInvoice(detail: AdminOrderDetail) {
  const rows = detail.items
    .map(
      (i) =>
        `<tr><td>${i.productName}</td><td>${i.category}</td><td>${i.size}</td><td>${i.quantity}</td><td>₹${Number(i.unitPrice).toLocaleString("en-IN")}</td><td>₹${Number(i.totalPrice).toLocaleString("en-IN")}</td></tr>`
    )
    .join("");

  const discount = Number(detail.discountAmount) > 0
    ? `<tr><td colspan="5" style="text-align:right">Discount</td><td>-₹${Number(detail.discountAmount).toLocaleString("en-IN")}</td></tr>`
    : "";

  const html = `<!DOCTYPE html><html><head><title>Invoice ${detail.orderNumber}</title>
<style>
  body{font-family:Arial,sans-serif;padding:48px;color:#111}
  h1{font-size:28px;margin-bottom:4px}
  .meta{color:#666;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#f5f5f5;text-align:left;padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
  .total td{font-weight:700;font-size:15px;border-top:2px solid #111}
  .footer{margin-top:40px;font-size:12px;color:#999}
</style></head><body>
<h1>CelebStyle</h1>
<div class="meta">
  <strong>Invoice / Tax Receipt</strong><br/>
  Order: <strong>${detail.orderNumber}</strong> &nbsp;|&nbsp;
  Date: ${new Date(detail.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
</div>
<p><strong>Bill To:</strong> ${detail.shippingName} (${detail.customerEmail})<br/>
${detail.shippingAddress}${detail.shippingCity ? `, ${detail.shippingCity}` : ""}${detail.shippingState ? `, ${detail.shippingState}` : ""}${detail.shippingPincode ? ` – ${detail.shippingPincode}` : ""}</p>
<table>
  <thead><tr><th>Product</th><th>Category</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr><td colspan="5" style="text-align:right">Subtotal</td><td>₹${Number(detail.subtotal).toLocaleString("en-IN")}</td></tr>
    <tr><td colspan="5" style="text-align:right">Shipping</td><td>₹${Number(detail.shippingAmount).toLocaleString("en-IN")}</td></tr>
    ${discount}
    <tr class="total"><td colspan="5" style="text-align:right">Grand Total</td><td>₹${Number(detail.total).toLocaleString("en-IN")}</td></tr>
  </tfoot>
</table>
<div class="footer">Payment: ${detail.paymentStatus} &nbsp;|&nbsp; Status: ${detail.status} &nbsp;|&nbsp; Thank you for your order!</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

function exportCSV(orders: AdminOrderListItem[]) {
  const header = "Order Number,Customer,Email,Items,Amount,Status,Payment,Date";
  const rows = orders.map((o) =>
    [
      o.orderNumber,
      `"${o.shippingName.replace(/"/g, '""')}"`,
      o.customerEmail,
      o._count.items,
      Number(o.total).toFixed(2),
      o.status,
      o.paymentStatus,
      new Date(o.createdAt).toISOString(),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {STATUS_LABEL[status as OrderStatus] ?? status.replace(/_/g, " ")}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OrdersTab() {
  const [orders, setOrders]       = useState<AdminOrderListItem[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError]         = useState("");

  const [detail, setDetail]         = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newStatus, setNewStatus]   = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [trackingInput, setTrackingInput] = useState("");
  const [trackingRoutingId, setTrackingRoutingId] = useState<string | undefined>();
  const [trackingSaving, setTrackingSaving] = useState(false);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refunding, setRefunding] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load orders list ──────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getAdminOrdersList({ page, limit: LIMIT, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setOrders(res.orders);
        setTotal(res.total);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Debounced search ──────────────────────────────────────────────────────

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { /* load fires via dep */ }, 400);
  };

  // ── Open detail drawer ────────────────────────────────────────────────────

  const openDetail = async (order: AdminOrderListItem) => {
    setDetailLoading(true);
    setNewStatus(order.status);
    setTrackingInput("");
    setTrackingRoutingId(undefined);
    setShowCancel(false);
    setShowRefund(false);
    setCancelReason("");
    setRefundAmount("");
    setRefundNotes("");
    try {
      const d = await getAdminOrderDetail(order.id);
      setDetail(d);
      setNewStatus(d.status);
      if (d.routing.length > 0) {
        setTrackingRoutingId(d.routing[0].id);
        setTrackingInput(d.routing[0].trackingCode ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setShowCancel(false);
    setShowRefund(false);
  };

  // ── Patch list item after mutations ──────────────────────────────────────

  const patchListItem = (updated: AdminOrderListItem) => {
    setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o));
  };

  // ── Status update ─────────────────────────────────────────────────────────

  const handleStatusUpdate = async () => {
    if (!detail || !newStatus || newStatus === detail.status) return;
    setStatusUpdating(true);
    setError("");
    try {
      const updated = await updateAdminOrderStatus(detail.id, newStatus);
      setDetail(updated);
      setNewStatus(updated.status);
      patchListItem({
        id: updated.id,
        orderNumber: updated.orderNumber,
        customerEmail: updated.customerEmail,
        shippingName: updated.shippingName,
        total: updated.total,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        createdAt: updated.createdAt,
        _count: { items: updated.items.length },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── Tracking update ───────────────────────────────────────────────────────

  const handleTrackingUpdate = async () => {
    if (!detail || !trackingInput.trim()) return;
    setTrackingSaving(true);
    setError("");
    try {
      const updated = await updateAdminOrderTracking(detail.id, trackingInput.trim(), trackingRoutingId);
      setDetail(updated);
      if (updated.routing.length > 0) {
        setTrackingRoutingId(updated.routing[0].id);
        setTrackingInput(updated.routing[0].trackingCode ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tracking update failed");
    } finally {
      setTrackingSaving(false);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!detail) return;
    setCancelling(true);
    setError("");
    try {
      const updated = await cancelAdminOrder(detail.id, cancelReason || undefined);
      patchListItem(updated);
      const refreshed = await getAdminOrderDetail(detail.id);
      setDetail(refreshed);
      setNewStatus(refreshed.status);
      setShowCancel(false);
      setCancelReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  // ── Refund ────────────────────────────────────────────────────────────────

  const handleRefund = async () => {
    if (!detail) return;
    setRefunding(true);
    setError("");
    try {
      const amt = refundAmount ? Number(refundAmount) : undefined;
      const updated = await refundAdminOrder(detail.id, amt, refundNotes || undefined);
      patchListItem(updated);
      const refreshed = await getAdminOrderDetail(detail.id);
      setDetail(refreshed);
      setNewStatus(refreshed.status);
      setShowRefund(false);
      setRefundAmount("");
      setRefundNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const canCancel  = detail ? !["DELIVERED","CANCELLED","REFUNDED"].includes(detail.status) : false;
  const canRefund  = detail ? (detail.paymentStatus === "CAPTURED" && detail.status !== "REFUNDED") : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by order #, email, or name…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition"
        >
          ↺ Refresh
        </button>
        <button
          onClick={() => exportCSV(orders)}
          disabled={orders.length === 0}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition disabled:opacity-40"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-start gap-3">
          <span>{error}</span>
          <button onClick={() => setError("")} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="flex items-center gap-4 text-sm text-text/50">
        <span>{total.toLocaleString("en-IN")} order{total !== 1 ? "s" : ""}</span>
        {statusFilter && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {STATUS_LABEL[statusFilter as OrderStatus] ?? statusFilter}
            <button onClick={() => { setStatusFilter(""); setPage(1); }} className="ml-1 hover:text-red-500">✕</button>
          </span>
        )}
      </div>

      {/* ── Orders table ── */}
      <div className="rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
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
                    <td className="px-4 py-3 text-xs text-text/60">{o._count.items} item{o._count.items !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 font-medium text-primary">₹{Number(o.total).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGE[o.paymentStatus] ?? "bg-gray-50 text-gray-600"}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text/50">
                      {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openDetail(o)} className={BTN_GHOST}>View</button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-text/40">
                      {search || statusFilter ? "No orders match the current filters." : "No orders yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/6 px-6 py-4">
            <p className="text-xs text-text/50">Page {page} of {totalPages} &nbsp;·&nbsp; {total} total</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Order detail drawer ── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl flex flex-col">

            {/* Drawer header */}
            <div className="sticky top-0 z-10 border-b border-black/6 px-6 py-5 bg-white flex items-start justify-between">
              <div>
                <p className="font-serif text-2xl text-primary">{detail?.orderNumber ?? "Loading…"}</p>
                <p className="mt-0.5 text-sm text-text/60">{detail?.customerEmail}</p>
                {detail && <div className="mt-2"><StatusBadge status={detail.status} /></div>}
              </div>
              <button onClick={closeDetail} className="mt-1 text-text/40 hover:text-primary text-2xl leading-none">✕</button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex justify-center items-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
              </div>
            ) : detail && (
              <div className="flex-1 p-6 space-y-6">

                {/* ── Update Status ── */}
                <section className="rounded-xl border border-black/8 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Update Status</p>
                  <div className="flex gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleStatusUpdate}
                      disabled={statusUpdating || newStatus === detail.status}
                      className={BTN_PRIMARY}
                    >
                      {statusUpdating ? "Saving…" : "Update"}
                    </button>
                  </div>
                </section>

                {/* ── Tracking Number ── */}
                {detail.routing.length > 0 && (
                  <section className="rounded-xl border border-black/8 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Tracking Number</p>
                    {detail.routing.length > 1 && (
                      <select
                        value={trackingRoutingId ?? ""}
                        onChange={(e) => {
                          setTrackingRoutingId(e.target.value);
                          const r = detail.routing.find((x) => x.id === e.target.value);
                          setTrackingInput(r?.trackingCode ?? "");
                        }}
                        className="mb-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs focus:outline-none"
                      >
                        {detail.routing.map((r) => (
                          <option key={r.id} value={r.id}>{r.manufacturerName}</option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        placeholder="Enter tracking code…"
                        className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <button
                        onClick={handleTrackingUpdate}
                        disabled={trackingSaving || !trackingInput.trim()}
                        className={BTN_PRIMARY}
                      >
                        {trackingSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </section>
                )}

                {/* ── Financial Summary ── */}
                <section className="rounded-xl border border-black/8 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Financial Summary</p>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ["Ship to",   detail.shippingName],
                      ["Address",   `${detail.shippingAddress}${detail.shippingCity ? `, ${detail.shippingCity}` : ""}${detail.shippingState ? `, ${detail.shippingState}` : ""}${detail.shippingPincode ? ` ${detail.shippingPincode}` : ""}`],
                      ["Subtotal",  `₹${Number(detail.subtotal).toLocaleString("en-IN")}`],
                      ["Shipping",  `₹${Number(detail.shippingAmount).toLocaleString("en-IN")}`],
                      ...(Number(detail.discountAmount) > 0 ? [["Discount", `-₹${Number(detail.discountAmount).toLocaleString("en-IN")}`]] : []),
                      ["Total",     `₹${Number(detail.total).toLocaleString("en-IN")}`],
                      ["Payment",   detail.paymentStatus],
                      ...(detail.notes ? [["Notes", detail.notes]] : []),
                    ].map(([k, v]) => (
                      <div key={`summary-${k}`} className="flex justify-between gap-4 border-b border-black/4 pb-1.5 last:border-0">
                        <span className="text-text/50 shrink-0">{k}</span>
                        <span className="font-medium text-primary text-right break-all">{v}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Order Items ── */}
                <section>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Items ({detail.items.length})</p>
                  <div className="space-y-2">
                    {detail.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl border border-black/6 p-3">
                        {item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-12 w-12 rounded-lg object-cover shrink-0 bg-secondary"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-primary">{item.productName}</p>
                          <p className="text-xs text-text/50">{item.category} · Size {item.size} · Qty {item.quantity}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-primary">₹{Number(item.totalPrice).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-text/40">₹{Number(item.unitPrice).toLocaleString("en-IN")} each</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Payment History ── */}
                {detail.payments.length > 0 && (
                  <section>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Payment History</p>
                    <div className="space-y-2">
                      {detail.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border border-black/6 px-4 py-3 text-sm">
                          <div>
                            <p className="font-medium text-primary">{p.method} via {p.provider}</p>
                            <p className="text-xs text-text/50">
                              {p.capturedAt ? new Date(p.capturedAt).toLocaleString("en-IN") : "Pending"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-primary">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                            <span className={`text-xs font-medium ${PAYMENT_BADGE[p.status] ?? "text-gray-600"}`}>{p.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Manufacturer Routing ── */}
                {detail.routing.length > 0 && (
                  <section>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Manufacturer Routing</p>
                    <div className="space-y-2">
                      {detail.routing.map((r) => (
                        <div key={r.id} className="rounded-xl border border-black/6 px-4 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-primary">{r.manufacturerName}</p>
                            <span className="text-xs text-text/50 rounded-full bg-black/5 px-2 py-0.5">{r.status}</span>
                          </div>
                          {r.trackingCode && (
                            <p className="mt-1 font-mono text-xs text-text/60">Track: {r.trackingCode}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Commission Breakdown ── */}
                {detail.commission && (
                  <section>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Commission Breakdown</p>
                    <div className="rounded-xl border border-black/6 p-4 grid grid-cols-3 gap-3 text-center text-xs">
                      {[
                        ["Platform (10%)", detail.commission.platformFee],
                        ["Celebrity (5%)", detail.commission.celebrityCommission],
                        ["Manufacturer (85%)", detail.commission.manufacturerShare],
                      ].map(([label, value]) => (
                        <div key={`commission-${label}`}>
                          <p className="text-text/50">{label}</p>
                          <p className="mt-1 font-semibold text-primary text-sm">₹{Number(value).toLocaleString("en-IN")}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Delivery Timeline ── */}
                <section>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Timeline</p>
                  <div className="space-y-1.5 text-xs text-text/60">
                    {[
                      ["Created",   detail.createdAt],
                      ["Updated",   detail.updatedAt],
                      ...(detail.deliveredAt ? [["Delivered", detail.deliveredAt]] : []),
                    ].map(([label, ts]) => (
                      <div key={`timeline-${label}`} className="flex justify-between">
                        <span>{label}</span>
                        <span className="font-medium text-text/80">
                          {new Date(ts as string).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Admin Actions ── */}
                <section className="rounded-xl border border-black/8 p-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text/40">Admin Actions</p>

                  {/* Invoice */}
                  <button
                    onClick={() => printInvoice(detail)}
                    className="w-full rounded-xl border border-black/10 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition"
                  >
                    🧾 Generate Invoice / Print
                  </button>

                  {/* Cancel */}
                  {canCancel && !showCancel && (
                    <button
                      onClick={() => setShowCancel(true)}
                      className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      Cancel Order
                    </button>
                  )}
                  {showCancel && (
                    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                      <p className="text-xs font-medium text-red-700">Reason for cancellation (optional)</p>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={2}
                        placeholder="Customer request, out of stock, etc."
                        className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleCancel} disabled={cancelling} className={`flex-1 ${BTN_DANGER}`}>
                          {cancelling ? "Cancelling…" : "Confirm Cancel"}
                        </button>
                        <button onClick={() => { setShowCancel(false); setCancelReason(""); }} className={`flex-1 ${BTN_GHOST}`}>
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Refund */}
                  {canRefund && !showRefund && (
                    <button
                      onClick={() => { setShowRefund(true); setRefundAmount(String(Number(detail.total))); }}
                      className="w-full rounded-xl border border-amber-200 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50 transition"
                    >
                      Process Refund
                    </button>
                  )}
                  {showRefund && (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-xs font-medium text-amber-800">Refund amount (₹)</p>
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        min={1}
                        max={Number(detail.total)}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300"
                      />
                      <textarea
                        value={refundNotes}
                        onChange={(e) => setRefundNotes(e.target.value)}
                        rows={2}
                        placeholder="Reason / notes (optional)"
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleRefund} disabled={refunding || !refundAmount} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition bg-amber-600 text-white disabled:opacity-50 hover:bg-amber-700`}>
                          {refunding ? "Processing…" : "Confirm Refund"}
                        </button>
                        <button onClick={() => { setShowRefund(false); setRefundAmount(""); setRefundNotes(""); }} className={`flex-1 ${BTN_GHOST}`}>
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </section>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
