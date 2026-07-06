"use client";

import { useState } from "react";
import type { Coupon } from "@/lib/api";
import { createCoupon, updateCoupon, deactivateCoupon } from "@/lib/api";

type Props = {
  coupons: Coupon[];
  setCoupons: (c: Coupon[]) => void;
};

const COUPON_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING", "FIRST_ORDER"] as const;

const EMPTY_FORM = {
  code: "",
  type: "PERCENTAGE" as Coupon["type"],
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  usageLimitPerUser: "1",
  startsAt: new Date().toISOString().slice(0, 10),
  expiresAt: "",
  isActive: true,
};

export function CouponsTab({ coupons, setCoupons }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filtered = coupons.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrderAmount: String(c.minOrderAmount),
      maxDiscountAmount: c.maxDiscountAmount !== null ? String(c.maxDiscountAmount) : "",
      usageLimit: c.usageLimit !== null ? String(c.usageLimit) : "",
      usageLimitPerUser: String(c.usageLimitPerUser),
      startsAt: c.startsAt.slice(0, 10),
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      isActive: c.isActive,
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
        code:               form.code.trim().toUpperCase(),
        type:               form.type,
        value:              Number(form.value),
        minOrderAmount:     form.minOrderAmount   ? Number(form.minOrderAmount)   : 0,
        maxDiscountAmount:  form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        usageLimit:         form.usageLimit        ? Number(form.usageLimit)        : null,
        usageLimitPerUser:  Number(form.usageLimitPerUser) || 1,
        startsAt:           form.startsAt ? new Date(form.startsAt).toISOString() : new Date().toISOString(),
        expiresAt:          form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive:           form.isActive,
      };
      if (editId) {
        const updated = await updateCoupon(editId, payload);
        setCoupons(coupons.map((c) => (c.id === editId ? updated : c)));
      } else {
        const created = await createCoupon(payload);
        setCoupons([created, ...coupons]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateCoupon(id);
      setCoupons(coupons.map((c) => (c.id === id ? { ...c, isActive: false } : c)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const typeLabel = (type: Coupon["type"]) =>
    ({ PERCENTAGE: "%", FIXED_AMOUNT: "₹", FREE_SHIPPING: "Ship", FIRST_ORDER: "1st", BUY_X_GET_Y: "BxGy" })[type] ?? type;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search coupons…"
          className="w-64 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
        />
        <button
          onClick={openAdd}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          + New Coupon
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-[20px] border border-black/6 bg-white p-6 shadow-sm space-y-4"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-accent">
            {editId ? "Edit Coupon" : "New Coupon"}
          </p>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                placeholder="SAVE20"
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Coupon["type"] })}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              >
                {COUPON_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">
                Value * {form.type === "PERCENTAGE" ? "(percent)" : form.type === "FIXED_AMOUNT" ? "(paise)" : ""}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
                min={0}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Min Order (paise)</label>
              <input
                type="number"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                min={0}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Max Discount (paise)</label>
              <input
                type="number"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                min={0}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Usage Limit</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                min={0}
                placeholder="Unlimited"
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Per-user Limit</label>
              <input
                type="number"
                value={form.usageLimitPerUser}
                onChange={(e) => setForm({ ...form, usageLimitPerUser: e.target.value })}
                min={1}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Starts At *</label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text/60">Expires At</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="coupon-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="coupon-active" className="text-sm text-text/70">Active</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving…" : editId ? "Save Changes" : "Create Coupon"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-black/10 px-6 py-2 text-sm font-medium text-text/70 hover:border-black/20"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-[20px] border border-black/6 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 bg-secondary/40">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Used</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Expires</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.2em] text-text/50">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text/40">
                  {search ? "No coupons match your search" : "No coupons yet"}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-black/4 last:border-0 hover:bg-secondary/20 transition">
                <td className="px-4 py-3 font-mono font-medium text-primary">{c.code}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    {typeLabel(c.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-text/70">{c.value}</td>
                <td className="px-4 py-3 text-text/70">{c.usedCount}{c.usageLimit !== null ? `/${c.usageLimit}` : ""}</td>
                <td className="px-4 py-3 text-text/50 text-xs">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-secondary text-text/50"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-lg border border-black/10 px-3 py-1 text-xs hover:border-black/20"
                    >
                      Edit
                    </button>
                    {c.isActive && (
                      <button
                        onClick={() => handleDeactivate(c.id)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
