import type { Metadata } from 'next';
import { TryOnWrapper } from './try-on-wrapper';

export const metadata: Metadata = {
  title: 'Virtual Try-On | CelebStyle',
  description: 'Try on celebrity outfits using on-device AR — no data leaves your device.',
};

export default function TryOnPage() {
  return (
    <main>
      <TryOnWrapper />
    </main>
  );
}
