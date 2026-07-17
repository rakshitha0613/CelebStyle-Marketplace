/**
 * TRYON_PILOT_OUTFITS — mirrors scripts/tryon-pilot/pilot-outfits.mjs.
 * Fixed, immutable list of the first 10 outfits (pinned by slug) used when
 * TRYON_PILOT_MODE=true. Kept as a plain duplicated array (not imported from
 * scripts/, which isn't part of the Next.js build) — update both files
 * together if the pilot scope ever changes.
 */
export const TRYON_PILOT_OUTFIT_IDS: readonly string[] = [
  "look-shah-rukh-khan-red-carpet",
  "look-shah-rukh-khan-jawan",
  "look-ranveer-singh-gully-boy",
  "look-hrithik-roshan-war",
  "look-akshay-kumar-kesari",
  "look-salman-khan-bajrangi",
  "look-ranbir-kapoor-animal",
  "look-vicky-kaushal-uri",
  "look-amitabh-bachchan-pink",
  "look-deepika-padukone-wedding",
];

export function isTryOnPilotModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TRYON_PILOT_MODE === "true";
}
