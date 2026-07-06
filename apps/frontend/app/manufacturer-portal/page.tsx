"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getMyRoutingAssignments,
  acceptRouting,
  dispatchRouting,
  getStoredToken,
  getCurrentUser,
} from "@/lib/api";
import type { RoutingAssignment } from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  PENDING:        "bg-amber-50 text-amber-700 border border-amber-200",
  ASSIGNED:       "bg-blue-50 text-blue-700 border border-blue-200",
  ACCEPTED:       "bg-indigo-50 text-indigo-700 border border-indigo-200",
  IN_PRODUCTION:  "bg-purple-50 text-purple-700 border border-purple-200",
  QUALITY_PASSED: "bg-teal-50 text-teal-700 border border-teal-200",
  DISPATCHED:     "bg-green-50 text-green-700 border border-green-200",
};

export default function ManufacturerPortalPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<RoutingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    const user = getCurrentUser();
    if (!token || !user) { router.replace("/login?redirect=/manufacturer-portal"); return; }
    if (!["ADMIN", "SUPER_ADMIN", "MANUFACTURER_PARTNER"].includes(user.role)) {
      router.replace("/profile");
      return;
    }
    getMyRoutingAssignments().then((data) => {
      setAssignments(data);
      setLoading(false);
    });
  }, [router]);

  const handleAccept = async (id: string) => {
    setActionLoading(id);
    setError("");
    try {
      await acceptRouting(id);
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: "ACCEPTED" } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispatch = async (id: string) => {
    setActionLoading(id);
    setError("");
    try {
      const tracking = trackingInputs[id]?.trim();
      await dispatchRouting(id, tracking || undefined);
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: "DISPATCHED", trackingCode: tracking ?? null } : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch");
    } finally {
      setActionLoading(null);
    }
  };

  const pending   = assignments.filter((a) => ["PENDING", "ASSIGNED", "ACCEPTED", "IN_PRODUCTION", "QUALITY_PASSED"].includes(a.status));
  const completed = assignments.filter((a) => a.status === "DISPATCHED");

  if (loading) {
    return (
      <main>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
        </div>
      </main>
    );
  }

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Manufacturer Portal</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">My Assignments</h1>
        <p className="mt-3 text-base text-text/60">
          View and manage your production and dispatch assignments.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active",    value: pending.length },
            { label: "Dispatched", value: completed.length },
            { label: "Total",     value: assignments.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">{stat.label}</p>
              <p className="mt-2 font-serif text-4xl text-primary">{stat.value}</p>
            </div>
          ))}
        </div>

        {pending.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 font-serif text-2xl text-primary">Active Orders</h2>
            <div className="space-y-4">
              {pending.map((a) => (
                <div key={a.id} className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <img
                        src={a.orderItem.imageUrl}
                        alt={a.orderItem.productName}
                        className="h-20 w-16 shrink-0 rounded-2xl object-cover bg-primary/10"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div>
                        <p className="font-medium text-primary">{a.orderItem.productName}</p>
                        <p className="text-sm text-text/60">{a.orderItem.category} · Size {a.orderItem.size}</p>
                        <p className="mt-1 text-sm font-medium text-primary">₹{a.orderItem.unitPrice.toLocaleString("en-IN")}</p>
                        <p className="mt-1 text-xs text-text/50">
                          Order #{a.order.orderNumber} · {a.order.shippingName}
                        </p>
                        <p className="text-xs text-text/40">
                          {new Date(a.order.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[a.status] ?? "bg-secondary text-text/60"}`}>
                      {a.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {(a.status === "PENDING" || a.status === "ASSIGNED") && (
                      <button
                        onClick={() => handleAccept(a.id)}
                        disabled={actionLoading === a.id}
                        className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
                      >
                        {actionLoading === a.id ? "…" : "Accept Order"}
                      </button>
                    )}
                    {(a.status === "ACCEPTED" || a.status === "IN_PRODUCTION" || a.status === "QUALITY_PASSED") && (
                      <div className="flex items-center gap-2">
                        <input
                          value={trackingInputs[a.id] ?? ""}
                          onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="Tracking code (optional)"
                          className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm w-48"
                        />
                        <button
                          onClick={() => handleDispatch(a.id)}
                          disabled={actionLoading === a.id}
                          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
                        >
                          {actionLoading === a.id ? "…" : "Mark Dispatched"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 font-serif text-2xl text-primary">Dispatched</h2>
            <div className="space-y-3">
              {completed.map((a) => (
                <div key={a.id} className="rounded-[24px] border border-black/6 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-primary">{a.orderItem.productName}</p>
                    <p className="text-xs text-text/50">Order #{a.order.orderNumber} · {a.order.shippingName}</p>
                    {a.trackingCode && (
                      <p className="mt-1 text-xs font-mono text-accent">Tracking: {a.trackingCode}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Dispatched
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {assignments.length === 0 && (
          <div className="mt-16 text-center">
            <p className="font-serif text-2xl text-primary">No assignments yet</p>
            <p className="mt-2 text-sm text-text/50">Orders assigned to your manufacturer account will appear here.</p>
            <Link href="/profile" className="mt-6 inline-flex rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-text/70 hover:border-black/20">
              Back to profile
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
