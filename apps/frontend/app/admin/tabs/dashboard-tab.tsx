"use client";

import { useEffect, useState } from "react";
import { getAdminStats } from "../admin-api";
import type { AdminStats, AdminOrder, AdminProduct, LowStockItem } from "../admin-api";

type DashboardData = {
  stats: AdminStats;
  ordersByStatus: { status: string; count: number }[];
  recentOrders: AdminOrder[];
  topProducts: AdminProduct[];
  lowStockItems: LowStockItem[];
};

const STATUS_COLOR: Record<string, string> = {
  PLACED:              "bg-blue-500",
  CONFIRMED:           "bg-indigo-500",
  PRODUCTION_STARTED:  "bg-violet-500",
  QUALITY_CHECK:       "bg-amber-500",
  SHIPPED:             "bg-orange-500",
  OUT_FOR_DELIVERY:    "bg-lime-500",
  DELIVERED:           "bg-green-500",
  CANCELLED:           "bg-red-500",
  RETURN_REQUESTED:    "bg-rose-500",
  REFUNDED:            "bg-gray-500",
};

function StatCard({ label, value, sub, color = "text-primary" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.28em] text-text/50">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-text/40">{sub}</p>}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  PLACED:             "bg-blue-50 text-blue-700",
  CONFIRMED:          "bg-indigo-50 text-indigo-700",
  PRODUCTION_STARTED: "bg-violet-50 text-violet-700",
  SHIPPED:            "bg-orange-50 text-orange-700",
  DELIVERED:          "bg-green-50 text-green-700",
  CANCELLED:          "bg-red-50 text-red-700",
  REFUNDED:           "bg-gray-50 text-gray-700",
};

export function DashboardTab() {
  const [data, setData]   = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminStats()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
    </div>
  );

  if (error) return (
    <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
  );

  if (!data) return null;

  const { stats, ordersByStatus, recentOrders, topProducts, lowStockItems } = data;
  const totalOrderCount = ordersByStatus.reduce((s, o) => s + o.count, 0) || 1;

  return (
    <div className="space-y-8">
      {/* Primary stats */}
      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent">Platform Overview</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Users"      value={stats.totalUsers.toLocaleString()}     sub={`${stats.activeUsers.toLocaleString()} active`} />
          <StatCard label="Total Orders"     value={stats.totalOrders.toLocaleString()}    sub={`${stats.pendingOrders} pending`} />
          <StatCard label="Gross Revenue"    value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} color="text-green-600" />
          <StatCard label="Pending Reviews"  value={stats.pendingReviews}                  sub={`${stats.totalReviews} total`} color={stats.pendingReviews > 0 ? "text-amber-600" : "text-primary"} />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Products",      value: stats.totalProducts },
          { label: "Celebrities",   value: stats.totalCelebrities },
          { label: "Manufacturers", value: stats.totalManufacturers },
          { label: "Storefronts",   value: stats.totalStorefronts },
          { label: "Active Coupons",value: stats.activeCoupons },
          { label: "Open Returns",  value: stats.pendingReturns, color: stats.pendingReturns > 0 ? "text-rose-600" : undefined },
        ].map((s) => (
          <div key={s.label} className="rounded-[16px] border border-black/6 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs text-text/50">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.color ?? "text-primary"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order status breakdown */}
        <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent">Order Status Breakdown</p>
          <div className="space-y-3">
            {ordersByStatus.map((o) => (
              <div key={o.status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text/70">{o.status.replace(/_/g, " ")}</span>
                  <span className="text-sm font-medium text-primary">{o.count}</span>
                </div>
                <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_COLOR[o.status] ?? "bg-accent"}`}
                    style={{ width: `${Math.max(2, (o.count / totalOrderCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {ordersByStatus.length === 0 && (
              <p className="text-sm text-text/40 text-center py-4">No orders yet.</p>
            )}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent">Top Selling Products</p>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-xs text-text/40 font-medium shrink-0">#{i + 1}</span>
                <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-secondary">
                  <img src={p.imageUrl || undefined} alt={p.movieName} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{p.movieName}</p>
                  <p className="text-xs text-text/50">{p.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-text/50">{p.orderCount} orders</p>
                  <p className="text-xs font-medium text-primary">₹{p.basePrice.toLocaleString("en-IN")}</p>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-sm text-text/40 text-center py-4">No products with orders yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent">Recent Orders</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                <th className="pb-2 pr-4 font-medium">Order</th>
                <th className="pb-2 pr-4 font-medium">Customer</th>
                <th className="pb-2 pr-4 font-medium">Amount</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {recentOrders.map((o) => (
                <tr key={o.id} className="text-sm">
                  <td className="py-2.5 pr-4 font-mono text-xs text-text/70">{o.orderNumber}</td>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-primary truncate max-w-[140px]">{o.shippingName}</p>
                    <p className="text-xs text-text/50 truncate max-w-[140px]">{o.customerEmail}</p>
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-primary">₹{Number(o.total).toLocaleString("en-IN")}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status] ?? "bg-gray-50 text-gray-600"}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-text/50">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-text/40">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-amber-700">⚠ Low Stock Alerts</p>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl bg-white p-3">
                <div className="flex items-center gap-3">
                  <img src={item.product.imageUrl || undefined} alt={item.product.movieName} className="h-8 w-8 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div>
                    <p className="text-sm font-medium text-primary">{item.product.movieName}</p>
                    <p className="text-xs text-text/50">Size: {item.variant.size} • {item.warehouse.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">{item.quantity} left</p>
                  <p className="text-xs text-text/40">threshold: {item.lowStockThreshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
