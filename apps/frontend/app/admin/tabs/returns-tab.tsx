"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminReturns, approveAdminReturn, rejectAdminReturn, completeAdminReturn } from "../admin-api";
import type { AdminReturn } from "../admin-api";

const STATUS_BADGE: Record<string, string> = {
  REQUESTED:        "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED:         "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED:         "bg-red-50 text-red-700 border-red-200",
  PICKED_UP:        "bg-violet-50 text-violet-700 border-violet-200",
  RECEIVED:         "bg-indigo-50 text-indigo-700 border-indigo-200",
  REFUND_INITIATED: "bg-orange-50 text-orange-700 border-orange-200",
  REFUND_COMPLETED: "bg-green-50 text-green-700 border-green-200",
};

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

export function ReturnsTab() {
  const [returns, setReturns] = useState<AdminReturn[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completeId, setCompleteId]       = useState<string | null>(null);
  const [refundAmount, setRefundAmount]   = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getAdminReturns({ status: statusFilter || undefined, limit: 100 })
      .then(setReturns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveAdminReturn(id);
      setReturns((prev) => prev.map((r) => r.id === id ? { ...r, status: "APPROVED" } : r));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setActionLoading(id);
    try {
      await rejectAdminReturn(id, reason || undefined);
      setReturns((prev) => prev.map((r) => r.id === id ? { ...r, status: "REJECTED" } : r));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const handleComplete = async () => {
    if (!completeId) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid refund amount"); return; }
    setActionLoading(completeId);
    try {
      await completeAdminReturn(completeId, Math.round(amount));
      setReturns((prev) => prev.map((r) => r.id === completeId ? { ...r, status: "REFUND_INITIATED", refundAmount: Math.round(amount) } : r));
      setCompleteId(null);
      setRefundAmount("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All statuses</option>
          {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button onClick={load} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-text/70 hover:bg-secondary transition">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-primary">{r.order?.orderNumber ?? r.orderId}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {r.status.replace(/_/g," ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text/60">
                    {r.user?.name} ({r.user?.email}) · Reason: {r.reason.replace(/_/g," ")}
                  </p>
                  {r.description && <p className="mt-1 text-sm text-text/50 italic">&ldquo;{r.description}&rdquo;</p>}
                  {r.refundAmount && (
                    <p className="mt-1 text-sm font-medium text-green-700">
                      Refund: ₹{Number(r.refundAmount).toLocaleString("en-IN")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text/40">{new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <p className="text-sm font-medium text-primary shrink-0">
                  ₹{Number(r.order?.total ?? 0).toLocaleString("en-IN")}
                </p>
              </div>

              {r.status === "REQUESTED" && (
                <div className="mt-4 flex gap-2 border-t border-black/6 pt-4">
                  <button onClick={() => handleApprove(r.id)} disabled={actionLoading === r.id}
                    className={`${BTN_SM} border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50`}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleReject(r.id)} disabled={actionLoading === r.id}
                    className={`${BTN_SM} border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50`}>
                    ✗ Reject
                  </button>
                </div>
              )}
              {(r.status === "RECEIVED" || r.status === "APPROVED") && (
                <div className="mt-4 border-t border-black/6 pt-4">
                  <button onClick={() => { setCompleteId(r.id); setRefundAmount(String(r.order?.total ?? "")); }}
                    className={`${BTN_SM} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>
                    Process Refund
                  </button>
                </div>
              )}
            </div>
          ))}
          {returns.length === 0 && (
            <div className="rounded-[20px] border border-black/6 bg-white p-12 text-center">
              <p className="text-sm text-text/40">No returns found.</p>
            </div>
          )}
        </div>
      )}

      {/* Refund amount modal */}
      {completeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">Process Refund</h3>
            <p className="mt-2 text-sm text-text/60">Enter the refund amount in rupees.</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Amount (₹)</label>
              <input
                type="number" min="1" value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleComplete} disabled={!!actionLoading}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background disabled:opacity-50">
                {actionLoading ? "Processing…" : "Confirm Refund"}
              </button>
              <button onClick={() => setCompleteId(null)}
                className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-text/70">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
