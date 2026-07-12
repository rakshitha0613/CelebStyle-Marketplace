"use client";

import { LocalImage } from "@/components/local-image";

interface Props {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

/** Thin wrapper kept for backwards compatibility. Delegates to LocalImage. */
export function FallbackImage({ src, alt, className, fallbackSrc }: Props) {
  return (
    <LocalImage
      src={fallbackSrc ? src : src}
      alt={alt}
      className={className}
    />
  );
}
