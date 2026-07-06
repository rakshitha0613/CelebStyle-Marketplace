"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getMyReturns, createReturn, getOrders, getStoredToken } from "@/lib/api";
import type { ReturnRequest, Order } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED:  "bg-green-50 text-green-700 border-green-200",
  REJECTED:  "bg-red-50 text-red-700 border-red-200",
  PICKED_UP: "bg-blue-50 text-blue-700 border-blue-200",
  RECEIVED:  "bg-purple-50 text-purple-700 border-purple-200",
  COMPLETED: "bg-green-50 text-green-800 border-green-300",
};

const RETURN_REASONS = [
  "Wrong size",
  "Defective / damaged item",
  "Not as described",
  "Changed my mind",
  "Late delivery",
  "Other",
];

const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";

export default function ReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reason, setReason] = useState(RETURN_REASONS[0]!);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/returns");
      return;
    }
    Promise.all([getMyReturns(), getOrders()]).then(([r, o]) => {
      setReturns(r);
      // Only show delivered orders eligible for return
      setOrders(
        (o ?? []).filter(
          (ord) => ord.status === "delivered" && ord.paymentStatus === "paid"
        )
      );
      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!selectedOrderId) { setFormError("Please select an order."); return; }

    const order = orders.find((o) => o.id === selectedOrderId);
    if (!order) { setFormError("Order not found."); return; }

    setSubmitting(true);
    try {
      const newReturn = await createReturn({
        orderId: selectedOrderId,
        reason,
        description: description.trim() || undefined,
        items: order.items.map((item, i) => ({
          orderItemId: `${order.id}-${i}`,
          quantity: 1,
          reason,
        })),
      });
      setReturns((prev) => [newReturn, ...prev]);
      setShowForm(false);
      setSelectedOrderId("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit return request.");
    } finally {
      setSubmitting(false);
    }
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

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-serif text-4xl text-primary">Returns</h1>
          {orders.length > 0 && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition"
            >
              + New Return
            </button>
          )}
        </div>

        {/* New return form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-[20px] border border-black/10 bg-white p-6 shadow-sm space-y-4"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Return Request</p>
            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Order
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">Select an order…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(0, 8).toUpperCase()} — ₹{o.total.toLocaleString("en-IN")} —{" "}
                    {new Date(o.createdAt).toLocaleDateString("en-IN")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={INPUT_CLS}
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Additional details <span className="normal-case font-normal text-text/40">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Please describe the issue…"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(""); }}
                className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Existing returns */}
        {returns.length === 0 && !showForm && (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">↩️</p>
            <p className="text-sm">No return requests yet.</p>
            {orders.length === 0 && (
              <Link href="/orders" className="mt-3 inline-block text-sm text-accent hover:underline">
                View your orders
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="rounded-[20px] border border-black/6 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-text/40 uppercase tracking-wide">Return ID</p>
                  <p className="font-medium text-primary mt-0.5">
                    #{ret.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[ret.status] ?? "bg-black/5 text-text border-black/10"}`}>
                  {ret.status}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-text/70">
                <p>
                  <span className="font-medium text-text">Order:</span>{" "}
                  <Link
                    href={`/orders/${ret.orderId}`}
                    className="text-accent hover:underline"
                  >
                    #{ret.orderId.slice(0, 8).toUpperCase()}
                  </Link>
                </p>
                <p><span className="font-medium text-text">Reason:</span> {ret.reason}</p>
                {ret.description && (
                  <p><span className="font-medium text-text">Details:</span> {ret.description}</p>
                )}
                <p className="text-xs text-text/40">
                  Submitted {new Date(ret.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
