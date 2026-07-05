import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { getManufacturers, getOutfit } from "@/lib/api";
import { OutfitGallery } from "./outfit-client";

type OutfitDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OutfitDetailPage({ params }: OutfitDetailPageProps) {
  const { id } = await params;
  const [outfit, manufacturers] = await Promise.all([getOutfit(id), getManufacturers()]);

  if (!outfit) notFound();

  return (
    <main>
      <Navbar />
      <OutfitGallery outfit={outfit} manufacturers={manufacturers} />
    </main>
  );
}
