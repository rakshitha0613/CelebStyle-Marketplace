"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminAuditLogs } from "../admin-api";
import type { AuditLog } from "../admin-api";

const RESOURCE_COLORS: Record<string, string> = {
  User:         "bg-blue-50 text-blue-700",
  Order:        "bg-amber-50 text-amber-700",
  Product:      "bg-violet-50 text-violet-700",
  Storefront:   "bg-emerald-50 text-emerald-700",
  Review:       "bg-pink-50 text-pink-700",
  Return:       "bg-orange-50 text-orange-700",
  Settlement:   "bg-indigo-50 text-indigo-700",
  SystemSetting:"bg-gray-100 text-gray-700",
};

export function AuditTab() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [action, setAction]   = useState("");
  const [resourceType, setResourceType] = useState("");

  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    getAdminAuditLogs({ page, limit: LIMIT, action: action || undefined, resourceType: resourceType || undefined })
      .then((res) => { setLogs(res.logs); setTotal(res.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, action, resourceType]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  const exportCSV = () => {
    const header = "Timestamp,Actor,Role,Action,Resource Type,Resource ID,IP";
    const rows = logs.map((l) =>
      `"${new Date(l.createdAt).toISOString()}","${l.actorEmail ?? ""}","${l.actorRole ?? ""}","${l.action}","${l.resourceType}","${l.resourceId}","${l.ipAddress ?? ""}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="min-w-[160px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <input
          placeholder="Resource type (User, Order…)"
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="min-w-[180px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button onClick={exportCSV}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text/70 hover:bg-secondary transition">
          ↓ Export CSV
        </button>
        <button onClick={load}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-text/70 hover:bg-secondary transition">
          ↻ Refresh
        </button>
      </div>

      <p className="text-xs text-text/40">{total.toLocaleString()} total entries</p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}

      <div className="rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-xs text-text/60 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-text/80">{log.actorEmail ?? "—"}</p>
                      {log.actorRole && <p className="text-xs text-text/40">{log.actorRole}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text/70">{log.action}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESOURCE_COLORS[log.resourceType] ?? "bg-gray-50 text-gray-600"}`}>
                        {log.resourceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text/50 max-w-[120px] truncate">{log.resourceId}</td>
                    <td className="px-4 py-3 text-xs text-text/50">{log.ipAddress ?? "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-text/40">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}
            className="rounded-xl border border-black/10 px-4 py-2 text-sm text-text/70 hover:bg-secondary transition disabled:opacity-40">
            ← Prev
          </button>
          <span className="text-sm text-text/60">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
            className="rounded-xl border border-black/10 px-4 py-2 text-sm text-text/70 hover:bg-secondary transition disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
