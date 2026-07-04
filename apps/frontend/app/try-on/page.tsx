import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virtual Try-On | CelebStyle',
  description: 'Try on celebrity outfits using on-device AR — no data leaves your device.',
};

const TryOnClient = dynamic(
  () => import('@/components/ar/TryOnClient'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    ),
  },
);

export default function TryOnPage() {
  return (
    <main>
      <TryOnClient />
    </main>
  );
}
