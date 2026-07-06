"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getSavedLooks, deleteSavedLook, getStoredToken } from "@/lib/api";
import type { SavedLook } from "@/lib/api";

export default function SavedLooksPage() {
  const router = useRouter();
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/saved-looks");
      return;
    }
    getSavedLooks().then((data) => {
      setLooks(data);
      setLoading(false);
    });
  }, [router]);

  const handleDelete = async (id: string) => {
    await deleteSavedLook(id);
    setLooks((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
        </div>
      </main>
    );
  }

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Saved Looks</h1>
        <p className="mt-2 text-sm text-text/60">
          Your AR try-on screenshots and saved outfit combinations.
        </p>

        {looks.length === 0 && (
          <div className="mt-12 text-center text-text/40">
            <p className="text-3xl mb-3">📸</p>
            <p className="text-sm">No saved looks yet.</p>
            <Link
              href="/try-on"
              className="mt-4 inline-block text-sm text-accent hover:underline"
            >
              Try outfits in AR
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {looks.map((look) => (
            <div
              key={look.id}
              className="rounded-[20px] border border-black/6 bg-white overflow-hidden shadow-sm hover:shadow-md transition group"
            >
              {/* Screenshot or outfit image */}
              {(look.screenshotUrl ?? look.imageUrl) && (
                <div className="aspect-[3/4] overflow-hidden bg-black/5">
                  <img
                    src={(look.screenshotUrl ?? look.imageUrl)!}
                    alt={look.outfitName}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className="p-4">
                <Link
                  href={`/outfits/${look.outfitId}`}
                  className="text-sm font-medium text-primary hover:text-accent transition line-clamp-1"
                >
                  {look.outfitName}
                </Link>
                {look.notes && (
                  <p className="mt-1 text-xs text-text/60 line-clamp-2">{look.notes}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-text/40">
                    {new Date(look.savedAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/outfits/${look.outfitId}`}
                      className="text-xs text-accent hover:underline"
                    >
                      Shop
                    </Link>
                    <button
                      onClick={() => handleDelete(look.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
