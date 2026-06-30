"use client";

import { useState } from "react";
import type { Celebrity, Outfit, Manufacturer } from "@/lib/api";
import { CelebritiesTab } from "./tabs/celebrities-tab";
import { OutfitsTab } from "./tabs/outfits-tab";
import { ManufacturersTab } from "./tabs/manufacturers-tab";

type Tab = "overview" | "celebrities" | "outfits" | "manufacturers";

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

  const industryCounts = celebrities.reduce<Record<string, number>>((acc, c) => {
    acc[c.industry] = (acc[c.industry] || 0) + 1;
    return acc;
  }, {});

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "celebrities", label: `Celebrities (${celebrities.length})` },
    { id: "outfits", label: `Outfits (${outfits.length})` },
    { id: "manufacturers", label: `Manufacturers (${manufacturers.length})` }
  ];

  return (
    <>
      {/* Stats */}
      <div className="mt-8 grid gap-4 md:grid-cols-4">
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
      <div className="mt-10 flex gap-1 rounded-2xl border border-black/6 bg-white p-1.5 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
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
                { label: "Manage Manufacturers", desc: "Onboard and verify tailor/manufacturer network", tab: "manufacturers" as Tab }
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
      </div>
    </>
  );
}
