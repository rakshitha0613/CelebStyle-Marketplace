"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAdminUsers, updateAdminUser, deleteAdminUser, resetAdminUserPassword,
  getAdminUserOrders, getAdminUserAddresses,
} from "../admin-api";
import type { AdminUser } from "../admin-api";

const ROLES = ["CUSTOMER","CELEBRITY","ADMIN","SUPER_ADMIN","MANUFACTURER_PARTNER","CELEBRITY_MANAGER","CONTENT_MODERATOR","ANALYST"];

const ROLE_BADGE: Record<string, string> = {
  CUSTOMER:             "bg-gray-100 text-gray-700",
  CELEBRITY:            "bg-amber-100 text-amber-700",
  ADMIN:                "bg-blue-100 text-blue-700",
  SUPER_ADMIN:          "bg-red-100 text-red-700",
  MANUFACTURER_PARTNER: "bg-green-100 text-green-700",
  CELEBRITY_MANAGER:    "bg-violet-100 text-violet-700",
  CONTENT_MODERATOR:    "bg-teal-100 text-teal-700",
  ANALYST:              "bg-indigo-100 text-indigo-700",
};

const INPUT = "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const BTN_SM = "rounded-lg px-3 py-1.5 text-xs font-medium transition";
const BTN_GHOST = `${BTN_SM} border border-black/10 text-text/70 hover:bg-black/5`;
const BTN_DANGER = `${BTN_SM} border border-red-200 text-red-600 hover:bg-red-50`;

type DetailUser = AdminUser & {
  phone: string | null;
  profile: { avatarUrl: string | null; bio: string | null } | null;
  _count: { orders: number; reviews: number; communityPosts: number };
};

type UserOrder = { id: string; orderNumber: string; total: number; status: string; createdAt: string; _count: { items: number } };
type UserAddress = { id: string; label: string | null; fullName: string; line1: string; city: string; state: string; pincode: string };

