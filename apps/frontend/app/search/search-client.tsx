"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    const celebNames = celebrities
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ label: c.name, type: "celebrity" as const }));
    const movieNames = [...new Set(initialOutfits.map((o) => o.movieName).filter(Boolean))]
      .filter((m) => m.toLowerCase().includes(q))
      .slice(0, 3)
      .map((m) => ({ label: m, type: "movie" as const }));
    const categories = [...new Set(initialOutfits.map((o) => o.category))]
      .filter((c) => c.toLowerCase().includes(q))
      .slice(0, 2)
      .map((c) => ({ label: c, type: "category" as const }));
    return [...celebNames.slice(0, 3), ...movieNames, ...categories].slice(0, 7);
  }, [search, celebrities, initialOutfits]);

  const allColors = [...new Set(initialOutfits.map((o) => o.colorPalette).filter(Boolean))].sort();
  const allMovies = [...new Set(initialOutfits.map((o) => o.movieName).filter(Boolean))].sort();
  const allCharacters = [...new Set(initialOutfits.map((o) => o.characterName).filter(Boolean))].sort() as string[];
  const allIndustries = [...new Set(celebrities.map((c) => c.industry))].sort();

  const priceMin = Math.min(...initialOutfits.map((o) => o.price));
  const priceMax = Math.max(...initialOutfits.map((o) => o.price));

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
    if (minPrice !== "") results = results.filter((o) => o.price >= Number(minPrice));
    if (maxPrice !== "") results = results.filter((o) => o.price <= Number(maxPrice));
    // Sorting
    if (sortBy === "price_asc") results.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") results.sort((a, b) => b.price - a.price);
    else if (sortBy === "newest") results.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return results;
  }, [initialOutfits, celebrities, search, occasion, category, celebrityId, colorPalette, movieName, characterName, industry, sortBy, minPrice, maxPrice]);

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
    setMinPrice("");
    setMaxPrice("");
  };

  const handleTagClick = (filterType: "occasion" | "category" | "color", value: string) => {
    if (filterType === "occasion") setOccasion(value);
    if (filterType === "category") setCategory(value);
    if (filterType === "color") setColorPalette(value);
  };

  // Active filter pills
  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...(search ? [{ key: "search", label: `"${search}"`, clear: () => setSearch("") }] : []),
    ...(occasion ? [{ key: "occasion", label: occasion, clear: () => setOccasion("") }] : []),
    ...(category ? [{ key: "category", label: category, clear: () => setCategory("") }] : []),
    ...(celebrityId ? [{ key: "celebrity", label: celebrities.find((c) => c.id === celebrityId)?.name ?? celebrityId, clear: () => setCelebrityId("") }] : []),
    ...(colorPalette ? [{ key: "color", label: colorPalette, clear: () => setColorPalette("") }] : []),
    ...(movieName ? [{ key: "movie", label: movieName, clear: () => setMovieName("") }] : []),
    ...(characterName ? [{ key: "character", label: characterName, clear: () => setCharacterName("") }] : []),
    ...(industry ? [{ key: "industry", label: industry, clear: () => setIndustry("") }] : []),
    ...(minPrice ? [{ key: "minPrice", label: `≥ ₹${Number(minPrice).toLocaleString("en-IN")}`, clear: () => setMinPrice("") }] : []),
    ...(maxPrice ? [{ key: "maxPrice", label: `≤ ₹${Number(maxPrice).toLocaleString("en-IN")}`, clear: () => setMaxPrice("") }] : []),
  ];

  return (
    <>
      {/* Filters */}
      <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.32em] text-accent">Filters</p>
          {activeFilters.length > 0 && (
            <button onClick={clearFilters} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              Clear all ({activeFilters.length})
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div ref={searchRef} className="relative">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Movie, celebrity, color..."
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-black/10 bg-white shadow-lg">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setSearch(s.label); setShowSuggestions(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-primary hover:bg-secondary/40"
                    >
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">{s.type}</span>
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Occasion */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Occasion</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All occasions</option>
              {allOccasions.map((occ) => (
                <option key={occ} value={occ}>{occ}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Color Palette</label>
            <select
              value={colorPalette}
              onChange={(e) => setColorPalette(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All colors</option>
              {allColors.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          {/* Celebrity */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Celebrity</label>
            <select
              value={celebrityId}
              onChange={(e) => setCelebrityId(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All celebrities</option>
              {celebrities.map((celeb) => (
                <option key={celeb.id} value={celeb.id}>{celeb.name}</option>
              ))}
            </select>
          </div>

          {/* Industry */}
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

          {/* Movie */}
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

          {/* Character */}
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

          {/* Sort */}
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

          {/* Price range */}
          <div className="md:col-span-2 lg:col-span-2">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
              Price Range · ₹{priceMin.toLocaleString("en-IN")} – ₹{priceMax.toLocaleString("en-IN")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder={`Min ₹${priceMin.toLocaleString("en-IN")}`}
                min={priceMin}
                max={priceMax}
                className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <span className="shrink-0 text-sm text-text/40">–</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={`Max ₹${priceMax.toLocaleString("en-IN")}`}
                min={priceMin}
                max={priceMax}
                className="w-full rounded-xl border border-black/10 bg-background px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              onClick={f.clear}
              className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/10"
            >
              {f.label}
              <span className="text-accent/60">✕</span>
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-text/60">
          {filtered.length} {filtered.length === 1 ? "look" : "looks"} found
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
          <p className="font-serif text-2xl text-primary">No outfits match your filters</p>
          <p className="mt-2 text-sm text-text/60">Try adjusting your search or clearing filters</p>
          <button
            onClick={clearFilters}
            className="mt-4 rounded-full bg-accent/10 px-6 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20"
          >
            Clear all filters
          </button>
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
