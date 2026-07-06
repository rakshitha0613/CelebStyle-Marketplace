"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getStorefront, saveStorefront, getOutfits, getStoredToken } from "@/lib/api";
import { ImageUpload } from "@/components/image-upload";
import type { Storefront, Outfit } from "@/lib/api";

const INPUT_CLS = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";

export default function StorefrontEditPage() {
  const { celebrityId } = useParams<{ celebrityId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  const [displayName, setDisplayName] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [message, setMessage] = useState("");
  const [featuredOutfitIds, setFeaturedOutfitIds] = useState<string[]>([]);

  useEffect(() => {
    if (!getStoredToken()) { router.replace(`/login?redirect=/storefronts/${celebrityId}/edit`); return; }
    Promise.all([getStorefront(celebrityId), getOutfits({ celebrityId })]).then(([sf, ofs]) => {
      if (sf) {
        setDisplayName(sf.displayName);
        setBannerImage(sf.bannerImage || "");
        setMessage(sf.message || "");
        setFeaturedOutfitIds(sf.featuredOutfitIds || []);
      }
      setOutfits(ofs);
      setLoading(false);
    });
  }, [celebrityId, router]);

  const toggleFeaturedOutfit = (outfitId: string) => {
    setFeaturedOutfitIds((prev) =>
      prev.includes(outfitId) ? prev.filter((id) => id !== outfitId) : [...prev, outfitId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!displayName.trim()) { setError("Display name is required."); return; }
    setSaving(true);
    try {
      await saveStorefront({
        celebrityId,
        displayName: displayName.trim(),
        bannerImage,
        message,
        featuredOutfitIds,
        verified: false,
      } as Storefront);
      setSuccess(true);
      setTimeout(() => router.push(`/storefronts/${celebrityId}`), 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save."); }
    finally { setSaving(false); }
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
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2 text-xs text-text/40 mb-6">
          <Link href="/storefronts" className="hover:text-accent">Storefronts</Link>
          <span>/</span>
          <Link href={`/storefronts/${celebrityId}`} className="hover:text-accent">{celebrityId}</Link>
          <span>/</span>
          <span className="text-text/70">Edit</span>
        </div>

        <p className="text-xs uppercase tracking-[0.36em] text-accent">Storefront</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Edit Your Storefront</h1>
        <p className="mt-2 text-sm text-text/60">Customise your banner, bio message, and featured outfits.</p>

        {success && (
          <div className="mt-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Saved! Redirecting…</div>
        )}

        <form onSubmit={handleSave} className="mt-8 space-y-6 rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
          {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className={LABEL_CLS}>Display Name *</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className={INPUT_CLS} placeholder="Your storefront name" />
          </div>

          <ImageUpload value={bannerImage} onChange={setBannerImage} label="Banner Image" />

          {bannerImage && (
            <div className="rounded-xl overflow-hidden">
              <img src={bannerImage} alt="Banner preview" className="w-full aspect-[21/6] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          <div>
            <label className={LABEL_CLS}>Bio / Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Describe your style, collections, or brand story…" className={INPUT_CLS} />
          </div>

          {outfits.length > 0 && (
            <div>
              <label className={LABEL_CLS}>Featured Outfits ({featuredOutfitIds.length} selected)</label>
              <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto rounded-xl border border-black/8 p-3">
                {outfits.map((outfit) => (
                  <label key={outfit.id} className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition ${featuredOutfitIds.includes(outfit.id) ? "bg-accent/5 border border-accent/30" : "hover:bg-black/5"}`}>
                    <input type="checkbox" checked={featuredOutfitIds.includes(outfit.id)} onChange={() => toggleFeaturedOutfit(outfit.id)} className="accent-accent" />
                    <img src={outfit.imageUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <span className="text-xs text-primary truncate">{outfit.category}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving || success}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <Link href={`/storefronts/${celebrityId}`}
              className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-black/5 transition">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
