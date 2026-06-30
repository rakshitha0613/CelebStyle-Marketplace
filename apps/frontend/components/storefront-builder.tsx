"use client";

import { useState } from "react";
import { saveStorefront, type Celebrity, type Storefront } from "@/lib/api";

type Props = {
  celebrities: Celebrity[];
  initialStorefronts: Storefront[];
  onSaved?: (storefront: Storefront) => void;
};

export function StorefrontBuilder({ celebrities, initialStorefronts, onSaved }: Props) {
  const [celebrityId, setCelebrityId] = useState(celebrities[0]?.id ?? "");
  const existing = initialStorefronts.find((storefront) => storefront.celebrityId === celebrityId);
  const [displayName, setDisplayName] = useState(existing?.displayName ?? celebrities[0]?.name ?? "");
  const [bannerImage, setBannerImage] = useState(existing?.bannerImage ?? celebrities[0]?.bannerImage ?? "");
  const [message, setMessage] = useState(existing?.message ?? "");
  const [featuredOutfitIds, setFeaturedOutfitIds] = useState((existing?.featuredOutfitIds || []).join(", "));
  const [verified, setVerified] = useState(existing?.verified ?? true);
  const [registrationId, setRegistrationId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCelebrityChange = (nextCelebrityId: string) => {
    setCelebrityId(nextCelebrityId);
    const nextCelebrity = celebrities.find((celebrity) => celebrity.id === nextCelebrityId);
    const nextExisting = initialStorefronts.find((storefront) => storefront.celebrityId === nextCelebrityId);
    setDisplayName(nextExisting?.displayName ?? nextCelebrity?.name ?? "");
    setBannerImage(nextExisting?.bannerImage ?? nextCelebrity?.bannerImage ?? "");
    setMessage(nextExisting?.message ?? "");
    setFeaturedOutfitIds((nextExisting?.featuredOutfitIds || []).join(", "));
    setVerified(nextExisting?.verified ?? true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const storefront = await saveStorefront({
        celebrityId,
        displayName,
        bannerImage,
        featuredOutfitIds: featuredOutfitIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        message: `${message}${registrationId ? ` Registration: ${registrationId}` : ""}`,
        verified
      });
      setStatus("Storefront saved");
      onSaved?.(storefront);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save storefront");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-black/6 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-accent">Storefront Builder</p>
        <h2 className="mt-2 font-serif text-3xl text-primary">Register or update a celebrity storefront</h2>
      </div>
      {status && <div className="rounded-xl border border-black/10 bg-secondary/40 px-4 py-3 text-sm text-primary">{status}</div>}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Celebrity</label>
        <select value={celebrityId} onChange={(e) => handleCelebrityChange(e.target.value)} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary">
          {celebrities.map((celebrity) => (
            <option key={celebrity.id} value={celebrity.id}>{celebrity.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Registration ID</label>
          <input value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} placeholder="PAN / Aadhaar / contract ref" className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Banner Image URL</label>
        <input value={bannerImage} onChange={(e) => setBannerImage(e.target.value)} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Featured Outfit IDs</label>
        <input value={featuredOutfitIds} onChange={(e) => setFeaturedOutfitIds(e.target.value)} placeholder="Comma separated look ids" className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Personal Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" />
      </div>
      <label className="flex items-center gap-3 text-sm text-text/70">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 accent-accent" />
        Verified storefront
      </label>
      <button disabled={loading} className="w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
        {loading ? "Saving..." : "Save storefront"}
      </button>
    </form>
  );
}
