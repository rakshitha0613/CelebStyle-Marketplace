"use client";

import { useState, useMemo } from "react";
import { OutfitCard } from "@/components/outfit-card";
import type { Outfit, Celebrity } from "@/lib/api";

type SearchClientProps = {
  initialOutfits: Outfit[];
  celebrities: Celebrity[];
  allOccasions: string[];
  allCategories: string[];
  initialFilters: {
    search: string;
    occasion: string;
    category: string;
    celebrityId: string;
    year: string;
  };
};

export function SearchClient({ initialOutfits, celebrities, allOccasions, allCategories, initialFilters }: SearchClientProps) {
  const [search, setSearch] = useState(initialFilters.search);
  const [occasion, setOccasion] = useState(initialFilters.occasion);
  const [category, setCategory] = useState(initialFilters.category);
  const [celebrityId, setCelebrityId] = useState(initialFilters.celebrityId);
  const [colorPalette, setColorPalette] = useState("");
  const [movieName, setMovieName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [industry, setIndustry] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "price_asc" | "price_desc" | "newest">("relevance");

  const allColors = [...new Set(initialOutfits.map((o) => o.colorPalette).filter(Boolean))].sort();
  const allMovies = [...new Set(initialOutfits.map((o) => o.movieName).filter(Boolean))].sort();
  const allCharacters = [...new Set(initialOutfits.map((o) => o.characterName).filter(Boolean))].sort() as string[];
  const allIndustries = [...new Set(celebrities.map((c) => c.industry))].sort();

  const filtered = useMemo(() => {
    let results = [...initialOutfits];
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) =>
          o.movieName.toLowerCase().includes(q) ||
          o.category.toLowerCase().includes(q) ||
          o.occasion.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.celebrityName.toLowerCase().includes(q) ||
          o.colorPalette.toLowerCase().includes(q) ||
          (o.characterName || "").toLowerCase().includes(q)
      );
    }
    if (occasion) results = results.filter((o) => o.occasion === occasion);
    if (category) results = results.filter((o) => o.category === category);
    if (celebrityId) results = results.filter((o) => o.celebrityId === celebrityId);
    if (colorPalette) results = results.filter((o) => o.colorPalette === colorPalette);
    if (movieName) results = results.filter((o) => o.movieName === movieName);
    if (characterName) results = results.filter((o) => o.characterName === characterName);
    if (industry) {
      const celebsInIndustry = new Set(celebrities.filter((c) => c.industry === industry).map((c) => c.id));
      results = results.filter((o) => celebsInIndustry.has(o.celebrityId));
    }
    // Sorting
    if (sortBy === "price_asc") results.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") results.sort((a, b) => b.price - a.price);
    else if (sortBy === "newest") results.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return results;
  }, [initialOutfits, celebrities, search, occasion, category, celebrityId, colorPalette, movieName, characterName, industry, sortBy]);

  const clearFilters = () => {
    setSearch("");
    setOccasion("");
    setCategory("");
    setCelebrityId("");
    setColorPalette("");
    setMovieName("");
    setCharacterName("");
    setIndustry("");
    setSortBy("relevance");
  };

  const handleTagClick = (filterType: "occasion" | "category" | "color", value: string) => {
    if (filterType === "occasion") setOccasion(value);
    if (filterType === "category") setCategory(value);
    if (filterType === "color") setColorPalette(value);
  };

  const activeFilterCount = [search, occasion, category, celebrityId, colorPalette, movieName, characterName, industry].filter(Boolean).length;

  return (
    <>
      {/* Filters */}
      <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.32em] text-accent">Filters</p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Movie, celebrity, color..."
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Occasion</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All occasions</option>
              {allOccasions.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Color Palette</label>
            <select
              value={colorPalette}
              onChange={(e) => setColorPalette(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All colors</option>
              {allColors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Celebrity</label>
            <select
              value={celebrityId}
              onChange={(e) => setCelebrityId(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All celebrities</option>
              {celebrities.map((celeb) => (
                <option key={celeb.id} value={celeb.id}>
                  {celeb.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Industry / Region</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All industries</option>
              {allIndustries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Movie / Show</label>
            <select
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All movies</option>
              {allMovies.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Character</label>
            <select
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All characters</option>
              {allCharacters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-text/60">
          {filtered.length} {filtered.length === 1 ? "look" : "looks"} found
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
          <p className="font-serif text-2xl text-primary">No outfits match your filters</p>
          <p className="mt-2 text-sm text-text/60">Try adjusting your search or clearing filters</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} onTagClick={handleTagClick} />
          ))}
        </div>
      )}
    </>
  );
}
