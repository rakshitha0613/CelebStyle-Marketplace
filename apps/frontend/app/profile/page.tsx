"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  getStoredToken,
  getProfile,
  updateProfile,
  adminLogout,
  customerLogout,
} from "@/lib/api";
import type { UserProfile } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  CELEBRITY: "Celebrity",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Administrator",
  MANUFACTURER_PARTNER: "Manufacturer Partner",
  CELEBRITY_MANAGER: "Celebrity Manager",
  CONTENT_MODERATOR: "Content Moderator",
  ANALYST: "Analyst",
};

const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/profile");
      return;
    }
    getProfile().then((data) => {
      if (!data) {
        router.replace("/login?redirect=/profile");
        return;
      }
      setProfile(data);
      setLoading(false);
    });
  }, [router]);

  const startEdit = () => {
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
    setAvatarUrl(profile?.avatar ?? "");
    setNameError("");
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setNameError("");
    setSaveError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    setSaveError("");

    if (!name.trim()) {
      setNameError("Name cannot be empty.");
      return;
    }
    if (name.trim().length > 100) {
      setNameError("Name must be 100 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      if (updated) {
        setProfile(updated);
        setEditing(false);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
    customerLogout();
    router.push("/");
    router.refresh();
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

  if (!profile) return null;

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Profile</h1>

        {/* Avatar */}
        {profile.avatar && (
          <div className="mt-6">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="h-20 w-20 rounded-full border border-black/10 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {editing ? (
          /* ── Edit form ── */
          <form
            onSubmit={handleSave}
            noValidate
            className="mt-8 space-y-5 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-accent">Edit Profile</p>

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLS}
                placeholder="Your full name"
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-600">{nameError}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full rounded-xl border border-black/5 bg-black/5 px-4 py-3 text-sm text-text/50 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-text/40">Email cannot be changed</p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Phone <span className="normal-case font-normal text-text/40">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLS}
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
                Avatar URL <span className="normal-case font-normal text-text/40">(optional)</span>
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className={INPUT_CLS}
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* ── View mode ── */
          <div className="mt-8 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm">
            <div className="space-y-5">
              <Row label="Name" value={profile.name} />
              <Row label="Email" value={profile.email} />
              <Row label="Phone" value={profile.phone ?? "—"} />
              <Row
                label="Role"
                value={ROLE_LABELS[profile.role] ?? profile.role}
              />
              <Row
                label="Email Verified"
                value={profile.emailVerified ? "Yes" : "No — check your inbox"}
              />
              <Row
                label="Member Since"
                value={new Date(profile.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>

            <div className="mt-8 border-t border-black/6 pt-6 flex flex-wrap gap-3">
              <button
                onClick={startEdit}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Edit Profile
              </button>
              <Link
                href="/orders"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                My Orders
              </Link>
              <Link
                href="/addresses"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Addresses
              </Link>
              <Link
                href="/wishlist"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Wishlist
              </Link>
              <Link
                href="/saved-looks"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Saved Looks
              </Link>
              <Link
                href="/notifications"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Notifications
              </Link>
              <Link
                href="/size-profile"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Size Profile
              </Link>
              <Link
                href="/invoices"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Invoices
              </Link>
              <Link
                href="/returns"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Returns
              </Link>
              <Link
                href="/refunds"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Refunds
              </Link>
              <Link
                href="/customizations"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Customisations
              </Link>
              <Link
                href="/bulk-order"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Bulk Orders
              </Link>
              <Link
                href="/wedding-order"
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                Wedding Orders
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-text/60 transition hover:bg-black/5"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-text/50">{label}</p>
      <p className="mt-1 text-sm text-text">{value}</p>
    </div>
  );
}
