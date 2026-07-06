"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getCommunityFeed,
  getTrendingPosts,
  getContestPosts,
  createCommunityPost,
  likeCommunityPost,
  addComment,
  getPostComments,
  shareCommunityPost,
  reportCommunityPost,
  deleteCommunityPost,
  getStoredToken,
  getCurrentUser,
} from "@/lib/api";
import type { CommunityPost, CommunityComment } from "@/lib/api";

const TABS = ["Feed", "Trending", "Contest"] as const;
type Tab = (typeof TABS)[number];

const BTN =
  "rounded-full px-4 py-2 text-sm font-medium transition";
const BTN_PRIMARY =
  `${BTN} bg-primary text-background hover:opacity-90 disabled:opacity-50`;
const BTN_GHOST =
  `${BTN} border border-black/10 text-primary hover:bg-black/5`;
const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onDelete,
}: {
  post: CommunityPost;
  currentUserId: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const data = await getPostComments(post.id);
    setComments(data);
    setLoadingComments(false);
  }, [post.id]);

  const handleToggleComments = () => {
    if (!showComments) loadComments();
    setShowComments((v) => !v);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUserId) return;
    setSubmittingComment(true);
    try {
      const newComment = await addComment(post.id, commentText.trim());
      setComments((c) => [...c, newComment]);
      setCommentText("");
    } catch { /* ignore */ }
    setSubmittingComment(false);
  };

  const handleShare = async () => {
    await shareCommunityPost(post.id);
    if (navigator.share) {
      navigator.share({ title: post.caption, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      await reportCommunityPost(post.id, reportReason.trim());
      setReported(true);
      setShowReport(false);
    } catch { /* already reported */ }
  };

  return (
    <article className="rounded-[20px] border border-black/6 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-semibold text-accent uppercase">
            {post.userName.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-medium text-primary">{post.userName}</p>
            <p className="text-xs text-text/50">{timeAgo(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.contestEntry && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Contest
            </span>
          )}
          {currentUserId === post.userId && (
            <button
              onClick={() => onDelete(post.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="relative aspect-square w-full overflow-hidden bg-black/5">
          <img
            src={post.imageUrl}
            alt={post.caption}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Caption */}
      <div className="px-5 py-3">
        <p className="text-sm text-text leading-relaxed">{post.caption}</p>
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="text-xs text-accent">#{t}</span>
            ))}
          </div>
        )}
        {post.outfitId && (
          <Link
            href={`/outfits/${post.outfitId}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Shop this look →
          </Link>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-5 pb-4 border-t border-black/6 pt-3">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1.5 text-sm transition ${post.liked ? "text-red-500 font-medium" : "text-text/60 hover:text-red-500"}`}
        >
          {post.liked ? "♥" : "♡"} {post.likeCount}
        </button>
        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 text-sm text-text/60 hover:text-primary transition"
        >
          💬 {post.commentCount}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm text-text/60 hover:text-primary transition"
        >
          ↗ Share
        </button>
        {currentUserId && !reported && (
          <button
            onClick={() => setShowReport((v) => !v)}
            className="ml-auto text-xs text-text/40 hover:text-red-400 transition"
          >
            Report
          </button>
        )}
        {reported && <span className="ml-auto text-xs text-text/40">Reported</span>}
      </div>

      {/* Report form */}
      {showReport && (
        <div className="px-5 pb-4 flex gap-2">
          <input
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason for report…"
            className={INPUT_CLS}
          />
          <button onClick={handleReport} className={BTN_PRIMARY}>Send</button>
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="border-t border-black/6 px-5 pb-4 pt-3 space-y-3">
          {loadingComments && (
            <p className="text-xs text-text/40">Loading…</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-black/10 flex items-center justify-center text-xs font-medium uppercase flex-shrink-0">
                {c.userName.slice(0, 1)}
              </div>
              <div>
                <span className="text-xs font-medium text-primary">{c.userName} </span>
                <span className="text-xs text-text">{c.body}</span>
                <p className="text-xs text-text/40">{timeAgo(c.createdAt)}</p>
              </div>
            </div>
          ))}
          {currentUserId && (
            <form onSubmit={handleSubmitComment} className="flex gap-2 pt-1">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className={INPUT_CLS}
              />
              <button type="submit" disabled={submittingComment} className={BTN_PRIMARY}>
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>("Feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [outfitId, setOutfitId] = useState("");
  const [tags, setTags] = useState("");
  const [contestEntry, setContestEntry] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const user = getCurrentUser();
  const isLoggedIn = !!getStoredToken();

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      if (tab === "Feed") {
        const data = await getCommunityFeed({ limit: LIMIT, offset: currentOffset });
        setPosts((prev) => reset ? data.posts : [...prev, ...data.posts]);
        setHasMore(currentOffset + data.posts.length < data.total);
        setOffset(currentOffset + data.posts.length);
      } else if (tab === "Trending") {
        const data = await getTrendingPosts(20);
        setPosts(data);
        setHasMore(false);
      } else {
        const data = await getContestPosts(20);
        setPosts(data);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, offset]);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    loadPosts(true);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLike = async (postId: string) => {
    if (!isLoggedIn) return;
    try {
      const result = await likeCommunityPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: result.liked, likeCount: result.likeCount }
            : p
        )
      );
    } catch { /* ignore */ }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deleteCommunityPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch { /* ignore */ }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) { setCreateError("Caption is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const post = await createCommunityPost({
        caption: caption.trim(),
        imageUrl: imageUrl.trim() || undefined,
        outfitId: outfitId.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        contestEntry,
      });
      setPosts((prev) => [post, ...prev]);
      setCaption(""); setImageUrl(""); setOutfitId(""); setTags(""); setContestEntry(false);
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Community</p>
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-serif text-4xl text-primary">Style Feed</h1>
          {isLoggedIn && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              className={BTN_PRIMARY}
            >
              + Share Look
            </button>
          )}
        </div>

        {/* Create post form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mt-6 rounded-[20px] border border-black/10 bg-white p-6 shadow-sm space-y-4"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-accent">New Post</p>
            {createError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {createError}
              </div>
            )}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your look…"
              rows={3}
              className={INPUT_CLS}
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Image URL (optional)"
              className={INPUT_CLS}
            />
            <input
              value={outfitId}
              onChange={(e) => setOutfitId(e.target.value)}
              placeholder="Outfit ID for Shop this look (optional)"
              className={INPUT_CLS}
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated, e.g. bollywood, wedding)"
              className={INPUT_CLS}
            />
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
              <input
                type="checkbox"
                checked={contestEntry}
                onChange={(e) => setContestEntry(e.target.checked)}
                className="h-4 w-4 rounded border-black/20"
              />
              Enter contest
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className={BTN_PRIMARY}>
                {creating ? "Posting…" : "Post"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className={BTN_GHOST}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="mt-8 flex gap-2 border-b border-black/6 pb-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-text/50 hover:text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="mt-6 space-y-5">
          {loading && posts.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
            </div>
          )}
          {!loading && posts.length === 0 && (
            <div className="text-center py-16 text-text/40">
              <p className="text-3xl mb-3">👗</p>
              <p className="text-sm">No posts yet. Be the first to share your look!</p>
              {!isLoggedIn && (
                <Link href="/login" className="mt-4 inline-block text-sm text-accent hover:underline">
                  Log in to post
                </Link>
              )}
            </div>
          )}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user ? null : null}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          ))}
          {hasMore && !loading && (
            <div className="flex justify-center pt-4">
              <button onClick={() => loadPosts()} className={BTN_GHOST}>
                Load more
              </button>
            </div>
          )}
          {loading && posts.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
