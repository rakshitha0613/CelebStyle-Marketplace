import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { StorefrontBuilder } from "@/components/storefront-builder";
import { getCelebrities, getStorefronts, getCommissionSummary } from "@/lib/api";

export default async function StorefrontsPage() {
  const [storefronts, commission, celebrities] = await Promise.all([getStorefronts(), getCommissionSummary(), getCelebrities()]);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Storefronts</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Celebrity brand spaces</h1>
        <p className="mt-4 text-text/70">Built-in storefront builder and commission tracking for Phase 2.</p>

        {commission && (
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-accent">Orders</p><p className="mt-2 font-serif text-4xl text-primary">{commission.orders}</p></div>
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-accent">Gross</p><p className="mt-2 font-serif text-4xl text-primary">₹{commission.gross.toLocaleString("en-IN")}</p></div>
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-accent">Platform Fee</p><p className="mt-2 font-serif text-4xl text-primary">₹{commission.platformFee.toLocaleString("en-IN")}</p></div>
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-accent">Celebrity Commission</p><p className="mt-2 font-serif text-4xl text-primary">₹{commission.celebrityCommission.toLocaleString("en-IN")}</p></div>
            <div className="rounded-[24px] border border-black/6 bg-white p-6 shadow-sm"><p className="text-xs uppercase tracking-[0.24em] text-accent">Paid</p><p className="mt-2 font-serif text-4xl text-primary">₹{commission.paid.toLocaleString("en-IN")}</p></div>
          </div>
        )}

        <div className="mt-10">
          <StorefrontBuilder celebrities={celebrities} initialStorefronts={storefronts} />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {storefronts.map((storefront) => (
            <Link key={storefront.celebrityId} href={`/storefronts/${storefront.celebrityId}`} className="overflow-hidden rounded-[28px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe">
              <div className="aspect-[4/3] bg-primary">
                <img src={storefront.bannerImage} alt={storefront.displayName} className="h-full w-full object-cover" />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-2xl text-primary">{storefront.displayName}</h2>
                  <p className="text-xs uppercase tracking-[0.24em] text-accent">{storefront.verified ? "Verified" : "Pending"}</p>
                </div>
                <p className="mt-2 text-sm text-text/70">{storefront.message}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
