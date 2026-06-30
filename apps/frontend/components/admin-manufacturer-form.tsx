"use client";

import { useState } from "react";

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
  manufacturer?: Manufacturer;
  onSuccess?: () => void;
  onCancel?: () => void;
};

const specialtyOptions = [
  "Saree",
  "Lehenga",
  "Gown",
  "Anarkali",
  "Suit",
  "Kurta",
  "Fusion",
  "Western",
  "Bandhgala",
  "Sherwani",
  "Bridal",
  "Nehru Jacket Set",
  "Shirt + Veshti",
];

export function AdminManufacturerForm({ manufacturer, onSuccess, onCancel }: Props) {
  const [name, setName] = useState(manufacturer?.name || "");
  const [location, setLocation] = useState(manufacturer?.location || "");
  const [contactEmail, setContactEmail] = useState(manufacturer?.contactEmail || "");
  const [rating, setRating] = useState(manufacturer?.rating?.toString() || "4.5");
  const [verified, setVerified] = useState(manufacturer?.verified ?? false);
  const [selectedSpecialties, setSelectedSpecialties] = useState(manufacturer?.specialties || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = manufacturer ? `/api/manufacturers/${manufacturer.id}` : "/api/manufacturers";
      const method = manufacturer ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          location,
          contactEmail,
          rating: Number(rating),
          verified,
          specialties: selectedSpecialties,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save manufacturer");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty) ? prev.filter((s) => s !== specialty) : [...prev, specialty]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-black/6 bg-white p-6">
      <h3 className="font-serif text-2xl text-primary">{manufacturer ? "Edit Manufacturer" : "Add Manufacturer"}</h3>
      
      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-primary">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm"
          placeholder="e.g., Sabyasachi Couture"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary">Location *</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm"
          placeholder="e.g., Kolkata, India"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary">Contact Email *</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm"
          placeholder="contact@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary">Rating (1-5)</label>
        <input
          type="number"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          min="1"
          max="5"
          step="0.1"
          className="mt-1 w-full rounded border border-black/10 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="verified"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
          className="rounded border border-black/10"
        />
        <label htmlFor="verified" className="text-sm font-medium text-primary">
          Verified Manufacturer
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary">Specialties</label>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {specialtyOptions.map((specialty) => (
            <label key={specialty} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedSpecialties.includes(specialty)}
                onChange={() => toggleSpecialty(specialty)}
                className="rounded border border-black/10"
              />
              <span className="text-sm text-primary">{specialty}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Saving..." : manufacturer ? "Update" : "Add"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-black/10 px-4 py-2 text-sm font-medium text-primary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
