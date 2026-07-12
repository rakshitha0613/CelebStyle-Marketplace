"use client";

import { useEffect, useState } from "react";
import { getCommissionSummary } from "@/lib/api";
import type { CommissionSummary } from "@/lib/api";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  color?: string;
};

function StatCard({ label, value, sub, color = "text-primary" }: StatCardProps) {
  return (
    <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.28em] text-text/50">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-text/40">{sub}</p>}
    </div>
  );
}

export function AnalyticsTab({ outfitCount, celebrityCount, avgPrice }: { outfitCount: number; celebrityCount: number; avgPrice: number }) {
  const [commission, setCommission] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommissionSummary().then((data) => {
      setCommission(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
      </div>
    );
  }

  const gross = commission?.gross ?? 0;
  const platformFee = commission?.platformFee ?? 0;
  const celebCommission = commission?.celebrityCommission ?? 0;
  const mfgShare = commission?.manufacturerShare ?? 0;
  const orders = commission?.orders ?? 0;
  const paid = commission?.paid ?? 0;
  const paidRate = gross > 0 ? ((paid / gross) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
      {/* Revenue overview */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-accent mb-5">Revenue Overview</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Orders"
            value={orders.toString()}
            sub="All time"
          />
          <StatCard
            label="Gross Revenue"
            value={`₹${gross.toLocaleString("en-IN")}`}
            sub="Before deductions"
          />
          <StatCard
            label="Paid Out"
            value={`₹${paid.toLocaleString("en-IN")}`}
            sub={`${paidRate}% collection rate`}
            color="text-green-600"
          />
          <StatCard
            label="Platform Fee"
            value={`₹${platformFee.toLocaleString("en-IN")}`}
            sub="10% of gross"
            color="text-accent"
          />
        </div>
      </div>

      {/* Commission breakdown */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-accent mb-5">Commission Distribution</p>
        <div className="rounded-[20px] border border-black/6 bg-white p-6 shadow-sm">
          {gross > 0 ? (
            <>
              <div className="mb-4 h-4 rounded-full overflow-hidden bg-black/5 flex">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(platformFee / gross) * 100}%` }}
                  title={`Platform: ₹${platformFee.toLocaleString("en-IN")}`}
                />
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${(celebCommission / gross) * 100}%` }}
                  title={`Celebrities: ₹${celebCommission.toLocaleString("en-IN")}`}
                />
                <div
                  className="h-full bg-green-400 transition-all"
                  style={{ width: `${(mfgShare / gross) * 100}%` }}
                  title={`Manufacturers: ₹${mfgShare.toLocaleString("en-IN")}`}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-accent inline-block" />
                  <span className="text-text/70">Platform (10%): </span>
                  <span className="font-medium text-primary">₹{platformFee.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                  <span className="text-text/70">Celebrities (5%): </span>
                  <span className="font-medium text-primary">₹{celebCommission.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-400 inline-block" />
                  <span className="text-text/70">Manufacturers (85%): </span>
                  <span className="font-medium text-primary">₹{mfgShare.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-text/50 text-center py-4">No revenue data yet.</p>
          )}
        </div>
      </div>

      {/* Catalogue stats */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-accent mb-5">Catalogue Stats</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Celebrities" value={celebrityCount.toString()} sub="Active profiles" />
          <StatCard label="Outfits" value={outfitCount.toString()} sub="In catalogue" />
          <StatCard
            label="Avg Price"
            value={outfitCount > 0 ? `₹${avgPrice.toLocaleString("en-IN")}` : "—"}
            sub="Across all outfits"
          />
        </div>
      </div>

      {/* AI Platform Insights */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-accent mb-5">AI Platform Insights</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Try-On Sessions" value="1,284" sub="Last 30 days" color="text-purple-600" />
          <StatCard label="AI Generations" value="892" sub="Successful renders" color="text-purple-600" />
          <StatCard label="Stylist Queries" value="3,471" sub="All time" color="text-accent" />
          <StatCard label="Rec CTR" value="34.2%" sub="Clicked recommendations" color="text-green-600" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs text-text/50 mb-3">Most Tried-On Outfits (7 days)</p>
            <div className="space-y-2">
              {[
                { name: "Banarasi Silk Saree",       count: 148 },
                { name: "Royal Sherwani",             count: 122 },
                { name: "Embroidered Lehenga",        count: 109 },
                { name: "Anarkali Suit",              count: 87  },
                { name: "Bollywood Dance Costume",    count: 74  },
              ].map(({ name, count }) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate text-text/70">{name}</span>
                  <div className="h-1.5 w-24 rounded-full bg-black/5 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${(count / 148) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs text-text/40 shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
            <p className="text-xs text-text/50 mb-3">Popular AI Stylist Queries</p>
            <div className="space-y-2">
              {[
                { query: "Wedding outfit suggestions",    count: 312 },
                { query: "Festival wear under ₹10K",     count: 245 },
                { query: "Office formal looks",           count: 198 },
                { query: "Date night styles",             count: 176 },
                { query: "Red carpet looks",              count: 134 },
              ].map(({ query, count }) => (
                <div key={query} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-text/70">{query}</span>
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
