"use client";

import { useState, useEffect } from "react";
import type { Celebrity, Outfit, Manufacturer, Coupon } from "@/lib/api";
import { adminLogin, adminLogout, getStoredToken, getCoupons } from "@/lib/api";
import { CelebritiesTab } from "./tabs/celebrities-tab";
import { OutfitsTab } from "./tabs/outfits-tab";
import { ManufacturersTab } from "./tabs/manufacturers-tab";
import { ModerationTab } from "./tabs/moderation-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";
import { ReportsTab } from "./tabs/reports-tab";
import { CouponsTab } from "./tabs/coupons-tab";

type Tab = "overview" | "celebrities" | "outfits" | "manufacturers" | "analytics" | "moderation" | "reports" | "coupons";

type AdminClientProps = {
  initialCelebrities: Celebrity[];
  initialOutfits: Outfit[];
  initialManufacturers: Manufacturer[];
};

export function AdminClient({ initialCelebrities, initialOutfits, initialManufacturers }: AdminClientProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [celebrities, setCelebrities] = useState(initialCelebrities);
  const [outfits, setOutfits] = useState(initialOutfits);
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // ── Login gate ──────────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    setIsLoggedIn(!!token);
    if (token) getCoupons().then(setCoupons).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await adminLogin(loginEmail, loginPassword);
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="mt-16 flex justify-center">
        <div className="w-full max-w-sm rounded-[28px] border border-black/6 bg-white p-8 shadow-sm">
          <h2 className="font-serif text-3xl text-primary">Admin Login</h2>
          <p className="mt-2 text-sm text-text/70">Sign in with your administrator credentials to manage the catalogue.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {loginLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const industryCounts = celebrities.reduce<Record<string, number>>((acc, c) => {
    acc[c.industry] = (acc[c.industry] || 0) + 1;
    return acc;
  }, {});

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "celebrities", label: `Celebrities (${celebrities.length})` },
    { id: "outfits", label: `Outfits (${outfits.length})` },
    { id: "manufacturers", label: `Manufacturers (${manufacturers.length})` },
    { id: "coupons", label: `Coupons (${coupons.length})` },
    { id: "analytics", label: "Analytics" },
    { id: "reports", label: "Reports" },
    { id: "moderation", label: "Moderation" },
  ];

  return (
    <>
      {/* Logout bar */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleLogout}
          className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-text/60 transition hover:bg-secondary hover:text-primary"
        >
          Sign out
        </button>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {[
          { label: "Celebrities", value: celebrities.length },
          { label: "Outfits", value: outfits.length },
          { label: "Manufacturers", value: manufacturers.length },
          { label: "Industries", value: Object.keys(industryCounts).length }
        ].map((stat) => (
          <div key={stat.label} className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-accent">{stat.label}</p>
            <p className="mt-3 font-serif text-4xl text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="mt-10 flex flex-wrap gap-1 rounded-2xl border border-black/6 bg-white p-1.5 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
              tab === t.id
                ? "bg-primary text-background shadow-sm"
                : "text-text/60 hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-8">
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.32em] text-accent">Industry Coverage</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(industryCounts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([industry, count]) => (
                    <span key={industry} className="rounded-full bg-secondary px-3 py-1 text-sm text-primary">
                      {industry}: {count}
                    </span>
                  ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.32em] text-accent">Occasion Breakdown</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(
                  outfits.reduce<Record<string, number>>((acc, o) => {
                    acc[o.occasion] = (acc[o.occasion] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => b - a)
                  .map(([occ, count]) => (
                    <span key={occ} className="rounded-full bg-secondary px-3 py-1 text-sm text-primary">
                      {occ}: {count}
                    </span>
                  ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Manage Celebrities", desc: "Add, edit, or remove celebrity profiles", tab: "celebrities" as Tab },
                { label: "Manage Outfits", desc: "Add outfit entries, tag metadata, link manufacturers", tab: "outfits" as Tab },
                { label: "Manage Manufacturers", desc: "Onboard and verify tailor/manufacturer network", tab: "manufacturers" as Tab },
                { label: "Analytics", desc: "Revenue, commissions, and catalogue performance", tab: "analytics" as Tab },
                { label: "Reports", desc: "Settlement and commission reports with date filters", tab: "reports" as Tab },
                { label: "Moderation", desc: "Review reported community posts and content", tab: "moderation" as Tab },
                { label: "Coupons", desc: "Create and manage discount codes and promotions", tab: "coupons" as Tab },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setTab(action.tab)}
                  className="rounded-[24px] border border-black/6 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-luxe"
                >
                  <p className="font-medium text-primary">{action.label}</p>
                  <p className="mt-1 text-sm text-text/60">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "celebrities" && (
          <CelebritiesTab celebrities={celebrities} setCelebrities={setCelebrities} />
        )}

        {tab === "outfits" && (
          <OutfitsTab outfits={outfits} setOutfits={setOutfits} celebrities={celebrities} manufacturers={manufacturers} />
        )}

        {tab === "manufacturers" && (
          <ManufacturersTab manufacturers={manufacturers} setManufacturers={setManufacturers} />
        )}

        {tab === "analytics" && (
          <AnalyticsTab outfitCount={outfits.length} celebrityCount={celebrities.length} />
        )}

        {tab === "reports" && (
          <ReportsTab />
        )}

        {tab === "moderation" && (
          <ModerationTab />
        )}

        {tab === "coupons" && (
          <CouponsTab coupons={coupons} setCoupons={setCoupons} />
        )}
      </div>
    </>
  );
}
