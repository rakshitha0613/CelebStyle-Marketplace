"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getPriceAlerts,
  deletePriceAlert,
  getCelebrityAlerts,
  unfollowCelebrity,
  getStoredToken,
} from "@/lib/api";
import type { AppNotification, PriceAlert, CelebrityAlert } from "@/lib/api";

const TABS = ["Notifications", "Price Alerts", "Followed Celebrities"] as const;
type Tab = (typeof TABS)[number];

const TYPE_ICON: Record<string, string> = {
  ORDER_STATUS:         "📦",
  PRICE_DROP:           "🏷️",
  BACK_IN_STOCK:        "✅",
  NEW_COLLECTION:       "✨",
  COMMUNITY_LIKE:       "♥",
  COMMUNITY_COMMENT:    "💬",
  CELEBRITY_NEW_OUTFIT: "⭐",
  REVIEW_APPROVED:      "⭐",
  RETURN_UPDATE:        "↩️",
  REFUND_UPDATE:        "💳",
  SYSTEM:               "🔔",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Notifications");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [celAlerts, setCelAlerts] = useState<CelebrityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/notifications");
      return;
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    const [notifData, priceData, celData] = await Promise.all([
      getNotifications({ limit: 50 }),
      getPriceAlerts(),
      getCelebrityAlerts(),
    ]);
    setNotifications(notifData.notifications);
    setUnreadCount(notifData.unreadCount);
    setPriceAlerts(priceData);
    setCelAlerts(celData);
    setLoading(false);
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDeletePriceAlert = async (id: string) => {
    await deletePriceAlert(id);
    setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUnfollow = async (id: string) => {
    await unfollowCelebrity(id);
    setCelAlerts((prev) => prev.filter((a) => a.id !== id));
  };

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
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <div className="flex items-end justify-between mt-3">
          <h1 className="font-serif text-4xl text-primary">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 border-b border-black/6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-text/50 hover:text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {/* Notifications tab */}
          {tab === "Notifications" && (
            <>
              {notifications.length === 0 && (
                <div className="text-center py-16 text-text/40">
                  <p className="text-3xl mb-3">🔔</p>
                  <p className="text-sm">You have no notifications yet.</p>
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && handleMarkRead(n.id)}
                  className={`rounded-[16px] border p-4 transition cursor-pointer ${
                    n.read ? "border-black/6 bg-white" : "border-accent/20 bg-accent/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {TYPE_ICON[n.type] ?? "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${n.read ? "text-text" : "text-primary"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-text/60 mt-0.5">{n.body}</p>
                      <p className="text-xs text-text/40 mt-1">
                        {new Date(n.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  {n.actionUrl && (
                    <Link
                      href={n.actionUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 ml-8 inline-block text-xs text-accent hover:underline"
                    >
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Price Alerts tab */}
          {tab === "Price Alerts" && (
            <>
              {priceAlerts.length === 0 && (
                <div className="text-center py-16 text-text/40">
                  <p className="text-3xl mb-3">🏷️</p>
                  <p className="text-sm">No price alerts set. Visit an outfit page to set one.</p>
                </div>
              )}
              {priceAlerts.map((a) => (
                <div key={a.id} className="rounded-[16px] border border-black/6 bg-white p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">{a.outfitName}</p>
                    <p className="text-xs text-text/60 mt-0.5">
                      Alert when price drops to{" "}
                      <span className="font-medium text-accent">
                        ₹{a.targetPrice.toLocaleString("en-IN")}
                      </span>
                      {" "}(currently ₹{a.currentPrice.toLocaleString("en-IN")})
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePriceAlert(a.id)}
                    className="text-xs text-red-500 hover:underline ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Celebrity Alerts tab */}
          {tab === "Followed Celebrities" && (
            <>
              {celAlerts.length === 0 && (
                <div className="text-center py-16 text-text/40">
                  <p className="text-3xl mb-3">⭐</p>
                  <p className="text-sm">You are not following any celebrities.</p>
                  <Link
                    href="/celebrities"
                    className="mt-4 inline-block text-sm text-accent hover:underline"
                  >
                    Browse celebrities
                  </Link>
                </div>
              )}
              {celAlerts.map((a) => (
                <div key={a.id} className="rounded-[16px] border border-black/6 bg-white p-4 flex items-center justify-between">
                  <div>
                    <Link
                      href={`/celebrities/${a.celebrityId}`}
                      className="text-sm font-medium text-primary hover:text-accent transition"
                    >
                      {a.celebrityName}
                    </Link>
                    <p className="text-xs text-text/50 mt-0.5">
                      Following since {new Date(a.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnfollow(a.id)}
                    className="text-xs text-red-500 hover:underline ml-4"
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
