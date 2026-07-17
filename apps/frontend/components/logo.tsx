import { useId } from "react";

/**
 * CelebStyle brand mark — an original SVG monogram (rose-gold "C" arc + AI
 * sparkle) on a black badge. Pure code asset, no external image file.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  const uid = useId();
  const gradId = `cs-logo-grad-${uid}`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CelebStyle"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="55%" stopColor="#C08A8F" />
          <stop offset="100%" stopColor="#A61E4D" />
        </linearGradient>
      </defs>

      {/* badge */}
      <circle cx="24" cy="24" r="22" fill="#0F0F0F" />

      {/* "C" monogram — circle stroke with a gap opening to the right */}
      <circle
        cx="24"
        cy="24"
        r="13"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="61.26 20.42"
        strokeDashoffset="-10.21"
      />

      {/* AI sparkle accent, sitting in the mouth of the "C" */}
      <path
        d="M35.2 17.6 L36.4 21 L39.8 22.2 L36.4 23.4 L35.2 26.8 L34 23.4 L30.6 22.2 L34 21 Z"
        fill="#D4AF37"
      />
    </svg>
  );
}

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
      <span className="font-serif text-2xl tracking-[0.22em] text-primary uppercase">
        CelebStyle
      </span>
    </span>
  );
}
