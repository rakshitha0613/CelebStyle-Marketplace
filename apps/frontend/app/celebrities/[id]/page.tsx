import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getCelebrity, getOutfits, getManufacturers } from "@/lib/api";
import Link from "next/link";
import { FallbackImage } from "./fallback-image";

type CelebrityDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CelebrityDetailPage({ params }: CelebrityDetailPageProps) {
  const { id } = await params;
  const [celebrity, allOutfits, manufacturers] = await Promise.all([
    getCelebrity(id),
    getOutfits({ celebrityId: id }),
    getManufacturers()
  ]);

  if (!celebrity) notFound();

  const mfrMap = new Map(manufacturers.map((m) => [m.id, m]));
  const occasionGroups = [...new Set(allOutfits.map((o) => o.occasion))].sort();

  // Separate film/character outfits vs event/red carpet outfits
  const filmOutfits = allOutfits.filter(o =>
    o.characterName && o.characterName.trim() !== "" && o.characterName !== "Red Carpet" &&
    o.characterName !== "Promotional" && o.characterName !== "Global Event" && !o.characterName.includes("Event Appearance")
  );
  const eventOutfits = allOutfits.filter(o =>
    !filmOutfits.find(f => f.id === o.id)
  );

  return (
    <main>
      <Navbar />

      {/* Hero banner */}
      <section className="relative overflow-hidden">
        <div className="relative aspect-[21/8] w-full bg-primary">
          <img
            src={celebrity.bannerImage}
            alt={celebrity.name}
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
            <p className="text-xs uppercase tracking-[0.36em] text-gold">{celebrity.industry}</p>
            <h1 className="mt-3 font-serif text-5xl text-background lg:text-6xl">{celebrity.name}</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">

          {/* Left — outfit archive */}
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Bio</p>
            <p className="mt-3 text-lg leading-8 text-text/80">{celebrity.bio}</p>

            <div className="mt-10">
              <p className="text-xs uppercase tracking-[0.36em] text-accent">Style Tags</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {celebrity.styleTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary px-4 py-2 text-sm text-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Films & Character Looks section */}
            {filmOutfits.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <p className="text-xs uppercase tracking-[0.36em] text-accent">Films & Character Looks</p>
                  <span className="text-sm text-text/40">{filmOutfits.length} iconic outfits</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {filmOutfits.map((outfit) => {
                    const linkedMfrs = (outfit.manufacturerIds || []).map((mid) => mfrMap.get(mid)).filter(Boolean);
                    const galleryImages = (outfit as any).images?.length > 0 ? (outfit as any).images : [outfit.imageUrl];
                    return (
                      <Link key={outfit.id} href={`/outfits/${outfit.id}`}>
                        <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                          {/* Primary image */}
                          {outfit.imageUrl && (
                            <div className="mb-4 aspect-[4/3] overflow-hidden rounded-[14px] bg-primary relative">
                              <FallbackImage
                                src={outfit.imageUrl}
                                alt={`${outfit.characterName || outfit.category} from ${outfit.movieName}`}
                                className="h-full w-full object-cover"
                              />
                              {/* Film badge */}
                              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                                <span className="text-white text-xs">🎬 {outfit.movieName}</span>
                              </div>
                              {/* Multi-image indicator */}
                              {galleryImages.length > 1 && (
                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                                  <span className="text-white text-xs">📷 {galleryImages.length}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-serif text-xl text-primary">{outfit.category}</p>
                              <p className="mt-1 text-sm font-medium text-accent">
                                {outfit.characterName}
                              </p>
                              <p className="mt-0.5 text-xs text-text/50">
                                {outfit.movieName}{outfit.year ? ` · ${outfit.year}` : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-text/70">{outfit.description}</p>
                          {outfit.colorPalette && (
                            <p className="mt-2 text-xs text-text/50">🎨 {outfit.colorPalette}</p>
                          )}
                          {linkedMfrs.length > 0 && (
                            <div className="mt-3 border-t border-black/5 pt-3">
                              <div className="flex flex-wrap gap-2">
                                {linkedMfrs.map((m) => m && (
                                  <span key={m.id} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-primary">
                                    {m.verified && <span className="text-gold">✓</span>}
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Events & Ad Film section */}
            {eventOutfits.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <p className="text-xs uppercase tracking-[0.36em] text-accent">Events, Ad Films & Red Carpet</p>
                  <span className="text-sm text-text/40">{eventOutfits.length} looks</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {eventOutfits.map((outfit) => {
                    const linkedMfrs = (outfit.manufacturerIds || []).map((mid) => mfrMap.get(mid)).filter(Boolean);
                    const galleryImages = (outfit as any).images?.length > 0 ? (outfit as any).images : [outfit.imageUrl];
                    return (
                      <Link key={outfit.id} href={`/outfits/${outfit.id}`}>
                        <div className="rounded-[20px] border border-black/6 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                          {outfit.imageUrl && (
                            <div className="mb-4 aspect-[4/3] overflow-hidden rounded-[14px] bg-primary relative">
                              <FallbackImage
                                src={outfit.imageUrl}
                                alt={`${outfit.category} - ${outfit.occasion}`}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                                <span className="text-white text-xs">✨ {outfit.occasion}</span>
                              </div>
                              {galleryImages.length > 1 && (
                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
                                  <span className="text-white text-xs">📷 {galleryImages.length}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-serif text-xl text-primary">{outfit.category}</p>
                              <p className="mt-1 text-xs text-text/50">
                                {outfit.movieName}{outfit.year ? ` · ${outfit.year}` : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-medium text-primary">₹{outfit.price.toLocaleString("en-IN")}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-text/70">{outfit.description}</p>
                          {outfit.colorPalette && (
                            <p className="mt-2 text-xs text-text/50">🎨 {outfit.colorPalette}</p>
                          )}
                          {linkedMfrs.length > 0 && (
                            <div className="mt-3 border-t border-black/5 pt-3">
                              <div className="flex flex-wrap gap-2">
                                {linkedMfrs.map((m) => m && (
                                  <span key={m.id} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-primary">
                                    {m.verified && <span className="text-gold">✓</span>}
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {allOutfits.length === 0 && (
              <p className="mt-12 text-text/50">No outfits catalogued yet.</p>
            )}
          </div>

          {/* Right — profile card */}
          <div className="space-y-6">
            <div className="rounded-[28px] border border-black/6 bg-white p-6 shadow-sm">
              <div className="aspect-[3/4] overflow-hidden rounded-[20px] bg-primary">
                <img
                  src={celebrity.profileImage}
                  alt={celebrity.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-5">
                <p className="font-serif text-2xl text-primary">{celebrity.name}</p>
                <p className="mt-1 text-sm text-text/60">{celebrity.industry}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Quick Stats</p>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Total Looks</span>
                  <span className="font-medium text-primary">{allOutfits.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Film Characters</span>
                  <span className="font-medium text-primary">{filmOutfits.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Events & Promos</span>
                  <span className="font-medium text-primary">{eventOutfits.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Occasions</span>
                  <span className="font-medium text-primary">{occasionGroups.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text/60">Industry</span>
                  <span className="font-medium text-primary">{celebrity.industry}</span>
                </div>
              </div>
            </div>

            <Link
              href={`/search?celebrityId=${celebrity.id}`}
              className="block w-full rounded-full bg-primary py-3 text-center text-sm font-medium text-background transition hover:opacity-90"
            >
              Browse all looks →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
