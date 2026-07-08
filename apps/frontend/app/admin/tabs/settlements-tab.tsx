"use client";

import { useEffect, useState } from "react";
import { getAdminSettlements, payAdminSettlement } from "../admin-api";
import type { AdminSettlement } from "../admin-api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED:  "bg-green-50 text-green-700 border-green-200",
  FAILED:     "bg-red-50 text-red-700 border-red-200",
  ON_HOLD:    "bg-gray-50 text-gray-700 border-gray-200",
};

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

export function SettlementsTab() {
  const [settlements, setSettlements] = useState<AdminSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAdminSettlements({ status: statusFilter || undefined, limit: 100 })
      .then(setSettlements)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handlePay = async (id: string) => {
    if (!confirm("Mark this settlement as paid?")) return;
    setActionLoading(id);
    try {
      await payAdminSettlement(id);
      setSettlements((prev) => prev.map((s) => s.id === id ? { ...s, status: "COMPLETED", settledAt: new Date().toISOString() } : s));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const totalPending = settlements
    .filter((s) => s.status === "PENDING")
    .reduce((sum, s) => sum + s.netManufacturerAmount + s.netCelebrityAmount, 0);

  const exportCSV = () => {
    const header = "Order,Platform Fee,Celebrity Commission,Manufacturer Share,Net Celebrity,Net Manufacturer,Status,Date";
    const rows = settlements.map((s) =>
      `${s.order?.orderNumber ?? s.orderId},${s.platformFee},${s.celebrityCommission},${s.manufacturerShare},${s.netCelebrityAmount},${s.netManufacturerAmount},${s.status},${new Date(s.createdAt).toISOString()}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `settlements-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      {totalPending > 0 && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Outstanding Payments</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">₹{totalPending.toLocaleString("en-IN")}</p>
          <p className="mt-0.5 text-xs text-amber-600">Across {settlements.filter((s) => s.status === "PENDING").length} pending settlements</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All statuses</option>
          {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition">
          ↓ Export CSV
        </button>
        <button onClick={load}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-text/70 hover:bg-secondary transition">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}

      <div className="rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Platform Fee</th>
                  <th className="px-4 py-3 font-medium">Celebrity</th>
                  <th className="px-4 py-3 font-medium">Manufacturer</th>
                  <th className="px-4 py-3 font-medium">Net Celeb</th>
                  <th className="px-4 py-3 font-medium">Net Mfr</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-text/70">{s.order?.orderNumber ?? s.orderId}</p>
                      <p className="text-xs text-text/50">{s.order?.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-text/70">₹{Number(s.platformFee).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-text/70">₹{Number(s.celebrityCommission).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-text/70">₹{Number(s.manufacturerShare).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-primary">₹{Number(s.netCelebrityAmount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-primary">₹{Number(s.netManufacturerAmount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === "PENDING" && (
                        <button onClick={() => handlePay(s.id)} disabled={actionLoading === s.id}
                          className={`${BTN_SM} border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50`}>
                          {actionLoading === s.id ? "…" : "Mark Paid"}
                        </button>
                      )}
                      {s.settledAt && (
                        <span className="text-xs text-text/40">{new Date(s.settledAt).toLocaleDateString("en-IN")}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {settlements.length === 0 && !loading && (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-text/40">No settlements found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
