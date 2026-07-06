"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getSizeProfile, saveSizeProfile, getStoredToken } from "@/lib/api";
import type { SizeProfile } from "@/lib/api";

const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";
const LABEL_CLS = "block text-xs font-medium uppercase tracking-[0.24em] text-text/60 mb-2";

type FitPref = "SLIM" | "REGULAR" | "RELAXED";

export default function SizeProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SizeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [inseam, setInseam] = useState("");
  const [shoulder, setShoulder] = useState("");
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");
  const [dressSize, setDressSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [fitPreference, setFitPreference] = useState<FitPref | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/size-profile");
      return;
    }
    getSizeProfile().then((data) => {
      if (data) {
        setProfile(data);
        setHeight(String(data.height ?? ""));
        setWeight(String(data.weight ?? ""));
        setChest(String(data.chest ?? ""));
        setWaist(String(data.waist ?? ""));
        setHips(String(data.hips ?? ""));
        setInseam(String(data.inseam ?? ""));
        setShoulder(String(data.shoulder ?? ""));
        setTopSize(data.topSize ?? "");
        setBottomSize(data.bottomSize ?? "");
        setDressSize(data.dressSize ?? "");
        setShoeSize(data.shoeSize ?? "");
        setFitPreference((data.fitPreference as FitPref | null) ?? "");
        setNotes(data.notes ?? "");
      }
      setLoading(false);
    });
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await saveSizeProfile({
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        chest: chest ? Number(chest) : null,
        waist: waist ? Number(waist) : null,
        hips: hips ? Number(hips) : null,
        inseam: inseam ? Number(inseam) : null,
        shoulder: shoulder ? Number(shoulder) : null,
        topSize: topSize || null,
        bottomSize: bottomSize || null,
        dressSize: dressSize || null,
        shoeSize: shoeSize || null,
        fitPreference: (fitPreference as FitPref) || null,
        notes: notes || null,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
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
        <h1 className="mt-3 font-serif text-4xl text-primary">Size Profile</h1>
        <p className="mt-2 text-sm text-text/60">
          Save your measurements for smarter outfit recommendations and a better fit.
        </p>

        <form
          onSubmit={handleSave}
          className="mt-8 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm space-y-8"
        >
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Size profile saved!
            </div>
          )}

          {/* Body metrics */}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-accent mb-5">
              Body Measurements (cm / kg)
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Height (cm)", val: height, set: setHeight },
                { label: "Weight (kg)", val: weight, set: setWeight },
                { label: "Chest (cm)", val: chest, set: setChest },
                { label: "Waist (cm)", val: waist, set: setWaist },
                { label: "Hips (cm)", val: hips, set: setHips },
                { label: "Inseam (cm)", val: inseam, set: setInseam },
                { label: "Shoulder (cm)", val: shoulder, set: setShoulder },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className={LABEL_CLS}>{label}</label>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder="—"
                    min={0}
                    step="0.1"
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Size labels */}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-accent mb-5">
              Size Labels
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Top Size", val: topSize, set: setTopSize, placeholder: "S / M / L / XL / 38" },
                { label: "Bottom Size", val: bottomSize, set: setBottomSize, placeholder: "28 / 30 / M" },
                { label: "Dress Size", val: dressSize, set: setDressSize, placeholder: "6 / 8 / 10" },
                { label: "Shoe Size", val: shoeSize, set: setShoeSize, placeholder: "7 / 8 / EU 40" },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <label className={LABEL_CLS}>{label}</label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Fit preference */}
          <div>
            <label className={LABEL_CLS}>Fit Preference</label>
            <div className="flex gap-3">
              {(["SLIM", "REGULAR", "RELAXED"] as FitPref[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFitPreference(fitPreference === f ? "" : f)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    fitPreference === f
                      ? "border-primary bg-primary text-background"
                      : "border-black/10 text-text/70 hover:border-black/20"
                  }`}
                >
                  {f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL_CLS}>
              Notes <span className="normal-case font-normal text-text/40">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional details about your fit preferences…"
              className={INPUT_CLS}
            />
          </div>

          {profile && (
            <p className="text-xs text-text/40">
              Last updated: {new Date(profile.updatedAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save Size Profile"}
          </button>
        </form>
      </section>
    </main>
  );
}
