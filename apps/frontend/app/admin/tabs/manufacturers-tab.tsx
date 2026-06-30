"use client";

import { useState } from "react";
import type { Manufacturer } from "@/lib/api";
import { createManufacturer, updateManufacturer, deleteManufacturer } from "@/lib/api";

type Props = {
  manufacturers: Manufacturer[];
  setManufacturers: (m: Manufacturer[]) => void;
};

const SPECIALTIES = [
  "Saree", "Lehenga", "Gown", "Kurta", "Kurta Set", "Sherwani", "Bandhgala", "Suit",
  "Blazer", "Tuxedo", "Shirt + Veshti", "Nehru Jacket Set", "Evening Dress", "Bridal", "Western"
];

const EMPTY_FORM = {
  name: "", location: "", rating: "4.5", contactEmail: "", verified: false, specialties: [] as string[]
};

export function ManufacturersTab({ manufacturers, setManufacturers }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (m: Manufacturer) => {
    setEditId(m.id);
    setForm({
      name: m.name,
      location: m.location,
      rating: String(m.rating),
      contactEmail: m.contactEmail,
      verified: m.verified,
      specialties: m.specialties
    });
    setError("");
    setShowForm(true);
  };

  const toggleSpecialty = (s: string) => {
    setForm((f) => ({
      ...f,
      specialties: f.specialties.includes(s)
        ? f.specialties.filter((x) => x !== s)
        : [...f.specialties, s]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        rating: Number(form.rating),
        contactEmail: form.contactEmail.trim(),
        verified: form.verified,
        specialties: form.specialties
      };
      if (editId) {
        const updated = await updateManufacturer(editId, payload);
        setManufacturers(manufacturers.map((m) => (m.id === editId ? updated : m)));
      } else {
        const created = await createManufacturer(payload);
        setManufacturers([...manufacturers, created]);
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
      await deleteManufacturer(id);
      setManufacturers(manufacturers.filter((m) => m.id !== id));
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-text/60">{manufacturers.length} manufacturers in network</p>
        <button
          onClick={openAdd}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          + Add Manufacturer
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-lg rounded-[28px] bg-background p-8 shadow-luxe">
            <h2 className="font-serif text-3xl text-primary">{editId ? "Edit Manufacturer" : "Add Manufacturer"}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Ritu Kumar Atelier" className={cls} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Location *</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required placeholder="e.g. Delhi, India" className={cls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Rating (0–5)</label>
                  <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={cls} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Contact Email *</label>
                <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required placeholder="orders@example.com" className={cls} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        form.specialties.includes(s)
                          ? "border-accent bg-accent text-white"
                          : "border-black/10 bg-white text-primary hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="verified"
                  checked={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                  className="h-4 w-4 rounded border-black/20 accent-accent"
                />
                <label htmlFor="verified" className="text-sm text-primary">Verified manufacturer</label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                  {loading ? "Saving..." : editId ? "Save Changes" : "Add Manufacturer"}
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
            <h2 className="font-serif text-2xl text-primary">Remove Manufacturer?</h2>
            <p className="mt-2 text-sm text-text/70">This will remove them from the network.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} disabled={loading} className="flex-1 rounded-full bg-red-600 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50">
                {loading ? "Removing..." : "Remove"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-primary transition hover:bg-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {manufacturers.map((m) => (
          <div key={m.id} className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-primary">{m.name}</p>
                  {m.verified && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Verified</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text/60">{m.location}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-primary">
                ★ {m.rating.toFixed(1)}
              </div>
            </div>
            <p className="mt-2 text-xs text-text/50">{m.contactEmail}</p>
            {m.specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {m.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">{s}</span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => openEdit(m)} className="flex-1 rounded-lg border border-black/10 py-1.5 text-xs font-medium text-primary transition hover:bg-secondary">Edit</button>
              <button onClick={() => setDeleteConfirm(m.id)} className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50">Remove</button>
            </div>
          </div>
        ))}
      </div>
      {manufacturers.length === 0 && (
        <p className="mt-8 text-center text-sm text-text/50">No manufacturers in network yet</p>
      )}
    </div>
  );
}
