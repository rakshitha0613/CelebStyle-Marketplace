import { Navbar } from "@/components/navbar";
import { IndustryFilter } from "@/components/industry-filter";
import { getCelebrities } from "@/lib/api";

export default async function CelebritiesPage() {
  const celebrities = await getCelebrities();
  const industries = [...new Set(celebrities.map((c) => c.industry))].sort();

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Catalogue</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Celebrity browsing</h1>
        <p className="mt-4 mb-10 text-text/70">{celebrities.length} celebrities across {industries.length} industries</p>

        <IndustryFilter celebrities={celebrities} industries={industries} />
      </section>
    </main>
  );
}
