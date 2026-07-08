"use client";

import { useState, useEffect } from "react";
import type { Celebrity, Outfit, Manufacturer, Coupon } from "@/lib/api";
import { adminLogin, adminLogout, getStoredToken, getCoupons } from "@/lib/api";

// Legacy tabs
import { CelebritiesTab }  from "./tabs/celebrities-tab";
import { OutfitsTab }      from "./tabs/outfits-tab";
import { ManufacturersTab } from "./tabs/manufacturers-tab";
import { ModerationTab }   from "./tabs/moderation-tab";
import { AnalyticsTab }    from "./tabs/analytics-tab";
import { ReportsTab }      from "./tabs/reports-tab";
import { CouponsTab }      from "./tabs/coupons-tab";

// New tabs
import { DashboardTab }    from "./tabs/dashboard-tab";
import { UsersTab }        from "./tabs/users-tab";
import { OrdersTab }       from "./tabs/orders-tab";
import { ReviewsTab }      from "./tabs/reviews-tab";
import { ReturnsTab }      from "./tabs/returns-tab";
import { SettlementsTab }  from "./tabs/settlements-tab";
import { InventoryTab }    from "./tabs/inventory-tab";
import { BlogTab }         from "./tabs/blog-tab";
import { StorefrontsTab }  from "./tabs/storefronts-tab";
import { AuditTab }        from "./tabs/audit-tab";
import { SettingsTab }     from "./tabs/settings-tab";

type Tab =
  | "dashboard"
  | "users"
  | "orders"
  | "celebrities"
  | "outfits"
  | "manufacturers"
  | "storefronts"
  | "inventory"
  | "returns"
  | "settlements"
  | "reviews"
  | "blog"
  | "moderation"
  | "coupons"
  | "analytics"
  | "reports"
  | "audit"
  | "settings";

type NavSection = {
  label: string;
  items: { id: Tab; label: string }[];
};

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard",    label: "Dashboard" },
      { id: "analytics",    label: "Analytics" },
      { id: "reports",      label: "Reports" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { id: "orders",       label: "Orders" },
      { id: "returns",      label: "Returns & Refunds" },
      { id: "settlements",  label: "Settlements" },
      { id: "inventory",    label: "Inventory" },
      { id: "coupons",      label: "Coupons" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { id: "outfits",      label: "Outfits" },
      { id: "celebrities",  label: "Celebrities" },
      { id: "manufacturers",label: "Manufacturers" },
      { id: "storefronts",  label: "Storefronts" },
    ],
  },
  {
    label: "Community",
    items: [
      { id: "users",        label: "Users" },
      { id: "reviews",      label: "Reviews" },
      { id: "moderation",   label: "Moderation" },
      { id: "blog",         label: "Blog" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "audit",        label: "Audit Logs" },
      { id: "settings",     label: "Settings" },
    ],
  },
];

type AdminClientProps = {
  initialCelebrities: Celebrity[];
  initialOutfits: Outfit[];
  initialManufacturers: Manufacturer[];
};

export function AdminClient({ initialCelebrities, initialOutfits, initialManufacturers }: AdminClientProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [celebrities, setCelebrities] = useState(initialCelebrities);
  const [outfits, setOutfits]         = useState(initialOutfits);
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [coupons, setCoupons]         = useState<Coupon[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [loginEmail, setLoginEmail]     = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError]     = useState("");
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
          <p className="mt-2 text-sm text-text/70">Sign in with your administrator credentials to manage the platform.</p>
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

  const currentLabel = NAV.flatMap((s) => s.items).find((i) => i.id === tab)?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen gap-0 -mx-4 sm:-mx-8 md:-mx-12 lg:-mx-16 xl:-mx-24">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 overflow-y-auto
        border-r border-black/6 bg-white
        transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-black/6 px-6 py-5">
            <p className="font-serif text-lg text-primary">CelebStyle</p>
            <p className="text-xs text-text/40 mt-0.5">Admin Console</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {NAV.map((section) => (
              <div key={section.label}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text/30">
                  {section.label}
                </p>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                      tab === item.id
                        ? "bg-primary text-background"
                        : "text-text/70 hover:bg-secondary hover:text-primary"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-black/6 px-4 py-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm text-text/60 transition hover:bg-secondary hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-black/6 bg-white/90 backdrop-blur-sm px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border border-black/10 p-2 text-text/60 hover:bg-secondary transition lg:hidden"
            aria-label="Open menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <h1 className="font-serif text-xl text-primary">{currentLabel}</h1>
        </header>

        <main className="p-6 lg:p-8">
          {tab === "dashboard"    && <DashboardTab />}
          {tab === "users"        && <UsersTab />}
          {tab === "orders"       && <OrdersTab />}
          {tab === "celebrities"  && <CelebritiesTab celebrities={celebrities} setCelebrities={setCelebrities} />}
          {tab === "outfits"      && <OutfitsTab outfits={outfits} setOutfits={setOutfits} celebrities={celebrities} manufacturers={manufacturers} />}
          {tab === "manufacturers"&& <ManufacturersTab manufacturers={manufacturers} setManufacturers={setManufacturers} />}
          {tab === "storefronts"  && <StorefrontsTab />}
          {tab === "inventory"    && <InventoryTab />}
          {tab === "returns"      && <ReturnsTab />}
          {tab === "settlements"  && <SettlementsTab />}
          {tab === "reviews"      && <ReviewsTab />}
          {tab === "blog"         && <BlogTab />}
          {tab === "moderation"   && <ModerationTab />}
          {tab === "coupons"      && <CouponsTab coupons={coupons} setCoupons={setCoupons} />}
          {tab === "analytics"    && (
            <AnalyticsTab
              outfitCount={outfits.length}
              celebrityCount={celebrities.length}
              avgPrice={outfits.length > 0 ? Math.round(outfits.reduce((s, o) => s + o.price, 0) / outfits.length) : 0}
            />
          )}
          {tab === "reports"      && <ReportsTab />}
          {tab === "audit"        && <AuditTab />}
          {tab === "settings"     && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
