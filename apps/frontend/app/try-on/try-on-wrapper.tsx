"use client";

import dynamic from "next/dynamic";
import { LocalImage } from "@/components/local-image";

const TryOnClient = dynamic(
  () => import("@/components/ar/TryOnClient"),
  {
    ssr: false,
    loading: () => (
      <div className="relative min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <LocalImage
          src="/assets/collections/cinematic-icons/cover.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="relative w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    ),
  },
);

type Props = {
  preloadOutfitId?: string;
};

export function TryOnWrapper({ preloadOutfitId }: Props) {
  return <TryOnClient preloadOutfitId={preloadOutfitId} />;
}
