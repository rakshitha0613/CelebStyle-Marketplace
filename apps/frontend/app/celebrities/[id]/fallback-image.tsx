"use client";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export function FallbackImage({ src, alt, className }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
