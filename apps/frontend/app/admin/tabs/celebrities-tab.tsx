"use client";

import { useState } from "react";
import type { Celebrity } from "@/lib/api";
import { createCelebrity, updateCelebrity, deleteCelebrity } from "@/lib/api";

type Props = {
  celebrities: Celebrity[];
  setCelebrities: (c: Celebrity[]) => void;
};

const EMPTY_FORM = { name: "", industry: "", bio: "", profileImage: "", bannerImage: "", styleTags: "" };
const INDUSTRIES = ["Bollywood", "Tollywood", "Kollywood", "Mollywood", "Hollywood", "Other"];

export function CelebritiesTab({ celebrities, setCelebrities }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = celebrities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (c: Celebrity) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      industry: c.industry,
      bio: c.bio,
      profileImage: c.profileImage,
      bannerImage: c.bannerImage,
      styleTags: c.styleTags.join(", ")
    });
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        industry: form.industry,
        bio: form.bio.trim(),
        profileImage: form.profileImage.trim(),
        bannerImage: form.bannerImage.trim() || form.profileImage.trim(),
        styleTags: form.styleTags.split(",").map((t) => t.trim()).filter(Boolean)
      };
      if (editId) {
        const updated = await updateCelebrity(editId, payload);
        setCelebrities(celebrities.map((c) => (c.id === editId ? updated : c)));
      } else {
        const created = await createCelebrity(payload);
        setCelebrities([...celebrities, created]);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteCelebrity(id);
      setCelebrities(celebrities.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setError(msg.includes("403") ? "Deleting celebrities requires SUPER_ADMIN role." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search celebrities..."
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <button
          onClick={openAdd}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          + Add Celebrity
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] bg-background p-8 shadow-luxe">
            <h2 className="font-serif text-3xl text-primary">{editId ? "Edit Celebrity" : "Add Celebrity"}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Alia Bhatt" required />
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Industry *</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  required
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <Field label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} placeholder="Short biography..." textarea />
              <Field label="Profile Image URL" value={form.profileImage} onChange={(v) => setForm({ ...form, profileImage: v })} placeholder="https://..." />
              <Field label="Banner Image URL" value={form.bannerImage} onChange={(v) => setForm({ ...form, bannerImage: v })} placeholder="https://... (defaults to profile image)" />
              <Field label="Style Tags (comma-separated)" value={form.styleTags} onChange={(v) => setForm({ ...form, styleTags: v })} placeholder="Red Carpet, Wedding, Festive" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                  {loading ? "Saving..." : editId ? "Save Changes" : "Add Celebrity"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-primary transition hover:bg-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-background p-8 shadow-luxe">
            <h2 className="font-serif text-2xl text-primary">Delete Celebrity?</h2>
            <p className="mt-2 text-sm text-text/70">This will permanently remove the celebrity and all associated data.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} disabled={loading} className="flex-1 rounded-full bg-red-600 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50">
                {loading ? "Deleting..." : "Delete"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-primary transition hover:bg-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-[24px] border border-black/6 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 bg-secondary/40">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60">Celebrity</th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60">Industry</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60 md:table-cell">Style Tags</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-[0.24em] text-text/60">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {filtered.map((c) => (
              <tr key={c.id} className="transition hover:bg-secondary/20">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {c.profileImage && (
                      <img src={c.profileImage} alt={c.name} className="h-9 w-9 rounded-xl object-cover" />
                    )}
                    <div>
                      <p className="font-medium text-primary">{c.name}</p>
                      <p className="text-xs text-text/50">{c.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-text/70">{c.industry}</td>
                <td className="hidden px-5 py-4 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.styleTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">{tag}</span>
                    ))}
                    {c.styleTags.length > 3 && <span className="text-xs text-text/40">+{c.styleTags.length - 3}</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(c)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary">
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirm(c.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-text/50">No celebrities found</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, required, textarea
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; textarea?: boolean;
}) {
  const cls = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className={cls} />
      )}
    </div>
  );
}
