"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import {
  getMyWeddingOrders,
  createWeddingOrder,
  getOutfits,
  getStoredToken,
} from "@/lib/api";
import type { WeddingOrder, WeddingOrderItem, Outfit } from "@/lib/api";

const INPUT_CLS = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

const FABRICS = ["Silk", "Cotton", "Linen", "Chiffon", "Georgette", "Velvet", "Brocade", "Organza", "Satin", "Khadi"];
const COLOURS = ["Ivory White", "Champagne", "Rose Gold", "Blush Pink", "Deep Red", "Maroon", "Navy", "Royal Blue", "Emerald", "Gold"];

const STATUS_BADGE: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED:  "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSING: "bg-purple-50 text-purple-700 border-purple-200",
  SHIPPED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED:  "bg-green-50 text-green-700 border-green-200",
  CANCELLED:  "bg-red-50 text-red-700 border-red-200",
};

const emptyItem = (): WeddingOrderItem => ({
  outfitId: "", outfitName: "", quantity: 1, size: "M",
  customFabric: null, customColour: null, customNotes: null, pricePerUnit: 0,
});

export default function WeddingOrderPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<WeddingOrder[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venue, setVenue] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [stylistNote, setStylistNote] = useState("");
  const [items, setItems] = useState<WeddingOrderItem[]>([emptyItem()]);

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login?redirect=/wedding-order"); return; }
    Promise.all([getMyWeddingOrders(), getOutfits()]).then(([orders, outfits]) => {
      setOrders(orders);
      setOutfits(outfits);
      setLoading(false);
    });
  }, [router]);

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: Partial<WeddingOrderItem>) =>
    setItems((p) => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, ...patch };
      if (patch.outfitId) {
        const o = outfits.find((o) => o.id === patch.outfitId);
        if (o) { updated.outfitName = o.category; updated.pricePerUnit = o.price; }
      }
      return updated;
    }));

  const subtotal = items.reduce((s, i) => s + i.pricePerUnit * (i.quantity || 1), 0);
  const daysUntilWedding = weddingDate ? (new Date(weddingDate).getTime() - Date.now()) / 86_400_000 : Infinity;
  const rushFee = daysUntilWedding < 30 && daysUntilWedding > 0 ? subtotal * 0.1 : 0;
  const total = subtotal + rushFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!contactEmail.trim()) { setFormError("Contact email is required."); return; }
    if (!weddingDate.trim()) { setFormError("Wedding date is required."); return; }
    if (!deliveryAddress.trim()) { setFormError("Delivery address is required."); return; }
    if (items.every((i) => !i.outfitId)) { setFormError("Add at least one outfit."); return; }
    const validItems = items.filter((i) => i.outfitId);
    setSubmitting(true);
    try {
      const order = await createWeddingOrder({ brideName, groomName, weddingDate, venue, contactEmail, contactPhone, deliveryAddress, items: validItems, stylistNote });
      setOrders((p) => [order, ...p]);
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
          <h1 className="font-serif text-4xl text-primary">Wedding Orders</h1>
          <button onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition">
            + New Wedding Order
          </button>
        </div>
        <p className="mt-2 text-sm text-text/60">Customised bridal and groom outfits inspired by celebrity looks. Select fabrics, colours, and embroidery.</p>

        {rushFee > 0 && showForm && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Rush order: wedding is within 30 days — a 10% rush fee will apply.
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Wedding Details</p>
            {formError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={LABEL_CLS}>Bride's Name</label><input value={brideName} onChange={(e) => setBrideName(e.target.value)} className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Groom's Name</label><input value={groomName} onChange={(e) => setGroomName(e.target.value)} className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Wedding Date *</label><input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} required className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Venue</label><input value={venue} onChange={(e) => setVenue(e.target.value)} className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Contact Email *</label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required className={INPUT_CLS} /></div>
              <div><label className={LABEL_CLS}>Contact Phone</label><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={INPUT_CLS} /></div>
            </div>
            <div><label className={LABEL_CLS}>Delivery Address *</label><textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} required className={INPUT_CLS} /></div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-[0.24em] text-text/60">Outfits & Customisations</p>
                <button type="button" onClick={addItem} className="text-xs text-accent hover:underline">+ Add outfit</button>
              </div>
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl border border-black/8 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-primary">Outfit {i + 1}</p>
                      {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-text/50 mb-1 block">Outfit</label>
                        <select value={item.outfitId} onChange={(e) => updateItem(i, { outfitId: e.target.value })} className={INPUT_CLS}>
                          <option value="">Select outfit…</option>
                          {outfits.slice(0, 50).map((o) => <option key={o.id} value={o.id}>{o.category} – {o.celebrityName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text/50 mb-1 block">Size</label>
                        <select value={item.size} onChange={(e) => updateItem(i, { size: e.target.value })} className={INPUT_CLS}>
                          {SIZES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-text/50 mb-1 block">Custom Fabric</label>
                        <select value={item.customFabric ?? ""} onChange={(e) => updateItem(i, { customFabric: e.target.value || null })} className={INPUT_CLS}>
                          <option value="">Original fabric</option>
                          {FABRICS.map((f) => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text/50 mb-1 block">Custom Colour</label>
                        <select value={item.customColour ?? ""} onChange={(e) => updateItem(i, { customColour: e.target.value || null })} className={INPUT_CLS}>
                          <option value="">Original colour</option>
                          {COLOURS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-text/50 mb-1 block">Custom Notes</label>
                      <input value={item.customNotes ?? ""} onChange={(e) => updateItem(i, { customNotes: e.target.value || null })} placeholder="e.g. longer hemline, pearl buttons…" className={INPUT_CLS} />
                    </div>
                    {item.pricePerUnit > 0 && (
                      <p className="text-xs text-text/50">Base price: ₹{item.pricePerUnit.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="rounded-xl bg-black/[0.02] p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-text/60">Subtotal:</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              {rushFee > 0 && <div className="flex justify-between text-amber-600"><span>Rush fee (10%):</span><span>+₹{rushFee.toLocaleString("en-IN")}</span></div>}
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-black/8"><span>Estimated Total:</span><span>₹{total.toLocaleString("en-IN")}</span></div>
              <p className="text-xs text-text/40">Final price may vary based on customisations</p>
            </div>

            <div><label className={LABEL_CLS}>Stylist Note</label><textarea value={stylistNote} onChange={(e) => setStylistNote(e.target.value)} rows={2} placeholder="Any special requirements, inspiration, or colour theme…" className={INPUT_CLS} /></div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition">
                {submitting ? "Submitting…" : "Submit Wedding Order"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition">Cancel</button>
            </div>
          </form>
        )}

        {orders.length === 0 && !showForm && (
          <div className="mt-12 text-center text-text/40"><p className="text-3xl mb-3">💍</p><p className="text-sm">No wedding orders yet.</p></div>
        )}
        <div className="mt-8 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-text/40">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="font-medium text-primary mt-0.5">
                    {[order.brideName, order.groomName].filter(Boolean).join(" & ") || order.contactEmail}
                  </p>
                  <p className="text-sm text-text/60 mt-1">
                    Wedding: {new Date(order.weddingDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    {order.venue ? ` · ${order.venue}` : ""}
                  </p>
                  <p className="text-sm text-text/60">
                    ₹{order.total.toLocaleString("en-IN")}
                    {order.rushFee > 0 && ` (incl. rush fee ₹${order.rushFee.toLocaleString("en-IN")})`}
                  </p>
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
