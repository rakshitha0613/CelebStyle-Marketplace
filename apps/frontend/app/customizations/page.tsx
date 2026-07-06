"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getMyCustomizations, getStoredToken } from "@/lib/api";
import type { CustomizationRequest } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:       "bg-amber-50 text-amber-700 border-amber-200",
  QUOTED:        "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRMED:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_PRODUCTION: "bg-purple-50 text-purple-700 border-purple-200",
  READY:         "bg-green-50 text-green-700 border-green-200",
};

export default function CustomizationsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CustomizationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login?redirect=/customizations"); return; }
    getMyCustomizations().then((r) => { setRequests(r); setLoading(false); });
  }, [router]);

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
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Special Orders</p>
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-serif text-4xl text-primary">My Customisations</h1>
          <Link href="/customizations/new"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition">
            + New Request
          </Link>
        </div>
        <p className="mt-2 text-sm text-text/60">Track your custom fabric, colour, and embroidery requests.</p>

        {requests.length === 0 ? (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">✂</p>
            <p className="text-sm">No customisation requests yet.</p>
            <Link href="/search" className="mt-3 block text-xs text-accent hover:underline">Browse outfits to customise →</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text/40 mb-1">#{req.id.slice(0, 8).toUpperCase()}</p>
                    <Link href={`/outfits/${req.outfitId}`} className="font-medium text-primary hover:text-accent transition">{req.outfitName || req.outfitId}</Link>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-text/60">
                      {req.customFabric && <span className="rounded-full bg-secondary px-2.5 py-1">{req.customFabric}</span>}
                      {req.customColour && <span className="rounded-full bg-secondary px-2.5 py-1">{req.customColour}</span>}
                      {req.embroidery && <span className="rounded-full bg-secondary px-2.5 py-1">Embroidery{req.embroideryText ? `: ${req.embroideryText}` : ""}</span>}
                    </div>
                    {req.quoteAmount != null && (
                      <p className="text-sm font-medium text-accent mt-2">Quote: ₹{req.quoteAmount.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[req.status] ?? "bg-black/5 text-text border-black/10"}`}>{req.status.replace("_", " ")}</span>
                </div>
                <p className="text-xs text-text/30 mt-3 border-t border-black/5 pt-3">
                  {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
