import type { GarmentAsset } from './garment.types.js';

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

    const promise = this.fetchImage(asset.imageUrl);
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

  private fetchImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load garment image: ${url} (${e})`));
      img.src = url;
    });
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
