"use client";

import Link from "next/link";
import { getStoredToken } from "@/lib/api";

export function StorefrontActions({ celebrityId }: { celebrityId: string }) {
  const token = getStoredToken();
  if (!token) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={`/storefronts/${celebrityId}/edit`}
        className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-text/60 hover:bg-black/5 transition">
        ✏ Edit Storefront
      </Link>
      <Link href={`/storefronts/${celebrityId}/analytics`}
        className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-text/60 hover:bg-black/5 transition">
        📊 Analytics
      </Link>
    </div>
  );
}
