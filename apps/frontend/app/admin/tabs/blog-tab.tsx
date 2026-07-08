"use client";

import { useEffect, useState } from "react";
import { getBlogPosts } from "@/lib/api";
import { createAdminBlogPost, updateAdminBlogPost, deleteAdminBlogPost } from "../admin-api";
import type { BlogPost } from "@/lib/api";

const INPUT = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

type PostForm = {
  title: string;
  summary: string;
  body: string;
  coverImage: string;
  tags: string;
  isPublished: boolean;
};

const EMPTY_FORM: PostForm = { title: "", summary: "", body: "", coverImage: "", tags: "", isPublished: false };

export function BlogTab() {
  const [posts, setPosts]   = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [search, setSearch] = useState("");

  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [form, setForm]         = useState<PostForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = () => {
    setLoading(true);
    getBlogPosts({ limit: 100 })
      .then(({ posts }) => setPosts(posts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditPost(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setSaveError("");
  };

  const openEdit = (post: BlogPost) => {
    setEditPost(post);
    setIsNew(false);
    setForm({
      title:       post.title,
      summary:     post.summary,
      body:        post.body,
      coverImage:  post.coverImage ?? "",
      tags:        post.tags.join(", "),
      isPublished: post.published,
    });
    setSaveError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.summary || !form.body) {
      setSaveError("Title, summary, and body are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        title:       form.title,
        summary:     form.summary,
        body:        form.body,
        tags,
        ...(form.coverImage && { coverImage: form.coverImage }),
        isPublished: form.isPublished,
      };

      if (isNew) {
        const created = await createAdminBlogPost(payload);
        // Reload to get full post data
        const { posts: fresh } = await getBlogPosts({ limit: 100 });
        setPosts(fresh);
        void created;
      } else if (editPost) {
        await updateAdminBlogPost(editPost.id, payload);
        setPosts((prev) => prev.map((p) => p.id === editPost.id ? {
          ...p,
          ...payload,
          tags,
          published: form.isPublished,
          coverImage: form.coverImage || null,
        } : p));
      }
      setEditPost(null);
      setIsNew(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Delete post "${post.title}"?`)) return;
    try {
      await deleteAdminBlogPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filtered = posts.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const showEditor = isNew || !!editPost;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search posts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button onClick={openNew}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition">
          + New Post
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <div key={post.id} className="rounded-[20px] border border-black/6 bg-white overflow-hidden shadow-sm">
              {post.coverImage && (
                <div className="aspect-[16/7] overflow-hidden bg-secondary">
                  <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-lg text-primary line-clamp-2">{post.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {post.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text/50 line-clamp-2">{post.summary}</p>
                {post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-text/60">#{tag}</span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2 border-t border-black/6 pt-4">
                  <button onClick={() => openEdit(post)} className={`${BTN_SM} border-black/10 text-text/70 hover:bg-secondary`}>Edit</button>
                  <button onClick={() => handleDelete(post)} className={`${BTN_SM} border-red-200 text-red-600 hover:bg-red-50`}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-[20px] border border-black/6 bg-white p-12 text-center">
              <p className="text-sm text-text/40">No posts found.</p>
              <button onClick={openNew} className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-medium text-background">
                Create First Post
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">{isNew ? "New Blog Post" : "Edit Post"}</h3>
            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Title *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={INPUT} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Summary *</label>
                <textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} required rows={2}
                  className={`${INPUT} resize-y`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Body *</label>
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required rows={8}
                  className={`${INPUT} resize-y`} placeholder="Write the full post content here…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Cover Image URL</label>
                  <input value={form.coverImage} onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))} className={INPUT} placeholder="https://…" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Tags (comma separated)</label>
                  <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className={INPUT} placeholder="fashion, bollywood, …" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="published" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} className="h-4 w-4" />
                <label htmlFor="published" className="text-sm text-text/70">Publish immediately</label>
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background disabled:opacity-50">
                  {saving ? "Saving…" : isNew ? "Create Post" : "Save Changes"}
                </button>
                <button type="button" onClick={() => { setEditPost(null); setIsNew(false); }}
                  className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-text/70">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
