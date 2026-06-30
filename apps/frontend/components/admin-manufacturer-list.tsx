"use client";

import { useState, useEffect } from "react";

type Manufacturer = {
  id: string;
  name: string;
  location: string;
  rating: number;
  contactEmail: string;
  verified: boolean;
  specialties: string[];
};

type Props = {
  onEdit: (manufacturer: Manufacturer) => void;
  refreshTrigger?: number;
};

export function AdminManufacturerList({ onEdit, refreshTrigger }: Props) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchManufacturers();
  }, [refreshTrigger]);

  const fetchManufacturers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/manufacturers");
      if (!res.ok) throw new Error("Failed to fetch manufacturers");
      const data = await res.json();
      setManufacturers(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/manufacturers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchManufacturers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-text/60">Loading manufacturers...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-2xl text-primary">Manage Manufacturers ({manufacturers.length})</h3>
      
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        {manufacturers.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-black/6 p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-primary">{m.name}</p>
                {m.verified && <span className="text-xs text-gold">✓ Verified</span>}
                <span className="text-xs text-yellow-600">★ {m.rating.toFixed(1)}</span>
              </div>
              <p className="mt-1 text-xs text-text/60">
                {m.location} • {m.contactEmail}
              </p>
              <p className="mt-1 text-xs text-text/50">
                Specialties: {m.specialties.join(", ") || "None"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(m)}
                className="rounded px-3 py-1 text-sm text-primary hover:bg-primary/5"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(m.id, m.name)}
                className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {manufacturers.length === 0 && (
          <p className="py-8 text-center text-sm text-text/60">No manufacturers yet</p>
        )}
      </div>
    </div>
  );
}
