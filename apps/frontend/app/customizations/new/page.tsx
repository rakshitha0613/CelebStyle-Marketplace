"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createCustomization, getStoredToken } from "@/lib/api";

const INPUT_CLS = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";

const FABRICS = ["Silk", "Cotton", "Linen", "Chiffon", "Georgette", "Velvet", "Brocade", "Organza", "Satin", "Khadi"];
const COLOURS = ["Ivory White", "Champagne", "Rose Gold", "Blush Pink", "Deep Red", "Maroon", "Navy", "Royal Blue", "Emerald", "Gold", "Black", "White"];
const MEASUREMENTS = ["Chest", "Waist", "Hips", "Shoulder", "Length", "Sleeve"];

function NewCustomizationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const outfitId = params.get("outfitId") ?? "";
  const outfitName = params.get("outfitName") ?? "";

  const [customFabric, setCustomFabric] = useState("");
  const [customColour, setCustomColour] = useState("");
  const [embroidery, setEmbroidery] = useState(false);
  const [embroideryText, setEmbroideryText] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) { router.replace(`/login?redirect=/customizations/new?outfitId=${outfitId}`); }
  }, [router, outfitId]);

  const updateMeasurement = (key: string, val: string) =>
    setMeasurements((p) => val ? { ...p, [key]: val } : Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!outfitId) { setError("No outfit selected."); return; }
    setSubmitting(true);
    try {
      const numMeasurements: Record<string, number> = {};
      for (const [k, v] of Object.entries(measurements)) {
        const n = parseFloat(v);
        if (!isNaN(n)) numMeasurements[k] = n;
      }
      await createCustomization({
        outfitId,
        outfitName,
        customFabric: customFabric || undefined,
        customColour: customColour || undefined,
        embroidery,
        embroideryText: embroidery ? embroideryText || undefined : undefined,
        measurements: numMeasurements,
        additionalNotes: notes || undefined,
      });
      setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to submit."); }
    finally { setSubmitting(false); }
  };

  if (success) return (
    <div className="mt-16 flex flex-col items-center text-center gap-4">
      <p className="text-4xl">✅</p>
      <h2 className="font-serif text-3xl text-primary">Customisation Request Submitted</h2>
      <p className="text-sm text-text/60 max-w-sm">Our team will review your request and send a quote within 2-3 business days.</p>
      <div className="flex gap-3 mt-2">
        <Link href="/customizations" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition">View My Requests</Link>
        <Link href="/search" className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition">Browse More</Link>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.28em] text-accent">Customising</p>
          <p className="font-serif text-2xl text-primary mt-1">{outfitName || outfitId}</p>
        </div>
        <Link href={outfitId ? `/outfits/${outfitId}` : "/search"} className="text-xs text-text/40 hover:text-accent">← Back to outfit</Link>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLS}>Custom Fabric</label>
          <select value={customFabric} onChange={(e) => setCustomFabric(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original fabric</option>
            {FABRICS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Custom Colour</label>
          <select value={customColour} onChange={(e) => setCustomColour(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original colour</option>
            {COLOURS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="embroidery" checked={embroidery} onChange={(e) => setEmbroidery(e.target.checked)} className="h-4 w-4 accent-accent" />
          <label htmlFor="embroidery" className="text-sm text-text/80">Add embroidery / monogram</label>
        </div>
        {embroidery && (
          <div>
            <label className={LABEL_CLS}>Embroidery Text</label>
            <input value={embroideryText} onChange={(e) => setEmbroideryText(e.target.value)} placeholder="e.g. your initials, name, or motif description" className={INPUT_CLS} />
          </div>
        )}
      </div>

      <div>
        <label className={LABEL_CLS}>Custom Measurements (cm) — optional</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {MEASUREMENTS.map((m) => (
            <div key={m}>
              <label className="text-xs text-text/50 mb-1 block">{m}</label>
              <input type="number" min={0} step={0.5} value={measurements[m] ?? ""} onChange={(e) => updateMeasurement(m, e.target.value)} placeholder="—" className={INPUT_CLS} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={LABEL_CLS}>Additional Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any other specific requirements, references, or special instructions…" className={INPUT_CLS} />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={submitting || !outfitId}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition">
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
        <Link href={outfitId ? `/outfits/${outfitId}` : "/search"} className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition">Cancel</Link>
      </div>
    </form>
  );
}

export default function NewCustomizationPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Special Orders</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Custom Outfit Request</h1>
        <p className="mt-2 text-sm text-text/60">Specify your fabric, colour, embroidery, and measurements. We&apos;ll send a tailored quote.</p>
        <Suspense fallback={<div className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary mx-auto" />}>
          <NewCustomizationForm />
        </Suspense>
      </section>
    </main>
  );
}
