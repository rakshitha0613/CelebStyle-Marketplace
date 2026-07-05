"use client";

import dynamic from "next/dynamic";

const TryOnClient = dynamic(
  () => import("@/components/ar/TryOnClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    ),
  },
);

export function TryOnWrapper() {
  return <TryOnClient />;
}
