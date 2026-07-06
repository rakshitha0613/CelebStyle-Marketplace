import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getManufacturers, getOutfit, getProductRecs, getOutfitReviews } from "@/lib/api";
import type { Outfit } from "@/lib/api";
import { OutfitGallery } from "./outfit-client";
import { ReviewsSection } from "./reviews-client";
import { RecommendationCarousel } from "@/components/recommendation-carousel";

type OutfitDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OutfitDetailPage({ params }: OutfitDetailPageProps) {
  const { id } = await params;
  const [outfit, manufacturers, productSections, reviewData] = await Promise.all([
    getOutfit(id),
    getManufacturers(),
    getProductRecs(id, 6),
    getOutfitReviews(id),
  ]);

  if (!outfit) notFound();

  // Resolve the first non-empty recommendation section to actual outfit objects
  const firstSection = productSections.find((s) => s.items.length > 0);
  let similarOutfits: Outfit[] = [];
  if (firstSection) {
    const resolved = await Promise.all(
      firstSection.items.map((item) => getOutfit(item.productId))
    );
    similarOutfits = resolved.filter(
      (o): o is Outfit => o !== null && o.id !== id
    );
  }

  return (
    <main>
      <Navbar />
      <OutfitGallery outfit={outfit} manufacturers={manufacturers} />
      <ReviewsSection
        outfitId={id}
        initialReviews={reviewData.reviews}
        initialAverage={reviewData.average}
        initialTotal={reviewData.total}
      />
      <RecommendationCarousel
        subtitle="You May Also Like"
        title={firstSection?.title ?? "Similar Products"}
        outfits={similarOutfits}
        viewAllHref="/search"
      />
    </main>
  );
}
