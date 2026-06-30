import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getCelebrity, getOutfits, getStorefront } from "@/lib/api";

type Props = {
  params: Promise<{ celebrityId: string }>;
};

export default async function StorefrontDetailPage({ params }: Props) {
  const { celebrityId } = await params;
  const [storefront, celebrity, outfits] = await Promise.all([
    getStorefront(celebrityId),
    getCelebrity(celebrityId),
    getOutfits({ celebrityId })
  ]);

  if (!storefront || !celebrity) notFound();

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/storefronts" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          ← Back to storefronts
        </Link>
        <div className="mt-6 overflow-hidden rounded-[32px] border border-black/6 bg-white shadow-sm">
          <div className="aspect-[21/8] bg-primary">
            <img src={storefront.bannerImage || celebrity.bannerImage} alt={storefront.displayName} className="h-full w-full object-cover opacity-70" />
          </div>
          <div className="p-6">
            <p className="text-xs uppercase tracking-[0.36em] text-accent">{storefront.verified ? "Verified storefront" : "Storefront pending review"}</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">{storefront.displayName}</h1>
            <p className="mt-4 text-text/70">{storefront.message}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {outfits.slice(0, 6).map((outfit) => (
            <div key={outfit.id} className="rounded-[24px] border border-black/6 bg-white p-5 shadow-sm">
              <div className="aspect-[4/5] overflow-hidden rounded-[20px] bg-primary">
                <img src={outfit.imageUrl} alt={outfit.category} className="h-full w-full object-cover" />
              </div>
              <h2 className="mt-4 font-serif text-2xl text-primary">{outfit.category}</h2>
              <p className="text-sm text-text/60">{outfit.movieName}</p>
              <p className="mt-2 text-sm text-text/70">₹{outfit.price.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
