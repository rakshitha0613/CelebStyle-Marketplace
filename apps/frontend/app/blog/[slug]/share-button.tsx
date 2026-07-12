"use client";

import { useState } from "react";

export function BlogShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/blog/${slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10"
    >
      {copied ? "✓ Copied!" : "↗ Share"}
    </button>
  );
}
