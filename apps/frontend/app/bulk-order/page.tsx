"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getMyBulkOrders,
  createBulkOrder,
  getOutfits,
  getStoredToken,
} from "@/lib/api";
import type { BulkOrder, BulkOrderItem, Outfit } from "@/lib/api";

const INPUT_CLS = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const STATUS_BADGE: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED:  "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSING: "bg-purple-50 text-purple-700 border-purple-200",
  SHIPPED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED:  "bg-green-50 text-green-700 border-green-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
};

export default function BulkOrderPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<BulkOrder[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BulkOrderItem[]>([
    { outfitId: "", outfitName: "", quantity: 10, size: "M", pricePerUnit: 0 },
  ]);

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login?redirect=/bulk-order"); return; }
    Promise.all([getMyBulkOrders(), getOutfits()]).then(([orders, outfits]) => {
      setOrders(orders);
      setOutfits(outfits);
      setLoading(false);
    });
  }, [router]);

  const addItem = () => setItems((prev) => [...prev, { outfitId: "", outfitName: "", quantity: 10, size: "M", pricePerUnit: 0 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<BulkOrderItem>) => {
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, ...patch };
      if (patch.outfitId) {
        const outfit = outfits.find((o) => o.id === patch.outfitId);
        if (outfit) { updated.outfitName = outfit.category; updated.pricePerUnit = outfit.price; }
      }
      return updated;
    }));
  };

  const totalUnits = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const subtotal = items.reduce((s, i) => s + i.pricePerUnit * (i.quantity || 0), 0);
  const discountRate = totalUnits >= 100 ? 0.15 : totalUnits >= 50 ? 0.10 : totalUnits >= 10 ? 0.05 : 0;
  const discountedTotal = subtotal * (1 - discountRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!contactEmail.trim()) { setFormError("Contact email is required."); return; }
    if (!deliveryAddress.trim()) { setFormError("Delivery address is required."); return; }
    if (items.every((i) => !i.outfitId)) { setFormError("Add at least one outfit."); return; }
    const validItems = items.filter((i) => i.outfitId);
    setSubmitting(true);
    try {
      const order = await createBulkOrder({ companyName, contactName, contactEmail, contactPhone, deliveryAddress, items: validItems, notes });
      setOrders((prev) => [order, ...prev]);
      setShowForm(false);
    } catch (err) { setFormError(err instanceof Error ? err.message : "Failed to submit."); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <main><Navbar />
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
      </div>
    </main>
  );

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Special Orders</p>
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-serif text-4xl text-primary">Bulk Orders</h1>
          <button onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition">
            + New Bulk Order
          </button>
        </div>
        <p className="mt-2 text-sm text-text/60">Order 10+ outfits for events, corporates, or productions. Automatic volume discounts.</p>

        <div className="mt-6 flex gap-4 text-sm">
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-green-700">10+ units → 5% off</div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-blue-700">50+ units → 10% off</div>
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-2 text-purple-700">100+ units → 15% off</div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Order Details</p>
            {formError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={LABEL_CLS}>Company Name</label><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Events Ltd" className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Contact Name</label><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Contact Email *</label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Phone</label><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={INPUT_CLS} /></div>
            </div>
            <div><label className={LABEL_CLS}>Delivery Address *</label><textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} required className={INPUT_CLS} /></div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={LABEL_CLS}>Outfits</label>
                <button type="button" onClick={addItem} className="text-xs text-accent hover:underline">+ Add outfit</button>
              </div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] items-end rounded-xl border border-black/8 p-3">
                    <div>
                      <label className="text-xs text-text/50 mb-1 block">Outfit</label>
                      <select value={item.outfitId} onChange={(e) => updateItem(i, { outfitId: e.target.value })} className={INPUT_CLS}>
                        <option value="">Select outfit…</option>
                        {outfits.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.category} – {o.celebrityName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-text/50 mb-1 block">Qty</label>
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className="text-xs text-text/50 mb-1 block">Size</label>
                      <select value={item.size} onChange={(e) => updateItem(i, { size: e.target.value })} className={INPUT_CLS}>
                        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 pb-1 text-xl">×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing summary */}
            <div className="rounded-xl bg-black/[0.02] p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-text/60">Total units:</span><span className="font-medium">{totalUnits}</span></div>
              <div className="flex justify-between"><span className="text-text/60">Subtotal:</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              {discountRate > 0 && <div className="flex justify-between text-green-600"><span>Bulk discount ({(discountRate * 100).toFixed(0)}%):</span><span>−₹{(subtotal - discountedTotal).toLocaleString("en-IN")}</span></div>}
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-black/8"><span>Total:</span><span>₹{discountedTotal.toLocaleString("en-IN")}</span></div>
            </div>

            <div><label className={LABEL_CLS}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Special requirements, event date…" className={INPUT_CLS} /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition">
                {submitting ? "Submitting…" : "Submit Bulk Order"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition">Cancel</button>
            </div>
          </form>
        )}

        {orders.length === 0 && !showForm && (
          <div className="mt-12 text-center text-text/40"><p className="text-3xl mb-3">📦</p><p className="text-sm">No bulk orders yet.</p></div>
        )}
        <div className="mt-8 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-text/40">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="font-medium text-primary mt-0.5">{order.companyName || order.contactEmail}</p>
                  <p className="text-sm text-text/60 mt-1">{order.totalUnits} units · ₹{order.discountedTotal.toLocaleString("en-IN")}{order.discountRate > 0 && ` (${(order.discountRate * 100).toFixed(0)}% off)`}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[order.status] ?? "bg-black/5 text-text border-black/10"}`}>{order.status}</span>
              </div>
              <p className="text-xs text-text/40 mt-3">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
