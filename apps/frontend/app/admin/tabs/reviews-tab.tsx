"use client";

import { useEffect, useState } from "react";
import { getAdminReviews, approveAdminReview, rejectAdminReview, deleteAdminReview } from "../admin-api";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isApproved: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; movieName: string; imageUrl: string };
};

const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition";

export function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState<"pending" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAdminReviews({ limit: 100 })
      .then(setReviews)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveAdminReview(id);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, isApproved: true } : r));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await rejectAdminReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this review?")) return;
    setActionLoading(id);
    try {
      await deleteAdminReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setActionLoading(null);
  };

  const displayed = filter === "pending" ? reviews.filter((r) => !r.isApproved) : reviews;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-black/6 bg-white p-1 shadow-sm">
          {(["pending","all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition capitalize ${filter === f ? "bg-primary text-background" : "text-text/60 hover:text-primary"}`}>
              {f === "pending" ? `Pending (${reviews.filter(r => !r.isApproved).length})` : `All (${reviews.length})`}
            </button>
          ))}
        </div>
        <button onClick={load} className="rounded-xl border border-black/10 px-4 py-2 text-sm text-text/70 hover:bg-secondary transition">
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
          {displayed.map((r) => (
            <div key={r.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <img src={r.product.imageUrl} alt={r.product.movieName} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-primary">{r.product.movieName}</p>
                      <p className="text-xs text-text/50">by {r.user.name} ({r.user.email})</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isApproved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.isApproved ? "Approved" : "Pending"}
                      </span>
                      {r.isVerifiedPurchase && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">✓ Verified</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < r.rating ? "text-amber-400" : "text-gray-200"}>★</span>
                    ))}
                    <span className="ml-1 text-xs text-text/50">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                  {r.title && <p className="mt-2 text-sm font-medium text-primary">{r.title}</p>}
                  <p className="mt-1 text-sm text-text/70 line-clamp-2">{r.body}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-black/6 pt-4">
                {!r.isApproved && (
                  <button onClick={() => handleApprove(r.id)} disabled={actionLoading === r.id}
                    className={`${BTN_SM} bg-green-600 text-white hover:bg-green-700 disabled:opacity-50`}>
                    ✓ Approve
                  </button>
                )}
                <button onClick={() => handleReject(r.id)} disabled={actionLoading === r.id}
                  className={`${BTN_SM} border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50`}>
                  Reject
                </button>
                <button onClick={() => handleDelete(r.id)} disabled={actionLoading === r.id}
                  className={`${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50`}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {displayed.length === 0 && (
            <div className="rounded-[20px] border border-black/6 bg-white p-12 text-center">
              <p className="text-sm text-text/40">{filter === "pending" ? "No pending reviews — all caught up!" : "No reviews yet."}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
