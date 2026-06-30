import { Navbar } from "@/components/navbar";
import { getOutfits, getCelebrities } from "@/lib/api";
import { SearchClient } from "./search-client";

type SearchPageProps = {
  searchParams: Promise<{ search?: string; occasion?: string; category?: string; celebrityId?: string; year?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  // Always fetch ALL outfits so client-side filtering has the full set
  const [allOutfits, celebrities] = await Promise.all([getOutfits(), getCelebrities()]);

  const occasions = [...new Set(allOutfits.map((o) => o.occasion))].sort();
  const categories = [...new Set(allOutfits.map((o) => o.category))].sort();

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Discover</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Browse looks by occasion, film & celebrity</h1>
        <SearchClient
          initialOutfits={allOutfits}
          celebrities={celebrities}
          allOccasions={occasions}
          allCategories={categories}
          initialFilters={{
            search: params.search ?? "",
            occasion: params.occasion ?? "",
            category: params.category ?? "",
            celebrityId: params.celebrityId ?? "",
            year: params.year ?? "",
          }}
        />
      </section>
    </main>
  );
}
