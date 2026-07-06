"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getStorefrontAnalytics, getStorefrontPayouts, getStoredToken } from "@/lib/api";
import type { StorefrontAnalytics, StorefrontPayout } from "@/lib/api";

type Tab = "overview" | "payouts";

const PAYOUT_BADGE: Record<string, string> = {
  PAID:    "bg-green-50 text-green-700 border-green-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function StorefrontAnalyticsPage() {
  const { celebrityId } = useParams<{ celebrityId: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [analytics, setAnalytics] = useState<StorefrontAnalytics | null>(null);
  const [payouts, setPayouts] = useState<StorefrontPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getStoredToken()) { router.replace(`/login?redirect=/storefronts/${celebrityId}/analytics`); return; }
    Promise.all([
      getStorefrontAnalytics(celebrityId),
      getStorefrontPayouts(celebrityId),
    ]).then(([ana, payData]) => {
      setAnalytics(ana);
      setPayouts(payData?.payouts ?? []);
      setLoading(false);
    }).catch(() => { setError("Could not load analytics."); setLoading(false); });
  }, [celebrityId, router]);

  if (loading) return (
    <main><Navbar />
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
      </div>
    </main>
  );

  if (error) return (
    <main><Navbar />
      <div className="flex min-h-[60vh] items-center justify-center flex-col gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <Link href={`/storefronts/${celebrityId}`} className="text-sm text-accent hover:underline">Back to storefront</Link>
      </div>
    </main>
  );

  const maxViews = analytics ? Math.max(...analytics.monthly.map((m) => m.views), 1) : 1;

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-text/40 mb-6">
          <Link href="/storefronts" className="hover:text-accent transition">Storefronts</Link>
          <span>/</span>
          <Link href={`/storefronts/${celebrityId}`} className="hover:text-accent transition">{celebrityId}</Link>
          <span>/</span>
          <span className="text-text/70">Analytics</span>
        </div>

        <p className="text-xs uppercase tracking-[0.36em] text-accent">Storefront</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Analytics Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 mt-8 rounded-full border border-black/8 bg-black/[0.02] p-1 w-fit">
          {(["overview", "payouts"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-white shadow-sm text-primary" : "text-text/50 hover:text-primary"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && analytics && (
          <div className="mt-8 space-y-6">
            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Total Views", value: analytics.totalViews.toLocaleString() },
                { label: "Unique Visitors", value: analytics.uniqueVisitors.toLocaleString() },
                { label: "Conversions", value: analytics.conversions.toLocaleString() },
                { label: "Conv. Rate", value: `${analytics.conversionRate}%` },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-text/40">{kpi.label}</p>
                  <p className="font-serif text-3xl text-primary mt-2">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Monthly views bar chart */}
            <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">Monthly Views (last 6 months)</p>
              <div className="flex items-end gap-3 h-36">
                {analytics.monthly.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-xs text-text/40">{m.views}</p>
                    <div className="w-full rounded-t-md bg-accent/20 transition-all" style={{ height: `${(m.views / maxViews) * 100}%`, minHeight: "4px" }}>
                      <div className="h-full w-full rounded-t-md bg-accent opacity-60" />
                    </div>
                    <p className="text-xs text-text/40 mt-1">{m.month.slice(5)}/{m.month.slice(2, 4)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversions per month */}
            {analytics.monthly.some((m) => m.conversions > 0) && (
              <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">Monthly Conversions</p>
                <div className="flex items-end gap-3 h-24">
                  {analytics.monthly.map((m) => {
                    const maxConv = Math.max(...analytics.monthly.map((x) => x.conversions), 1);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <p className="text-xs text-text/40">{m.conversions}</p>
                        <div className="w-full rounded-t-md bg-emerald-100 transition-all" style={{ height: `${(m.conversions / maxConv) * 100}%`, minHeight: "4px" }}>
                          <div className="h-full w-full rounded-t-md bg-emerald-500 opacity-70" />
                        </div>
                        <p className="text-xs text-text/40 mt-1">{m.month.slice(5)}/{m.month.slice(2, 4)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top outfits */}
            {analytics.topOutfits.length > 0 && (
              <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.24em] text-text/40 mb-4">Top Outfit Views</p>
                <div className="space-y-3">
                  {analytics.topOutfits.map((item, i) => (
                    <div key={item.outfitId} className="flex items-center gap-3">
                      <span className="text-xs text-text/30 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <Link href={`/outfits/${item.outfitId}`} className="text-sm text-primary hover:text-accent transition truncate block">{item.outfitId.slice(0, 16)}…</Link>
                      </div>
                      <span className="text-sm font-medium text-text/70">{item.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "payouts" && (
          <div className="mt-8 space-y-4">
            {payouts.length === 0 ? (
              <div className="text-center text-text/40 py-12"><p className="text-3xl mb-3">💰</p><p className="text-sm">No payout history yet.</p></div>
            ) : payouts.map((payout) => (
              <div key={payout.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-primary">{payout.period}</p>
                    <div className="flex gap-4 mt-1 text-sm text-text/60">
                      <span>Gross: ₹{payout.gross.toLocaleString("en-IN")}</span>
                      <span className="text-accent font-medium">Commission: ₹{payout.commission.toLocaleString("en-IN")}</span>
                    </div>
                    {payout.paidAt && (
                      <p className="text-xs text-text/40 mt-1">Paid {new Date(payout.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${PAYOUT_BADGE[payout.status] ?? "bg-black/5 text-text border-black/10"}`}>{payout.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
