import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { OutfitCard } from "@/components/outfit-card";
import { LocalImage } from "@/components/local-image";
import { getCollection, getOutfits } from "@/lib/api";
import type { Outfit } from "@/lib/api";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const [collection, allOutfits] = await Promise.all([getCollection(slug), getOutfits()]);

  if (!collection) notFound();

  const outfitMap = new Map(allOutfits.map((o) => [o.id, o]));
  const outfits = collection.outfitIds
    .map((id) => outfitMap.get(id))
    .filter((o): o is Outfit => o !== undefined);

  return (
    <main>
      <Navbar />
      <section className="relative overflow-hidden">
        <div className="aspect-[21/8] w-full overflow-hidden bg-secondary/20">
          <LocalImage
            src={collection.coverImageUrl}
            alt={collection.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-[0.36em] text-gold">Collection</p>
          <h1 className="mt-2 font-serif text-4xl text-background sm:text-5xl">{collection.name}</h1>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="max-w-2xl text-text/70">{collection.description}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.24em] text-accent">
          {outfits.length} look{outfits.length !== 1 ? "s" : ""}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {outfits.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>
      </section>
    </main>
  );
}
