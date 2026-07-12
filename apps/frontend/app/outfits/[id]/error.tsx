"use client";
import Link from "next/link";

export default function OutfitError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl">👗</p>
      <h2 className="font-serif text-2xl text-primary">Outfit could not be loaded</h2>
      <p className="text-sm text-text/60">This might be a temporary issue. Try refreshing.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90">Try again</button>
        <Link href="/search" className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5">Browse looks</Link>
      </div>
    </div>
  );
}
