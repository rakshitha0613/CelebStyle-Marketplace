"use client";

import { useState, useEffect } from "react";
import type { Outfit } from "@/lib/data";

type OutfitData = Outfit & { celebrityName?: string };

type Props = {
  onEdit: (outfit: OutfitData) => void;
  refreshTrigger?: number;
};

export function AdminOutfitList({ onEdit, refreshTrigger }: Props) {
  const [outfits, setOutfits] = useState<OutfitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOutfits();
  }, [refreshTrigger]);

  const fetchOutfits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/outfits");
      if (!res.ok) throw new Error("Failed to fetch outfits");
      const data = await res.json();
      setOutfits(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete ${title}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchOutfits();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-text/60">Loading outfits...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-2xl text-primary">Manage Outfits ({outfits.length})</h3>
      
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        {outfits.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg border border-black/6 p-4">
            <div className="flex items-center gap-3">
              {o.imageUrl && (
                <img 
                  src={o.imageUrl} 
                  alt={o.movieName} 
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="font-medium text-primary">{o.movieName}</p>
                <p className="text-xs text-text/60">
                  {o.celebrityName} • {o.category} • {o.occasion}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(o)}
                className="rounded px-3 py-1 text-sm text-primary hover:bg-primary/5"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(o.id, o.movieName)}
                className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {outfits.length === 0 && (
          <p className="py-8 text-center text-sm text-text/60">No outfits yet</p>
        )}
      </div>
    </div>
  );
}
