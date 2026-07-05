"use client";

import { useState } from "react";
import type { Outfit, Celebrity, Manufacturer } from "@/lib/api";
import { createOutfit, updateOutfit, deleteOutfit } from "@/lib/api";

type Props = {
  outfits: Outfit[];
  setOutfits: (o: Outfit[]) => void;
  celebrities: Celebrity[];
  manufacturers: Manufacturer[];
};

const OCCASIONS = ["Party", "Wedding", "Festival", "Casual", "Award", "Premiere", "Endorsement", "Film"];
const CATEGORIES = [
  "Saree", "Lehenga", "Gown", "Kurta", "Kurta Set", "Sherwani", "Bandhgala", "Suit",
  "Blazer", "Tuxedo", "Shirt + Veshti", "Nehru Jacket Set", "Evening Dress", "Western", "Other"
];

const EMPTY_FORM = {
  celebrityId: "", movieName: "", occasion: "", category: "", colorPalette: "",
  price: "", imageUrl: "", description: "", year: "", characterName: "", manufacturerIds: [] as string[]
};

export function OutfitsTab({ outfits, setOutfits, celebrities, manufacturers }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterOccasion, setFilterOccasion] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const celebMap = new Map(celebrities.map((c) => [c.id, c.name]));
  const mfrMap = new Map(manufacturers.map((m) => [m.id, m.name]));

  const filtered = outfits.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !search || o.movieName.toLowerCase().includes(q) || o.category.toLowerCase().includes(q) || o.celebrityName.toLowerCase().includes(q);
    const matchOccasion = !filterOccasion || o.occasion === filterOccasion;
    return matchSearch && matchOccasion;
  });

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (o: Outfit) => {
    setEditId(o.id);
    setForm({
      celebrityId: o.celebrityId,
      movieName: o.movieName,
      occasion: o.occasion,
      category: o.category,
      colorPalette: o.colorPalette,
      price: String(o.price),
      imageUrl: o.imageUrl,
      description: o.description,
      year: o.year !== undefined ? String(o.year) : "",
      characterName: o.characterName || "",
      manufacturerIds: o.manufacturerIds || []
    });
    setError("");
    setShowForm(true);
  };

  const toggleMfr = (id: string) => {
    setForm((f) => ({
      ...f,
      manufacturerIds: f.manufacturerIds.includes(id)
        ? f.manufacturerIds.filter((m) => m !== id)
        : [...f.manufacturerIds, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        celebrityId: form.celebrityId,
        movieName: form.movieName.trim(),
        occasion: form.occasion,
        category: form.category,
        colorPalette: form.colorPalette.trim(),
        price: Number(form.price) || 0,
        imageUrl: form.imageUrl.trim(),
        description: form.description.trim(),
        year: form.year.trim() ? Number(form.year.trim()) : undefined,
        characterName: form.characterName.trim(),
        manufacturerIds: form.manufacturerIds
      };
      if (editId) {
        const updated = await updateOutfit(editId, payload);
        setOutfits(outfits.map((o) => (o.id === editId ? updated : o)));
      } else {
        const created = await createOutfit(payload);
        setOutfits([...outfits, created]);
      }
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteOutfit(id);
      setOutfits(outfits.filter((o) => o.id !== id));
      setDeleteConfirm(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const cls = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search outfits..."
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <select
          value={filterOccasion}
          onChange={(e) => setFilterOccasion(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          <option value="">All occasions</option>
          {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button
          onClick={openAdd}
          className="ml-auto rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          + Add Outfit
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-[28px] bg-background p-8 shadow-luxe">
            <h2 className="font-serif text-3xl text-primary">{editId ? "Edit Outfit" : "Add Outfit"}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Celebrity *</label>
                <select value={form.celebrityId} onChange={(e) => setForm({ ...form, celebrityId: e.target.value })} required className={cls}>
                  <option value="">Select celebrity</option>
                  {celebrities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Movie / Event / Show *</label>
                  <input type="text" value={form.movieName} onChange={(e) => setForm({ ...form, movieName: e.target.value })} required placeholder="e.g. Pathaan, IIFA 2024" className={cls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Character Name</label>
                  <input type="text" value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} placeholder="e.g. Kabir" className={cls} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Occasion *</label>
                  <select value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} required className={cls}>
                    <option value="">Select</option>
                    {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Category *</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className={cls}>
                    <option value="">Select</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Year</label>
                  <input type="text" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2024" className={cls} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Colour Palette</label>
                  <input type="text" value={form.colorPalette} onChange={(e) => setForm({ ...form, colorPalette: e.target.value })} placeholder="e.g. Gold, crimson, ivory" className={cls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Price (₹)</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 24999" required min="1" className={cls} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Image URL</label>
                <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className={cls} />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Outfit description..." className={cls} />
              </div>

              {/* Manufacturer linking */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Link Manufacturers</label>
                <div className="flex flex-wrap gap-2">
                  {manufacturers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMfr(m.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        form.manufacturerIds.includes(m.id)
                          ? "border-accent bg-accent text-white"
                          : "border-black/10 bg-white text-primary hover:bg-secondary"
                      }`}
                    >
                      {m.verified && "✓ "}{m.name}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                  {loading ? "Saving..." : editId ? "Save Changes" : "Add Outfit"}
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
            <h2 className="font-serif text-2xl text-primary">Delete Outfit?</h2>
            <p className="mt-2 text-sm text-text/70">This will permanently remove this outfit entry.</p>
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
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60">Outfit</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60 md:table-cell">Celebrity</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60 lg:table-cell">Occasion</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.24em] text-text/60 lg:table-cell">Manufacturers</th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-[0.24em] text-text/60">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {filtered.map((o) => (
              <tr key={o.id} className="transition hover:bg-secondary/20">
                <td className="px-5 py-4">
                  <p className="font-medium text-primary">{o.category}</p>
                  <p className="text-xs text-text/50">{o.movieName}{o.year ? ` · ${o.year}` : ""}</p>
                  <p className="text-xs font-medium text-primary">₹{o.price.toLocaleString("en-IN")}</p>
                </td>
                <td className="hidden px-5 py-4 text-text/70 md:table-cell">{celebMap.get(o.celebrityId) || o.celebrityId}</td>
                <td className="hidden px-5 py-4 lg:table-cell">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">{o.occasion}</span>
                </td>
                <td className="hidden px-5 py-4 lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(o.manufacturerIds || []).slice(0, 2).map((mid) => (
                      <span key={mid} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">{mfrMap.get(mid) || mid}</span>
                    ))}
                    {(o.manufacturerIds || []).length > 2 && <span className="text-xs text-text/40">+{(o.manufacturerIds || []).length - 2}</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(o)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary">Edit</button>
                    <button onClick={() => setDeleteConfirm(o.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-text/50">No outfits found</p>
        )}
      </div>
    </div>
  );
}
