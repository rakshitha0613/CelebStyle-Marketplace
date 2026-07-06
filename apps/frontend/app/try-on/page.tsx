import type { Metadata } from 'next';
import { TryOnWrapper } from './try-on-wrapper';

export const metadata: Metadata = {
  title: 'Virtual Try-On | CelebStyle',
  description: 'Try on celebrity outfits using on-device AR — no data leaves your device.',
};

type TryOnPageProps = {
  searchParams: Promise<{ outfitId?: string }>;
};

export default async function TryOnPage({ searchParams }: TryOnPageProps) {
  const { outfitId } = await searchParams;
  return (
    <main>
      <TryOnWrapper preloadOutfitId={outfitId} />
    </main>
  );
}
