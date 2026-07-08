"use client";

import { useEffect, useState } from "react";
import { getAdminStorefronts, updateAdminStorefront } from "../admin-api";
import type { AdminStorefront } from "../admin-api";

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

export function StorefrontsTab() {
  const [storefronts, setStorefronts] = useState<AdminStorefront[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAdminStorefronts()
      .then(setStorefronts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string, field: "isPublished" | "verified", current: boolean) => {
    setActionLoading(`${id}-${field}`);
    try {
      const updated = await updateAdminStorefront(id, { [field]: !current });
      setStorefronts((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s));
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
    setActionLoading(null);
  };

  const filtered = storefronts.filter((s) =>
    !search || s.displayName.toLowerCase().includes(search.toLowerCase()) ||
    s.celebrity.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by storefront or celebrity name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <div key={s.id} className="rounded-[20px] border border-black/6 bg-white overflow-hidden shadow-sm">
              {s.bannerImage && (
                <div className="h-28 overflow-hidden bg-secondary">
                  <img src={s.bannerImage} alt={s.displayName} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg text-primary">{s.displayName}</p>
                    <p className="text-xs text-text/50">by {s.celebrity.name}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-right shrink-0">
                    {s.verified && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">✓ Verified</span>
                    )}
                    {s.isPublished
                      ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Published</span>
                      : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Draft</span>
                    }
                  </div>
                </div>
                {s.message && <p className="mt-2 text-xs text-text/50 line-clamp-2 italic">{s.message}</p>}
                <div className="mt-2 text-xs text-text/50">
                  Commission: <strong>{(s.commissionRate * 100).toFixed(1)}%</strong>
                </div>
                <div className="mt-4 flex gap-2 border-t border-black/6 pt-4 flex-wrap">
                  <button
                    onClick={() => toggle(s.id, "isPublished", s.isPublished)}
                    disabled={actionLoading === `${s.id}-isPublished`}
                    className={`${BTN_SM} ${s.isPublished ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-green-200 text-green-700 hover:bg-green-50"} disabled:opacity-50`}
                  >
                    {actionLoading === `${s.id}-isPublished` ? "…" : s.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => toggle(s.id, "verified", s.verified)}
                    disabled={actionLoading === `${s.id}-verified`}
                    className={`${BTN_SM} ${s.verified ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-blue-200 text-blue-700 hover:bg-blue-50"} disabled:opacity-50`}
                  >
                    {actionLoading === `${s.id}-verified` ? "…" : s.verified ? "Unverify" : "Verify"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-[20px] border border-black/6 bg-white p-12 text-center">
              <p className="text-sm text-text/40">No storefronts found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
