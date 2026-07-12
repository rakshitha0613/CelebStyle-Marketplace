"use client";

import { useEffect, useState } from "react";
import { apiFetchAdmin, type CommunityPost } from "../admin-api";

type FlaggedPost = CommunityPost & { reports: Array<{ id: string; userId: string; reason: string; createdAt: string }> };

export function ModerationTab() {
  const [posts, setPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetchAdmin<{ data: FlaggedPost[] }>("/api/community/moderation");
      setPosts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (postId: string, action: "approve" | "remove") => {
    try {
      await apiFetchAdmin("/api/community/moderation/" + postId, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-accent">Content Moderation</p>
          <p className="mt-1 text-sm text-text/60">
            {posts.length} post{posts.length !== 1 ? "s" : ""} pending review
          </p>
        </div>
        <button onClick={load} className="text-xs text-accent hover:underline">Refresh</button>
      </div>

      {posts.length === 0 && (
        <div className="text-center py-16 rounded-[20px] border border-black/6 bg-white">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm text-text/60">No flagged content — moderation queue is clear.</p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                    post.status === "HIDDEN"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-green-50 text-green-700 border-green-200"
                  }`}>
                    {post.status}
                  </span>
                  <span className="text-xs text-red-600 font-medium">
                    {(post.reports ?? []).length} report{(post.reports ?? []).length !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm font-medium text-primary mb-1">by {post.userName}</p>
                <p className="text-sm text-text/80 leading-relaxed line-clamp-3">{post.caption}</p>
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="mt-3 h-24 w-24 rounded-xl object-cover border border-black/6"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {(post.reports ?? []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-text/60 uppercase tracking-wide">Reports</p>
                    {(post.reports ?? []).slice(0, 3).map((r) => (
                      <p key={r.id} className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
                        {r.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAction(post.id, "approve")}
                  className="rounded-full bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 transition"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(post.id, "remove")}
                  className="rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-text/40">
              Posted {new Date(post.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
