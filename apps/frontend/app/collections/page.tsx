import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { LocalImage } from "@/components/local-image";
import { getCollections } from "@/lib/api";

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Collections</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Shop by Collection</h1>
        <p className="mt-4 text-text/70">Curated edits of the catalogue, grouped by occasion and style.</p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.id}`}
              className="group overflow-hidden rounded-[28px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe"
            >
              <div className="aspect-[4/3] overflow-hidden bg-secondary/20">
                <LocalImage
                  src={collection.coverImageUrl}
                  alt={collection.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h2 className="font-serif text-2xl text-primary">{collection.name}</h2>
                <p className="mt-2 text-sm text-text/70">{collection.description}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-accent">
                  {collection.outfitIds.length} look{collection.outfitIds.length !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
