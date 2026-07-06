"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getMyRefunds, getStoredToken } from "@/lib/api";
import type { Refund } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED:   "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED:   "bg-red-50 text-red-700 border-red-200",
  PROCESSING: "bg-purple-50 text-purple-700 border-purple-200",
  COMPLETED:  "bg-green-50 text-green-700 border-green-200",
};

export default function RefundsPage() {
  const router = useRouter();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login?redirect=/refunds"); return; }
    getMyRefunds().then((r) => { setRefunds(r); setLoading(false); });
  }, [router]);

  if (loading) return (
    <main><Navbar />
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
      </div>
    </main>
  );

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <h1 className="font-serif text-4xl text-primary mt-3">My Refunds</h1>
        <p className="mt-2 text-sm text-text/60">Track refund status for your returned items.</p>

        <div className="mt-6">
          <Link href="/returns" className="text-sm text-accent hover:underline">→ Submit a return request</Link>
        </div>

        {refunds.length === 0 ? (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">💸</p>
            <p className="text-sm">No refunds yet.</p>
            <p className="text-xs mt-1">Approved return requests will appear here.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {refunds.map((refund) => (
              <div key={refund.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-text/40">Refund #{refund.id.slice(0, 8).toUpperCase()}</p>
                      <span className="text-text/20">·</span>
                      <p className="text-xs text-text/40">Order #{refund.orderId.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <p className="font-semibold text-primary text-lg">₹{refund.amount.toLocaleString("en-IN")}</p>
                    {refund.reason && (
                      <p className="text-sm text-text/60 mt-1 truncate">Reason: {refund.reason}</p>
                    )}
                    {refund.processedAt && (
                      <p className="text-xs text-text/40 mt-1">
                        Processed: {new Date(refund.processedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[refund.status] ?? "bg-black/5 text-text border-black/10"}`}>{refund.status}</span>
                </div>
                <p className="text-xs text-text/30 mt-3 border-t border-black/5 pt-3">
                  Requested {new Date(refund.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