export function UsersTab() {
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [detailUser, setDetailUser]       = useState<DetailUser | null>(null);
  const [detailOrders, setDetailOrders]   = useState<UserOrder[]>([]);
  const [detailAddresses, setDetailAddresses] = useState<UserAddress[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab]         = useState<"info" | "orders" | "addresses">("info");

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState("");

  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [actionError, setActionError] = useState("");

  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers({ page, limit: LIMIT, search: search || undefined, role: roleFilter || undefined, status: statusFilter || undefined })
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch((e) => setActionError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (user: AdminUser) => {
    setDetailLoading(true);
    setDetailUser(user as DetailUser);
    setDetailTab("info");
    try {
      const [orders, addresses] = await Promise.all([
        getAdminUserOrders(user.id),
        getAdminUserAddresses(user.id),
      ]);
      setDetailOrders(orders);
      setDetailAddresses(addresses);
    } catch { /* non-fatal */ }
    setDetailLoading(false);
  };

  const openEdit = (user: AdminUser) => {
    setEditUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditActive(user.isActive);
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    setEditError("");
    try {
      const updated = await updateAdminUser(editUser.id, { name: editName, role: editRole, isActive: editActive });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      setEditUser(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Delete ${user.name} (${user.email})? This cannot be undone.`)) return;
    try {
      await deleteAdminUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((t) => t - 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (!confirm(`Reset password for ${user.email}?`)) return;
    try {
      const result = await resetAdminUserPassword(user.id);
      setResetResult(result);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          {actionError}
          <button onClick={() => setActionError("")} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[24px] border border-black/6 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/6">
          <p className="text-sm font-medium text-primary">{total.toLocaleString()} users</p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-black/6 text-left text-xs uppercase tracking-wider text-text/40">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-accent/15 flex items-center justify-center text-sm font-semibold text-accent uppercase">
                          {u.name.slice(0, 1)}
                        </div>
                        <div>
                          <p className="font-medium text-primary">{u.name}</p>
                          <p className="text-xs text-text/50">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text/70">{u._count.orders}</td>
                    <td className="px-4 py-3 text-xs text-text/50">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.deletedAt ? "bg-red-100 text-red-700" :
                        u.isActive  ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.deletedAt ? "Deleted" : u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openDetail(u)} className={BTN_GHOST}>View</button>
                        <button onClick={() => openEdit(u)} className={BTN_GHOST}>Edit</button>
                        <button onClick={() => handleResetPassword(u)} className={BTN_GHOST}>Reset PW</button>
                        {!u.deletedAt && (
                          <button onClick={() => handleDelete(u)} className={BTN_DANGER}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-text/40">No users found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/6 px-6 py-4">
            <p className="text-xs text-text/50">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg px-3 py-1.5 text-xs border border-black/10 disabled:opacity-40 hover:bg-secondary">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">Edit User</h3>
            <p className="mt-1 text-sm text-text/60">{editUser.email}</p>
            <form onSubmit={handleEdit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} required className={INPUT} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={INPUT}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="editActive" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="editActive" className="text-sm text-text/70">Active account</label>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editLoading}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-background disabled:opacity-50">
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditUser(null)}
                  className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium text-text/70">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <div className="border-b border-black/6 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="font-serif text-2xl text-primary">{detailUser.name}</p>
                <p className="text-sm text-text/60">{detailUser.email}</p>
              </div>
              <button onClick={() => setDetailUser(null)} className="mt-1 text-text/40 hover:text-primary text-xl">✕</button>
            </div>
            <div className="flex border-b border-black/6">
              {(["info","orders","addresses"] as const).map((t) => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider transition capitalize ${detailTab === t ? "border-b-2 border-accent text-accent" : "text-text/50 hover:text-primary"}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="p-6">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-accent" />
                </div>
              ) : detailTab === "info" ? (
                <div className="space-y-3 text-sm">
                  {[
                    ["ID",          detailUser.id],
                    ["Role",        detailUser.role],
                    ["Status",      detailUser.isActive ? "Active" : "Inactive"],
                    ["Email verified", detailUser.emailVerified ? "Yes" : "No"],
                    ["Orders",      String(detailUser._count?.orders ?? 0)],
                    ["Reviews",     String(detailUser._count?.reviews ?? 0)],
                    ["Joined",      new Date(detailUser.createdAt).toLocaleDateString("en-IN")],
                    ["Last login",  detailUser.lastLoginAt ? new Date(detailUser.lastLoginAt).toLocaleDateString("en-IN") : "Never"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-black/4 pb-2">
                      <span className="text-text/50">{k}</span>
                      <span className="font-medium text-primary">{v}</span>
                    </div>
                  ))}
                </div>
              ) : detailTab === "orders" ? (
                <div className="space-y-2">
                  {detailOrders.length === 0 ? <p className="text-sm text-text/40">No orders.</p> : detailOrders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-black/6 p-3">
                      <div className="flex justify-between">
                        <span className="font-mono text-xs text-text/70">{o.orderNumber}</span>
                        <span className="text-sm font-medium text-primary">₹{Number(o.total).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-text/50">
                        <span>{o.status.replace(/_/g," ")} • {o._count.items} item(s)</span>
                        <span>{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {detailAddresses.length === 0 ? <p className="text-sm text-text/40">No addresses.</p> : detailAddresses.map((a) => (
                    <div key={a.id} className="rounded-xl border border-black/6 p-3 text-sm">
                      <p className="font-medium text-primary">{a.fullName}</p>
                      <p className="text-text/60">{a.line1}, {a.city}, {a.state} {a.pincode}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password reset result */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 shadow-2xl">
            <h3 className="font-serif text-2xl text-primary">Password Reset</h3>
            <p className="mt-2 text-sm text-text/70">Temporary password for <strong>{resetResult.email}</strong>:</p>
            <div className="mt-4 rounded-xl border border-black/10 bg-secondary px-4 py-3 font-mono text-sm text-primary select-all">
              {resetResult.tempPassword}
            </div>
            <p className="mt-3 text-xs text-text/50">Share this with the user and ask them to change it immediately.</p>
            <button onClick={() => setResetResult(null)} className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-medium text-background">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
