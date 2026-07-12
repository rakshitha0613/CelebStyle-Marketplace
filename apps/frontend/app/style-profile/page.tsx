"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

const SP_KEY = "celebstyle-style-profile";

type StyleProfile = {
  preferredCategories: string[];
  preferredColors: string[];
  preferredOccasions: string[];
  bodyType: string;
  skinTone: string;
  budgetRange: string;
  preferredFit: string[];
  stylePersonality: string;
};

const CATEGORIES = ["Saree", "Lehenga", "Anarkali", "Kurta", "Sherwani", "Dress", "Salwar Suit", "Blazer", "Indo-Western"];
const COLOURS = ["Gold", "Red", "Navy", "Pink", "Ivory", "Emerald", "Black", "White", "Teal", "Purple"];
const OCCASIONS = ["Wedding", "Festival", "Party", "Office", "Red Carpet", "Casual", "Date Night", "Vacation"];
const BODY_TYPES = ["Hourglass", "Pear", "Apple", "Rectangle", "Inverted Triangle"];
const SKIN_TONES = ["Fair", "Wheatish", "Medium", "Olive", "Dark"];
const BUDGET_RANGES = ["Under ₹5K", "₹5K–₹15K", "₹15K–₹50K", "Above ₹50K"];
const FIT_OPTIONS = ["Regular", "Slim Fit", "Relaxed", "Oversized", "Fitted Waist"];
const STYLE_PERSONALITIES = ["Classic & Elegant", "Bohemian & Free", "Modern Minimalist", "Bold & Dramatic", "Romantic & Feminine", "Street Chic"];

const DEFAULT_PROFILE: StyleProfile = {
  preferredCategories: [],
  preferredColors: [],
  preferredOccasions: [],
  bodyType: "",
  skinTone: "",
  budgetRange: "",
  preferredFit: [],
  stylePersonality: "",
};

function MultiSelectChip({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-text/60">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selected.includes(opt)
                ? "bg-primary text-background"
                : "border border-black/10 text-text/70 hover:border-primary hover:text-primary"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SingleSelectChip({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-text/60">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? "" : opt)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              value === opt
                ? "bg-primary text-background"
                : "border border-black/10 text-text/70 hover:border-primary hover:text-primary"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StyleProfilePage() {
  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SP_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
  }, []);

  const toggleMulti = (key: keyof StyleProfile, value: string) => {
    setProfile((p) => {
      const arr = p[key] as string[];
      return {
        ...p,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const setSingle = (key: keyof StyleProfile, value: string) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(SP_KEY, JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const handleReset = () => {
    setProfile(DEFAULT_PROFILE);
    try { localStorage.removeItem(SP_KEY); } catch {}
  };

  const completionScore = [
    profile.preferredCategories.length > 0,
    profile.preferredColors.length > 0,
    profile.preferredOccasions.length > 0,
    !!profile.bodyType,
    !!profile.skinTone,
    !!profile.budgetRange,
    profile.preferredFit.length > 0,
    !!profile.stylePersonality,
  ].filter(Boolean).length;

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.36em] text-accent">Personalise Your Experience</p>
          <h1 className="mt-3 font-serif text-5xl text-primary">Style Profile</h1>
          <p className="mt-2 text-base text-text/60">
            Tell us your preferences and we'll tailor recommendations, stylist advice, and Try-On suggestions just for you.
          </p>
        </div>

        {/* Profile completion */}
        <div className="mb-8 rounded-[20px] border border-black/6 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-primary">Profile Completion</p>
            <p className="text-sm font-semibold text-accent">{completionScore}/8</p>
          </div>
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(completionScore / 8) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-text/40">
            {completionScore === 8 ? "Profile complete! You'll get the best recommendations." : `${8 - completionScore} more to go for perfect recommendations.`}
          </p>
        </div>

        <div className="space-y-8">
          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-primary mb-6">What I Wear</h2>
            <div className="space-y-6">
              <MultiSelectChip
                label="Preferred Categories"
                options={CATEGORIES}
                selected={profile.preferredCategories}
                onToggle={(v) => toggleMulti("preferredCategories", v)}
              />
              <MultiSelectChip
                label="Favourite Colours"
                options={COLOURS}
                selected={profile.preferredColors}
                onToggle={(v) => toggleMulti("preferredColors", v)}
              />
              <MultiSelectChip
                label="Preferred Occasions"
                options={OCCASIONS}
                selected={profile.preferredOccasions}
                onToggle={(v) => toggleMulti("preferredOccasions", v)}
              />
              <MultiSelectChip
                label="Preferred Fit"
                options={FIT_OPTIONS}
                selected={profile.preferredFit}
                onToggle={(v) => toggleMulti("preferredFit", v)}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-2xl text-primary mb-6">About Me</h2>
            <div className="space-y-6">
              <SingleSelectChip
                label="Body Type"
                options={BODY_TYPES}
                value={profile.bodyType}
                onChange={(v) => setSingle("bodyType", v)}
              />
              <SingleSelectChip
                label="Skin Tone"
                options={SKIN_TONES}
                value={profile.skinTone}
                onChange={(v) => setSingle("skinTone", v)}
              />
              <SingleSelectChip
                label="Budget Range"
                options={BUDGET_RANGES}
                value={profile.budgetRange}
                onChange={(v) => setSingle("budgetRange", v)}
              />
              <SingleSelectChip
                label="Style Personality"
                options={STYLE_PERSONALITIES}
                value={profile.stylePersonality}
                onChange={(v) => setSingle("stylePersonality", v)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleReset}
              className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-text/60 transition hover:border-red-300 hover:text-red-600"
            >
              Reset Profile
            </button>
            <div className="flex items-center gap-3">
              {profile.preferredCategories.length > 0 || profile.stylePersonality ? (
                <Link
                  href="/ai-stylist"
                  className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
                >
                  ✨ Get AI Recommendations
                </Link>
              ) : null}
              <button
                onClick={handleSave}
                className="rounded-full bg-primary px-8 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                {saved ? "✓ Saved!" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
