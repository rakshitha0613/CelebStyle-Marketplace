"use client";

import { useState, useEffect } from "react";
import type { Celebrity } from "@/lib/data";

type Props = {
  onEdit: (celebrity: Celebrity) => void;
  refreshTrigger?: number;
};

export function AdminCelebrityList({ onEdit, refreshTrigger }: Props) {
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCelebrities();
  }, [refreshTrigger]);

  const fetchCelebrities = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/celebrities");
      if (!res.ok) throw new Error("Failed to fetch celebrities");
      const data = await res.json();
      setCelebrities(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/celebrities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchCelebrities();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-text/60">Loading celebrities...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-2xl text-primary">Manage Celebrities ({celebrities.length})</h3>
      
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        {celebrities.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-black/6 p-4">
            <div className="flex items-center gap-3">
              <img 
                src={c.profileImage} 
                alt={c.name} 
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div>
                <p className="font-medium text-primary">{c.name}</p>
                <p className="text-xs text-text/60">{c.industry}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(c)}
                className="rounded px-3 py-1 text-sm text-primary hover:bg-primary/5"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(c.id, c.name)}
                className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {celebrities.length === 0 && (
          <p className="py-8 text-center text-sm text-text/60">No celebrities yet</p>
        )}
      </div>
    </div>
  );
}
