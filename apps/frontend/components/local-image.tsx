"use client";

import { useState } from "react";

interface LocalImageProps {
  src: string;
  alt: string;
  className?: string;
  comingSoonLabel?: string;
}

/** Renders a local image. Falls back to a styled "Coming Soon" card on error. */
export function LocalImage({ src, alt, className = "", comingSoonLabel }: LocalImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-secondary/30 ${className}`}
        aria-label={comingSoonLabel ?? `${alt} — coming soon`}
      >
        <span className="text-2xl opacity-40">📷</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-text/40">
          {comingSoonLabel ?? "Coming Soon"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
