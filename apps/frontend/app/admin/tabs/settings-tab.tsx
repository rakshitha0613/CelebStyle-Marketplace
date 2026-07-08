"use client";

import { useEffect, useState } from "react";
import { getAdminSettings, upsertAdminSetting, deleteAdminSetting, broadcastNotification } from "../admin-api";
import type { SystemSetting } from "../admin-api";

const INPUT = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition border";

type EditForm = { key: string; value: string; description: string };
const EMPTY: EditForm = { key: "", value: "", description: "" };

type BroadcastForm = { title: string; body: string; type: string; roles: string; actionUrl: string };
const EMPTY_BROADCAST: BroadcastForm = { title: "", body: "", type: "SYSTEM", roles: "", actionUrl: "" };

export function SettingsTab() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const [editForm, setEditForm] = useState<EditForm>(EMPTY);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  const [broadcastForm, setBroadcastForm] = useState<BroadcastForm>(EMPTY_BROADCAST);
  const [broadcasting, setBroadcasting]   = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string>("");

  const load = () => {
    setLoading(true);
    getAdminSettings()
      .then(setSettings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (setting?: SystemSetting) => {
    setEditForm(setting
      ? { key: setting.key, value: setting.value, description: setting.description ?? "" }
      : EMPTY
    );
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.key || editForm.value === "") return;
    setSaving(true);
    try {
      const updated = await upsertAdminSetting(editForm.key, editForm.value, editForm.description || undefined);
      setSettings((prev) => {
        const idx = prev.findIndex((s) => s.key === editForm.key);
        return idx >= 0 ? prev.map((s, i) => i === idx ? updated : s) : [...prev, updated];
      });
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    setSaving(false);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete setting "${key}"? This requires SUPER_ADMIN privileges.`)) return;
    try {
      await deleteAdminSetting(key);
      setSettings((prev) => prev.filter((s) => s.key !== key));
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.body) return;
    setBroadcasting(true);
    setBroadcastResult("");
    try {
      const roles = broadcastForm.roles.split(",").map((r) => r.trim()).filter(Boolean);
      const result = await broadcastNotification({
        title:     broadcastForm.title,
        body:      broadcastForm.body,
        type:      broadcastForm.type,
        ...(roles.length && { roles }),
        ...(broadcastForm.actionUrl && { actionUrl: broadcastForm.actionUrl }),
      });
      setBroadcastResult(`Notification sent to ${result.sentCount} user${result.sentCount !== 1 ? "s" : ""}.`);
      setBroadcastForm(EMPTY_BROADCAST);
    } catch (e) { setError(e instanceof Error ? e.message : "Broadcast failed"); }
    setBroadcasting(false);
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError("")} className="text-red-400">✕</button>
        </div>
      )}

      {/* System Settings */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl text-primary">System Settings</h3>
          <button onClick={() => openEdit()} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition">
            + New Setting
          </button>
        </div>

        <div className="mt-4 rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {settings.map((s) => (
                  <tr key={s.key} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-primary">{s.key}</td>
                    <td className="px-4 py-3 text-text/70 max-w-[200px] truncate" title={s.value}>{s.value}</td>
                    <td className="px-4 py-3 text-xs text-text/50 max-w-[200px] truncate">{s.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {s.isPublic ? "Public" : "Private"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEdit(s)} className={`${BTN_SM} border-black/10 text-text/70 hover:bg-secondary`}>Edit</button>
                        <button onClick={() => handleDelete(s.key)} className={`${BTN_SM} border-red-200 text-red-600 hover:bg-red-50`}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {settings.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-text/40">No settings configured.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Notification Broadcast */}
      <section>
        <h3 className="font-serif text-xl text-primary">Broadcast Notification</h3>
        <p className="mt-1 text-sm text-text/50">Send an in-app notification to all users or a specific role group.</p>
        <form onSubmit={handleBroadcast} className="mt-4 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Title *</label>
              <input value={broadcastForm.title} onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))} required className={INPUT} placeholder="New feature announcement" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Type</label>
              <select value={broadcastForm.type} onChange={(e) => setBroadcastForm((f) => ({ ...f, type: e.target.value }))}
                className={INPUT}>
                {["SYSTEM","ORDER_UPDATE","PROMOTION","REVIEW_UPDATE","PAYOUT","RESTOCK","COMMUNITY"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Body *</label>
            <textarea value={broadcastForm.body} onChange={(e) => setBroadcastForm((f) => ({ ...f, body: e.target.value }))} required rows={3}
              className={`${INPUT} resize-y`} placeholder="Write the notification message here…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Roles (comma separated, empty = all)</label>
              <input value={broadcastForm.roles} onChange={(e) => setBroadcastForm((f) => ({ ...f, roles: e.target.value }))} className={INPUT} placeholder="CUSTOMER, CELEBRITY, …" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Action URL (optional)</label>
              <input value={broadcastForm.actionUrl} onChange={(e) => setBroadcastForm((f) => ({ ...f, actionUrl: e.target.value }))} className={INPUT} placeholder="/orders" />
            </div>
          </div>
          {broadcastResult && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{broadcastResult}</div>
          )}
          <button type="submit" disabled={broadcasting}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition disabled:opacity-50">
            {broadcasting ? "Sending…" : "Send Notification"}
          </button>
        </form>
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">{editForm.key ? "Edit Setting" : "New Setting"}</h3>
            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Key *</label>
                <input
                  value={editForm.key}
                  onChange={(e) => setEditForm((f) => ({ ...f, key: e.target.value }))}
                  required
                  disabled={settings.some((s) => s.key === editForm.key)}
                  className={INPUT}
                  placeholder="FEATURE_FLAG_NAME"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Value *</label>
                <input value={editForm.value} onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))} required className={INPUT} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Description</label>
                <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className={INPUT} placeholder="What does this setting do?" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-text/70">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
