"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, getCurrentUser, type OrderStatus } from "@/lib/api";

const STATUSES: OrderStatus[] = ["placed", "production started", "shipped", "delivered"];

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
};

export function OrderStatusTracker({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const currentIndex = STATUSES.indexOf(status);

  const advance = async () => {
    if (currentIndex >= STATUSES.length - 1) return;
    const next = STATUSES[currentIndex + 1];
    setLoading(true);
    setError("");
    try {
      const updated = await updateOrderStatus(orderId, next);
      setStatus(updated.status);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.28em] text-accent">Delivery Status</p>
      <div className="mt-5 space-y-3">
        {STATUSES.map((s, i) => {
          const done = i <= currentIndex;
          const active = s === status;
          return (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`h-3 w-3 shrink-0 rounded-full border-2 transition ${
                  done ? "border-accent bg-accent" : "border-black/20 bg-white"
                }`}
              />
              <span
                className={`text-sm capitalize transition ${
                  active ? "font-medium text-primary" : done ? "text-text/70" : "text-text/30"
                }`}
              >
                {s}
              </span>
              {active && (
                <span className="ml-auto rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  Current
                </span>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && currentIndex < STATUSES.length - 1 && (
        <button
          onClick={advance}
          disabled={loading}
          className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Updating..." : `Advance → ${STATUSES[currentIndex + 1]}`}
        </button>
      )}
      {currentIndex === STATUSES.length - 1 && (
        <p className="mt-4 text-center text-sm font-medium text-accent">✓ Order delivered</p>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
