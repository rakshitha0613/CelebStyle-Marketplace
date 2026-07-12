import { Navbar } from "@/components/navbar";
import { getCelebrities, getOutfits, getManufacturers } from "@/lib/api";
import type { Celebrity, Outfit, Manufacturer } from "@/lib/api";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  let celebrities: Celebrity[] = [];
  let outfits: Outfit[] = [];
  let manufacturers: Manufacturer[] = [];
  try {
    [celebrities, outfits, manufacturers] = await Promise.all([
      getCelebrities(),
      getOutfits(),
      getManufacturers(),
    ]);
  } catch {
    // Backend may be cold-starting; AdminClient will re-fetch client-side
  }

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Admin CMS</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Catalogue management</h1>
        <AdminClient
          initialCelebrities={celebrities}
          initialOutfits={outfits}
          initialManufacturers={manufacturers}
        />
      </section>
    </main>
  );
}
