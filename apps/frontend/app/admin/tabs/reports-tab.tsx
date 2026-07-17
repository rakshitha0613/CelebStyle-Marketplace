"use client";

import { useEffect, useState } from "react";
import { getSettlementReport, getCommissionReport } from "@/lib/api";
import type { SettlementReport, CommissionReport } from "@/lib/api";

type ReportType = "settlements" | "commissions";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-text/40">{label}</p>
      <p className="font-serif text-3xl text-primary mt-2">{value}</p>
      {sub && <p className="text-xs text-text/40 mt-1">{sub}</p>}
    </div>
  );
}

export function ReportsTab() {
  const [reportType, setReportType] = useState<ReportType>("settlements");
  const [settlements, setSettlements] = useState<SettlementReport | null>(null);
  const [commissions, setCommissions] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { from: fromDate || undefined, to: toDate || undefined };
      const [s, c] = await Promise.all([
        getSettlementReport(params),
        getCommissionReport(params),
      ]);
      setSettlements(s);
      setCommissions(c);
    } catch {
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.32em] text-accent mb-4">Date Range Filter</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.2em] text-text/50 mb-1.5">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.2em] text-text/50 mb-1.5">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <button onClick={load}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-background hover:opacity-90 transition">
            Apply
          </button>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-xs text-text/40 hover:text-text/70 underline">Clear</button>
          )}
        </div>
      </div>

      {/* Report type tabs */}
      <div className="flex gap-1 rounded-full border border-black/8 bg-black/[0.02] p-1 w-fit">
        {(["settlements", "commissions"] as ReportType[]).map((t) => (
          <button key={t} onClick={() => setReportType(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${reportType === t ? "bg-white shadow-sm text-primary" : "text-text/50 hover:text-primary"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : reportType === "settlements" && settlements ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Settlements" value={String(settlements?.totalSettlements ?? 0)} />
            <StatCard label="Gross Revenue" value={fmt(settlements.totalGross)} />
            <StatCard label="Platform Fee (10%)" value={fmt(settlements.totalPlatformFee)} />
            <StatCard label="Celebrity Comm." value={fmt(settlements.totalCelebCommission)} />
          </div>
          <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">By Status</p>
            <div className="space-y-2">
              {Object.entries(settlements.byStatus).map(([status, data]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-primary capitalize">{status.toLowerCase()}</span>
                  <span className="text-text/60">{data.count} records · {fmt(data.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">Revenue Split</p>
            <div className="space-y-3">
              {[
                { label: "Platform (10%)", amount: settlements.totalPlatformFee, total: settlements.totalGross },
                { label: "Celebrity commissions (5%)", amount: settlements.totalCelebCommission, total: settlements.totalGross },
                { label: "Manufacturer share (85%)", amount: settlements.totalManufacturerShare, total: settlements.totalGross },
              ].map(({ label, amount, total }) => {
                const pct = total > 0 ? (amount / total) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text/70">{label}</span>
                      <span className="font-medium text-primary">{fmt(amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                      <div className="h-full rounded-full bg-accent/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : reportType === "commissions" && commissions ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gross Revenue" value={fmt(commissions.totalGross)} />
            <StatCard label="Platform Fee" value={fmt(commissions.totalPlatformFee)} />
            <StatCard label="Celebrity Comm." value={fmt(commissions.totalCelebCommission)} />
            <StatCard label="Mfr. Share" value={fmt(commissions.totalManufacturerShare)} />
          </div>
          {commissions.byCelebrity?.length > 0 && (
            <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">Top Celebrity Commissions</p>
              <div className="space-y-2">
                {commissions.byCelebrity.slice(0, 10).map((c) => (
                  <div key={c.celebrityId} className="flex items-center justify-between text-sm">
                    <span className="text-primary truncate max-w-[200px]">{c.celebrityId}</span>
                    <div className="text-right">
                      <span className="text-text/60">Gross: {fmt(c.gross)}</span>
                      <span className="mx-2 text-text/20">·</span>
                      <span className="font-medium text-accent">Comm: {fmt(c.commission)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-text/40">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm">No report data available for the selected period.</p>
        </div>
      )}
    </div>
  );
}
