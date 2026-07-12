"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createCustomization, getStoredToken } from "@/lib/api";

const INPUT_CLS = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";

const FABRICS = ["Silk", "Cotton", "Linen", "Chiffon", "Georgette", "Velvet", "Brocade", "Organza", "Satin", "Khadi"];
const COLOURS: { name: string; hex: string }[] = [
  { name: "Ivory White",  hex: "#F5F0E8" },
  { name: "Champagne",    hex: "#D4A017" },
  { name: "Rose Gold",    hex: "#B76E79" },
  { name: "Blush Pink",   hex: "#FFB6C1" },
  { name: "Deep Red",     hex: "#8B0000" },
  { name: "Maroon",       hex: "#800000" },
  { name: "Navy",         hex: "#001F5B" },
  { name: "Royal Blue",   hex: "#4169E1" },
  { name: "Emerald",      hex: "#50C878" },
  { name: "Gold",         hex: "#FFD700" },
  { name: "Black",        hex: "#111111" },
  { name: "White",        hex: "#FFFFFF" },
  { name: "Teal",         hex: "#008080" },
  { name: "Purple",       hex: "#800080" },
  { name: "Coral",        hex: "#FF6B6B" },
  { name: "Mint Green",   hex: "#98FF98" },
];
const MEASUREMENTS = ["Chest", "Waist", "Hips", "Shoulder", "Length", "Sleeve"];
const SLEEVE_STYLES = ["Full Sleeve", "Half Sleeve", "Three-Quarter Sleeve", "Sleeveless", "Cap Sleeve", "Puff Sleeve", "Bell Sleeve", "Cold Shoulder"];
const NECKLINES    = ["Round Neck", "V-Neck", "Square Neck", "Boat Neck", "Off-Shoulder", "Sweetheart", "Collar", "Halter", "Deep V"];
const FIT_OPTIONS  = ["Regular", "Slim Fit", "Relaxed", "Oversized", "Fitted Waist", "Empire Waist"];
const PATTERNS     = ["Plain / Solid", "Striped", "Floral", "Geometric", "Paisley / Buteh", "Checkered", "Embroidered", "Sequined", "Block Print", "Ombre"];

function NewCustomizationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const outfitId = params.get("outfitId") ?? "";
  const outfitName = params.get("outfitName") ?? "";

  const [customFabric, setCustomFabric] = useState("");
  const [customColour, setCustomColour] = useState("");
  const [sleeveStyle, setSleeveStyle]   = useState("");
  const [neckline, setNeckline]         = useState("");
  const [fit, setFit]                   = useState("");
  const [pattern, setPattern]           = useState("");
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
      const extraNotes = [
        sleeveStyle ? `Sleeve: ${sleeveStyle}` : "",
        neckline    ? `Neckline: ${neckline}` : "",
        fit         ? `Fit: ${fit}` : "",
        pattern     ? `Pattern: ${pattern}` : "",
        notes,
      ].filter(Boolean).join(" | ");
      await createCustomization({
        outfitId,
        outfitName,
        customFabric: customFabric || undefined,
        customColour: customColour || undefined,
        embroidery,
        embroideryText: embroidery ? embroideryText || undefined : undefined,
        measurements: numMeasurements,
        additionalNotes: extraNotes || undefined,
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

  const previewTags = [
    customFabric && { label: "Fabric", value: customFabric },
    customColour && { label: "Colour", value: customColour },
    sleeveStyle  && { label: "Sleeve", value: sleeveStyle },
    neckline     && { label: "Neckline", value: neckline },
    fit          && { label: "Fit", value: fit },
    pattern      && { label: "Pattern", value: pattern },
    embroidery   && { label: "Embroidery", value: embroideryText || "Yes" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Live Preview Panel */}
      <div className="lg:order-2">
        <div className="sticky top-24 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-accent mb-3">Live Preview</p>
          <div className="rounded-[16px] bg-secondary/50 p-5 min-h-[200px]">
            {previewTags.length === 0 ? (
              <p className="text-sm text-text/40 text-center mt-8">Select options to preview your customisation</p>
            ) : (
              <div className="space-y-3">
                <p className="font-serif text-lg text-primary">{outfitName || "Custom Outfit"}</p>
                <div className="flex flex-wrap gap-2">
                  {previewTags.map((tag) => (
                    <span key={tag.label} className="rounded-full border border-accent/20 bg-white px-3 py-1 text-xs font-medium text-primary shadow-sm">
                      <span className="text-accent/70 mr-1">{tag.label}:</span>{tag.value}
                    </span>
                  ))}
                </div>
                {Object.keys(measurements).filter(k => measurements[k]).length > 0 && (
                  <div className="border-t border-black/5 pt-3 mt-3">
                    <p className="text-xs text-text/50 mb-2">Measurements (cm)</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(measurements).filter(([, v]) => v).map(([k, v]) => (
                        <span key={k} className="rounded-full bg-white px-2.5 py-1 text-xs text-primary border border-black/8">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {previewTags.length > 0 && (
            <p className="mt-3 text-xs text-text/40">
              This preview shows your choices. Our team will match them as closely as possible.
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="lg:order-1 space-y-6 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
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
          <label className={LABEL_CLS}>
            Custom Colour
            {customColour && <span className="ml-2 font-normal text-accent normal-case tracking-normal">{customColour}</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCustomColour("")}
              className={`h-7 rounded-full border px-3 text-xs font-medium transition ${
                !customColour ? "border-primary bg-primary text-background" : "border-black/10 text-text/50 hover:border-primary"
              }`}
            >
              Original
            </button>
            {COLOURS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCustomColour(c.name)}
                title={c.name}
                className={`h-7 w-7 rounded-full border-2 transition shadow-sm hover:scale-110 ${
                  customColour === c.name ? "border-primary scale-110 shadow-md" : "border-black/10"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>Sleeve Style</label>
          <select value={sleeveStyle} onChange={(e) => setSleeveStyle(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original sleeve</option>
            {SLEEVE_STYLES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Neckline</label>
          <select value={neckline} onChange={(e) => setNeckline(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original neckline</option>
            {NECKLINES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Fit</label>
          <select value={fit} onChange={(e) => setFit(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original fit</option>
            {FIT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Pattern</label>
          <select value={pattern} onChange={(e) => setPattern(e.target.value)} className={INPUT_CLS}>
            <option value="">Keep original pattern</option>
            {PATTERNS.map((p) => <option key={p}>{p}</option>)}
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
    </div>
  );
}

export default function NewCustomizationPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
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
