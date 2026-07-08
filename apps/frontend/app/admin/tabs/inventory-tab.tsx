"use client";

import { useEffect, useState } from "react";
import { apiFetchAdmin } from "../admin-api";
import type { AdminInventoryItem } from "../admin-api";

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

export function InventoryTab() {
  const [items, setItems]   = useState<AdminInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [adjustItem, setAdjustItem] = useState<AdminInventoryItem | null>(null);
  const [delta, setDelta]           = useState("0");
  const [reason, setReason]         = useState("ADJUSTMENT");
  const [adjusting, setAdjusting]   = useState(false);

  const load = () => {
    setLoading(true);
    apiFetchAdmin<{ data: AdminInventoryItem[] }>("/api/inventory/admin")
      .then((res) => setItems(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdjust = async () => {
    if (!adjustItem) return;
    const d = parseInt(delta);
    if (isNaN(d) || d === 0) { setError("Enter a non-zero delta"); return; }
    setAdjusting(true);
    try {
      await apiFetchAdmin("/api/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({ variantId: adjustItem.variant.id, warehouseId: adjustItem.warehouse.id, delta: d, notes: reason }),
      });
      setItems((prev) => prev.map((item) =>
        item.id === adjustItem.id ? { ...item, quantity: item.quantity + d } : item
      ));
      setAdjustItem(null);
      setDelta("0");
    } catch (e) { setError(e instanceof Error ? e.message : "Adjustment failed"); }
    setAdjusting(false);
  };

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.product.movieName.toLowerCase().includes(search.toLowerCase()) ||
      item.variant.sku.toLowerCase().includes(search.toLowerCase());
    const matchLow = !lowStockOnly || item.quantity <= item.lowStockThreshold;
    return matchSearch && matchLow;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          placeholder="Search by product or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <label className="flex items-center gap-2 text-sm text-text/70 cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="h-4 w-4" />
          Low stock only
        </label>
        <button onClick={load} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-text/70 hover:bg-secondary transition">
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
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Size / Color</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Warehouse</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Reserved</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-secondary/30 transition-colors ${item.quantity <= item.lowStockThreshold ? "bg-amber-50/50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <img src={item.product.imageUrl} alt={item.product.movieName} className="h-8 w-8 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary max-w-[180px]">{item.product.movieName}</p>
                          <p className="text-xs text-text/40">₹{Number(item.product.basePrice).toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text/70">{item.variant.size}{item.variant.color ? ` / ${item.variant.color}` : ""}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text/60">{item.variant.sku}</td>
                    <td className="px-4 py-3 text-text/70">{item.warehouse.name}<br/><span className="text-xs text-text/40">{item.warehouse.city}</span></td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${item.quantity <= item.lowStockThreshold ? "text-amber-600" : item.quantity === 0 ? "text-red-600" : "text-green-700"}`}>
                        {item.quantity}
                      </span>
                      {item.quantity <= item.lowStockThreshold && (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Low</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text/60">{item.reservedQuantity}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setAdjustItem(item); setDelta("0"); setReason("ADJUSTMENT"); }}
                        className={`${BTN_SM} border-black/10 text-text/70 hover:bg-secondary`}>
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-text/40">No inventory found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Adjust modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">Adjust Stock</h3>
            <p className="mt-1 text-sm text-text/60">
              {adjustItem.product.movieName} · {adjustItem.variant.size} · {adjustItem.warehouse.name}
            </p>
            <p className="mt-2 text-sm text-text/70">Current: <strong>{adjustItem.quantity}</strong></p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Delta (+/-)</label>
                <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                {delta !== "0" && !isNaN(parseInt(delta)) && (
                  <p className="mt-1 text-xs text-text/50">New quantity: {adjustItem.quantity + parseInt(delta)}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                  <option value="INBOUND">Inbound Restock</option>
                  <option value="WRITE_OFF">Write Off</option>
                  <option value="RETURN">Return Restock</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleAdjust} disabled={adjusting}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background disabled:opacity-50">
                {adjusting ? "Saving…" : "Confirm"}
              </button>
              <button onClick={() => setAdjustItem(null)}
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
