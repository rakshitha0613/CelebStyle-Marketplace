"use client";
import Link from "next/link";

export default function BlogError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl">✍️</p>
      <h2 className="font-serif text-2xl text-primary">Article could not be loaded</h2>
      <p className="text-sm text-text/60">This post might have been moved or is temporarily unavailable.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90">Try again</button>
        <Link href="/blog" className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5">Back to blog</Link>
      </div>
    </div>
  );
}
