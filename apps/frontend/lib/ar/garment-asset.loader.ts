import type { GarmentAsset } from './garment.types.js';
import { GARMENT_PLACEHOLDER_URL } from './outfit-to-garment.js';

interface CachedEntry {
  image: HTMLImageElement;
  lastAccessed: number;
}

export class GarmentAssetLoader {
  private cache = new Map<string, CachedEntry>();
  private inflight = new Map<string, Promise<HTMLImageElement>>();
  private readonly maxCacheSize: number;

  constructor(maxCacheSize = 20) {
    this.maxCacheSize = maxCacheSize;
  }

  async loadImage(asset: GarmentAsset): Promise<HTMLImageElement> {
    const hit = this.cache.get(asset.id);
    if (hit) {
      hit.lastAccessed = Date.now();
      return hit.image;
    }

    // Deduplicate concurrent loads for the same asset
    const pending = this.inflight.get(asset.id);
    if (pending) return pending;

    const promise = this.fetchWithFallback(asset.imageUrl);
    this.inflight.set(asset.id, promise);

    let image: HTMLImageElement;
    try {
      image = await promise;
    } finally {
      this.inflight.delete(asset.id);
    }

    this.evictIfNeeded();
    this.cache.set(asset.id, { image, lastAccessed: Date.now() });
    return image;
  }

  /**
   * Tries the primary URL first; on failure falls back to the placeholder.
   * Never rejects — the page must never crash because a garment image is missing.
   */
  private fetchWithFallback(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => resolve(img);

      img.onerror = () => {
        if (url === GARMENT_PLACEHOLDER_URL) {
          resolve(this.blankImage());
          return;
        }

        const fallback = new Image();
        fallback.crossOrigin = 'anonymous';
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => resolve(this.blankImage());
        fallback.src = GARMENT_PLACEHOLDER_URL;
      };

      img.src = url;
    });
  }

  /** Returns a 1×1 transparent image so the AR canvas renders without a garment. */
  private blankImage(): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  }

  private evictIfNeeded(): void {
    if (this.cache.size < this.maxCacheSize) return;
    // LRU eviction
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  isLoaded(assetId: string): boolean { return this.cache.has(assetId); }
  isLoading(assetId: string): boolean { return this.inflight.has(assetId); }
  getCacheSize(): number { return this.cache.size; }
  clearCache(): void { this.cache.clear(); this.inflight.clear(); }
}
