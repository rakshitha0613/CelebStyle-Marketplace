/**
 * cache.service — in-memory TTL cache with a Redis-compatible interface.
 *
 * Design intent: swap the InMemoryCacheService implementation for a Redis
 * adapter without changing any call site. All public methods match what
 * ioredis / @upstash/redis would expose for simple get/set/del/has operations.
 */

// ── Core interface (Redis-portable) ──────────────────────────────────────────

export interface ICacheService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
  has(key: string): boolean;
  clear(): void;
}

// ── TTL constants (milliseconds) ─────────────────────────────────────────────

export const TTL = {
  USER_FEATURES:       10 * 60_000,   // 10 min
  USER_EMBEDDING:       5 * 60_000,   //  5 min
  PRODUCT_FEATURES:    15 * 60_000,   // 15 min
  TRENDING:             5 * 60_000,   //  5 min
  RECENTLY_VIEWED:     30 * 60_000,   // 30 min
  FEATURE_SNAPSHOT:    10 * 60_000,   // 10 min
} as const;

// ── Key builders ──────────────────────────────────────────────────────────────

export const CacheKey = {
  userFeatures:      (userId: string)    => `user:feat:${userId}`,
  userEmbedding:     (userId: string)    => `user:emb:${userId}`,
  productFeatures:   (productId: string) => `prod:feat:${productId}`,
  trending:          (window: string)    => `trending:${window}`,
  recentlyViewed:    (sessionId: string) => `rv:${sessionId}`,
  featureSnapshot:   (userId: string)    => `feat:snap:${userId}`,
};

// ── In-memory implementation ──────────────────────────────────────────────────

interface Entry<T> {
  value:     T;
  expiresAt: number; // epoch ms, 0 = no expiry
}

class InMemoryCacheService implements ICacheService {
  private readonly store = new Map<string, Entry<unknown>>();

  private isExpired(entry: Entry<unknown>): boolean {
    return entry.expiresAt !== 0 && Date.now() > entry.expiresAt;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : 0,
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }

  /** Evict all expired entries. Call periodically if memory is a concern. */
  evict(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Domain helpers built on top of the core interface ─────────────────────────

export type RecentlyViewedList = string[]; // productId[]
const RV_MAX = 20;

class CacheServiceWithHelpers extends InMemoryCacheService {
  // Recently viewed
  getRecentlyViewed(sessionId: string): RecentlyViewedList {
    return this.get<RecentlyViewedList>(CacheKey.recentlyViewed(sessionId)) ?? [];
  }

  addRecentlyViewed(sessionId: string, productId: string): void {
    const list = this.getRecentlyViewed(sessionId).filter((id) => id !== productId);
    list.unshift(productId);
    this.set(CacheKey.recentlyViewed(sessionId), list.slice(0, RV_MAX), TTL.RECENTLY_VIEWED);
  }

  // User features
  getUserFeatures(userId: string): Record<string, unknown> | null {
    return this.get(CacheKey.userFeatures(userId));
  }

  setUserFeatures(userId: string, features: Record<string, unknown>): void {
    this.set(CacheKey.userFeatures(userId), features, TTL.USER_FEATURES);
  }

  invalidateUserFeatures(userId: string): void {
    this.del(CacheKey.userFeatures(userId));
    this.del(CacheKey.featureSnapshot(userId));
  }

  // Product features
  getProductFeatures(productId: string): Record<string, unknown> | null {
    return this.get(CacheKey.productFeatures(productId));
  }

  setProductFeatures(productId: string, features: Record<string, unknown>): void {
    this.set(CacheKey.productFeatures(productId), features, TTL.PRODUCT_FEATURES);
  }

  // Trending
  getTrending(window: string): Array<{ productId: string; score: number; rank: number }> | null {
    return this.get(CacheKey.trending(window));
  }

  setTrending(window: string, entries: Array<{ productId: string; score: number; rank: number }>): void {
    this.set(CacheKey.trending(window), entries, TTL.TRENDING);
  }
}

export const cacheService = new CacheServiceWithHelpers();
