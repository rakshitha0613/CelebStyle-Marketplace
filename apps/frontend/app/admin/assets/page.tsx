"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStoredToken,
  getCurrentUser,
  getAdminAssets,
  regenerateAdminAssets,
  uploadAdminAsset,
  verifyAllAdminAssets,
} from "@/lib/api";
import type { AdminAsset, AdminAssetFilter, AdminAssetSummary, VerifyAllReport } from "@/lib/api";
import { LocalImage } from "@/components/local-image";

const FILTERS: { id: AdminAssetFilter | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "missing", label: "Missing Images" },
  { id: "failed", label: "Failed Images" },
  { id: "needsPaidUpgrade", label: "Needs Paid Upgrade" },
  { id: "pollinations", label: "Pollinations Assets" },
  { id: "premium", label: "Premium Assets" },
  { id: "brokenPaths", label: "Broken Paths" },
  { id: "duplicates", label: "Duplicate Files" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminAssetsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [filter, setFilter] = useState<AdminAssetFilter | "all">("all");
  const [items, setItems] = useState<AdminAsset[]>([]);
  const [summary, setSummary] = useState<AdminAssetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailAsset, setDetailAsset] = useState<AdminAsset | null>(null);
  const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());
  const [verifyReport, setVerifyReport] = useState<VerifyAllReport | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const user = getCurrentUser();
    const admin = !!token && (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN");
    setIsAdmin(admin);
    setAuthChecked(true);
    if (!token) router.push("/admin/login");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAdminAssets(filter === "all" ? undefined : filter);
    setItems(result.items);
    setSummary(result.summary);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authChecked && isAdmin) load();
  }, [authChecked, isAdmin, load]);

  const toggleSelected = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const regenerate = async (paths: string[]) => {
    if (paths.length === 0) return;
    setBusyPaths((prev) => new Set([...prev, ...paths]));
    try {
      await regenerateAdminAssets(paths);
      await load();
    } finally {
      setBusyPaths((prev) => {
        const next = new Set(prev);
        for (const p of paths) next.delete(p);
        return next;
      });
    }
  };

  const handleUpload = async (path: string, file: File) => {
    setBusyPaths((prev) => new Set(prev).add(path));
    try {
      const base64 = await fileToBase64(file);
      await uploadAdminAsset(path, base64);
      await load();
    } finally {
      setBusyPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  };

  const handleVerifyAll = async () => {
    setVerifying(true);
    try {
      const report = await verifyAllAdminAssets();
      setVerifyReport(report);
      await load();
    } finally {
      setVerifying(false);
    }
  };

  if (!authChecked) return null;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-4xl">🚫</p>
        <h1 className="mt-4 font-serif text-2xl text-primary">Access Denied</h1>
        <p className="mt-2 text-sm text-text/70">Sign in with an admin account to manage assets.</p>
        <Link href="/admin/login" className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm text-background">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-accent underline-offset-4 hover:underline">← Back to Admin</Link>
          <h1 className="mt-2 font-serif text-4xl text-primary">Asset Manager</h1>
          <p className="mt-1 text-sm text-text/60">
            Local AI asset pipeline — {summary?.total ?? 0} required image slots.
          </p>
        </div>
        <button
          onClick={handleVerifyAll}
          disabled={verifying}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify All Assets"}
        </button>
      </div>

      {verifyReport && (
        <div className="mt-6 grid gap-3 rounded-[20px] border border-black/6 bg-white p-5 shadow-sm sm:grid-cols-5">
          <Stat label="Generated" value={verifyReport.generated} />
          <Stat label="Failed" value={verifyReport.failed} />
          <Stat label="Pending" value={verifyReport.pending} />
          <Stat label="Needs Paid Upgrade" value={verifyReport.needsPaidUpgrade} />
          <Stat label="Broken References" value={verifyReport.brokenReferences} />
        </div>
      )}

      {summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Total" value={summary.total} />
          <Stat label="Missing" value={summary.missing} />
          <Stat label="Failed" value={summary.failed} />
          <Stat label="Needs Upgrade" value={summary.needsPaidUpgrade} />
          <Stat label="Pollinations" value={summary.pollinations} />
          <Stat label="Premium" value={summary.premium} />
          <Stat label="Broken" value={summary.brokenPaths} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              filter === f.id ? "border-primary bg-primary text-background" : "border-black/10 text-text/70 hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-accent/30 bg-accent/5 px-4 py-2.5">
          <p className="text-xs text-text/70">{selected.size} selected</p>
          <button
            onClick={() => regenerate([...selected])}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
          >
            Regenerate Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-text/50 underline-offset-4 hover:underline">
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-16 text-center text-sm text-text/50">No assets match this filter.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <AssetCard
              key={item.path}
              item={item}
              selected={selected.has(item.path)}
              busy={busyPaths.has(item.path)}
              onToggleSelect={() => toggleSelected(item.path)}
              onViewDetail={() => setDetailAsset(item)}
              onRegenerate={() => regenerate([item.path])}
              onUpload={(file) => handleUpload(item.path, file)}
            />
          ))}
        </div>
      )}

      {detailAsset && <PromptViewerModal asset={detailAsset} onClose={() => setDetailAsset(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-black/6 bg-white p-4 text-center shadow-sm">
      <p className="font-serif text-2xl text-primary">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-text/50">{label}</p>
    </div>
  );
}

function statusColor(status: AdminAsset["status"]) {
  if (status === "generated") return "text-green-600";
  if (status === "failed") return "text-red-600";
  if (status === "broken") return "text-orange-600";
  return "text-text/40";
}

function AssetCard({
  item,
  selected,
  busy,
  onToggleSelect,
  onViewDetail,
  onRegenerate,
  onUpload,
}: {
  item: AdminAsset;
  selected: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onViewDetail: () => void;
  onRegenerate: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <div className={`overflow-hidden rounded-[20px] border bg-white shadow-sm ${selected ? "border-accent" : "border-black/6"}`}>
      <div className="relative aspect-[4/5] bg-secondary/20">
        <LocalImage src={`/${item.path}`} alt={item.path} className="h-full w-full object-cover" />
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="absolute left-2 top-2 h-4 w-4"
        />
        {item.needsPaidUpgrade && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-semibold text-white">
            Upgrade
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-[11px] font-mono text-text/60" title={item.path}>{item.path}</p>
        <div className="flex items-center justify-between text-[10px]">
          <span className={`font-semibold uppercase tracking-wide ${statusColor(item.status)}`}>{item.status}</span>
          <span className="text-text/40">{item.backend ?? "—"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            onClick={onViewDetail}
            className="rounded-full border border-black/10 px-2.5 py-1 text-[10px] font-medium text-primary transition hover:bg-secondary"
          >
            Prompt
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy}
            className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : "Regenerate"}
          </button>
          <label className="cursor-pointer rounded-full border border-black/10 px-2.5 py-1 text-[10px] font-medium text-primary transition hover:bg-secondary">
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function PromptViewerModal({ asset, onClose }: { asset: AdminAsset; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-luxe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl text-primary">Asset detail</h2>
          <button onClick={onClose} className="text-text/40 hover:text-primary">✕</button>
        </div>
        <div className="mt-4 aspect-[4/5] overflow-hidden rounded-[16px] bg-secondary/20">
          <LocalImage src={`/${asset.path}`} alt={asset.path} className="h-full w-full object-cover" />
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <Row label="Path" value={asset.path} mono />
          <Row label="Status" value={asset.status} />
          <Row label="Backend" value={asset.backend ?? "—"} />
          <Row label="Model" value={asset.model ?? "—"} />
          <Row label="Seed" value={asset.seed?.toString() ?? "—"} />
          <Row label="Dimensions" value={asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"} />
          <Row label="Generated" value={asset.generatedAt ?? "—"} />
          <Row label="Last verified" value={asset.lastVerified ?? "—"} />
          <Row label="Quality flag" value={asset.qualityFlag ?? "none"} />
          <Row label="Needs paid upgrade" value={asset.needsPaidUpgrade ? "yes" : "no"} />
          {asset.error && <Row label="Error" value={asset.error} />}
        </dl>
        {asset.prompt && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-text/40">Prompt</p>
            <p className="mt-1 rounded-[12px] bg-secondary/40 p-3 text-xs leading-5 text-text/80">{asset.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-1.5">
      <dt className="text-text/40">{label}</dt>
      <dd className={`text-right text-text/80 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
