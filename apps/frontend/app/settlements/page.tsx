"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getSettlements, getStoredToken, getCurrentUser } from "@/lib/api";
import type { Settlement } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING:"bg-blue-50 text-blue-700 border-blue-200",
  PAID:      "bg-green-50 text-green-700 border-green-200",
  FAILED:    "bg-red-50 text-red-700 border-red-200",
};

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    const user = getCurrentUser();
    if (!token || !user) {
      router.replace("/login?redirect=/settlements");
      return;
    }
    if (!["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER", "ANALYST"].includes(user.role)) {
      router.replace("/profile");
      return;
    }
    getSettlements().then((data) => {
      setSettlements(data);
      setLoading(false);
    });
  }, [router]);

  const totalPaid = settlements
    .filter((s) => s.status === "PAID")
    .reduce((acc, s) => acc + s.netAmount, 0);

  const totalPending = settlements
    .filter((s) => s.status === "PENDING")
    .reduce((acc, s) => acc + s.netAmount, 0);

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
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Finance</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Settlements & Payouts</h1>
        <p className="mt-2 text-sm text-text/60">
          Track manufacturer and partner payout settlements.
        </p>

        {/* Summary cards */}
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-[16px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-text/50">Total Paid Out</p>
            <p className="mt-2 text-2xl font-semibold text-green-600">
              ₹{totalPaid.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-[16px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-text/50">Pending Payout</p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">
              ₹{totalPending.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-[16px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-text/50">Total Settlements</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{settlements.length}</p>
          </div>
        </div>

        {/* Settlements table */}
        {settlements.length === 0 && (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">💳</p>
            <p className="text-sm">No settlements recorded yet.</p>
          </div>
        )}

        {settlements.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-[20px] border border-black/6 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-black/[0.02] border-b border-black/6">
                <tr>
                  {["Manufacturer", "Period", "Gross Revenue", "Platform Fee", "Net Payout", "Status", "Paid At"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-black/4 hover:bg-black/[0.01]">
                    <td className="px-4 py-3 font-medium text-primary">{s.manufacturerName}</td>
                    <td className="px-4 py-3 text-text/70">{s.period}</td>
                    <td className="px-4 py-3 text-text">₹{s.grossRevenue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-text/70">₹{s.platformFee.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-semibold text-primary">₹{s.netAmount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status.toUpperCase()] ?? "bg-black/5 text-text border-black/10"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text/60">
                      {s.paidAt
                        ? new Date(s.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
