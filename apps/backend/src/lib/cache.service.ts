/**
 * cache.service — TTL cache with optional Redis write-through.
 *
 * Architecture:
 *   - All synchronous call sites use the in-memory layer (unchanged behaviour).
 *   - When REDIS_URL is configured, every write is also propagated to Redis
 *     asynchronously (fire-and-forget), and the in-memory cache is pre-warmed
 *     from Redis on startup via `warmFromRedis()`.
 *   - Reads always hit in-memory first; this preserves the synchronous contract
 *     required by the many existing call sites.
 */

import { config } from "../env.js";

// ── Core interface ────────────────────────────────────────────────────────────

export interface ICacheService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
  has(key: string): boolean;
  clear(): void;
}

// ── TTL constants (milliseconds) ─────────────────────────────────────────────

export const TTL = {
  USER_FEATURES:       10 * 60_000,
  USER_EMBEDDING:       5 * 60_000,
  PRODUCT_FEATURES:    15 * 60_000,
  TRENDING:             5 * 60_000,
  RECENTLY_VIEWED:     30 * 60_000,
  FEATURE_SNAPSHOT:    10 * 60_000,
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

  evict(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Redis write-through wrapper ───────────────────────────────────────────────

class RedisBackedCacheService extends InMemoryCacheService {
  private redis: import("ioredis").Redis | null = null;
  private ready = false;

  constructor() {
    super();
    this.connect();
  }

  private connect(): void {
    if (!config.redis.enabled || !config.redis.url) return;
    import("ioredis").then((mod) => {
      // ioredis v5 exports default differently depending on module system
      const Redis = (mod.default ?? mod) as unknown as new (url: string, opts: object) => import("ioredis").Redis;
      const client = new Redis(config.redis.url!, { lazyConnect: true, maxRetriesPerRequest: 1 });
      client.on("ready", () => { this.ready = true; });
      client.on("error", () => { this.ready = false; });
      client.connect().catch(() => { /* startup failure is non-fatal */ });
      this.redis = client;
    }).catch(() => { /* ioredis unavailable — in-memory only */ });
  }

  override set<T>(key: string, value: T, ttlMs?: number): void {
    super.set(key, value, ttlMs);
    if (this.ready && this.redis) {
      const serialized = JSON.stringify(value);
      const ttlSec = ttlMs ? Math.ceil(ttlMs / 1000) : 86_400;
      this.redis.set(`cs:${key}`, serialized, "EX", ttlSec).catch(() => { /* best-effort */ });
    }
  }

  override del(key: string): void {
    super.del(key);
    if (this.ready && this.redis) {
      this.redis.del(`cs:${key}`).catch(() => { /* best-effort */ });
    }
  }

  override clear(): void {
    super.clear();
    if (this.ready && this.redis) {
      this.redis.keys("cs:*").then((keys) => {
        if (keys.length > 0) this.redis!.del(...keys).catch(() => {});
      }).catch(() => {});
    }
  }

  /** Warm the in-memory cache from Redis on startup. Call once after connect. */
  async warmFromRedis(): Promise<void> {
    if (!this.ready || !this.redis) return;
    try {
      const keys = await this.redis.keys("cs:*");
      if (keys.length === 0) return;
      const pipeline = this.redis.pipeline();
      for (const k of keys) pipeline.get(k);
      const results = await pipeline.exec();
      if (!results) return;
      for (let i = 0; i < keys.length; i++) {
        const [, raw] = results[i]!;
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw) as unknown;
            const localKey = keys[i]!.replace(/^cs:/, "");
            super.set(localKey, parsed);
          } catch { /* skip malformed entries */ }
        }
      }
    } catch { /* warming is non-critical */ }
  }
}

// ── Domain helpers built on top of the core interface ─────────────────────────

export type RecentlyViewedList = string[]; // productId[]
const RV_MAX = 20;

class CacheServiceWithHelpers extends RedisBackedCacheService {
  getRecentlyViewed(sessionId: string): RecentlyViewedList {
    return this.get<RecentlyViewedList>(CacheKey.recentlyViewed(sessionId)) ?? [];
  }

  addRecentlyViewed(sessionId: string, productId: string): void {
    const list = this.getRecentlyViewed(sessionId).filter((id) => id !== productId);
    list.unshift(productId);
    this.set(CacheKey.recentlyViewed(sessionId), list.slice(0, RV_MAX), TTL.RECENTLY_VIEWED);
  }

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

  getProductFeatures(productId: string): Record<string, unknown> | null {
    return this.get(CacheKey.productFeatures(productId));
  }

  setProductFeatures(productId: string, features: Record<string, unknown>): void {
    this.set(CacheKey.productFeatures(productId), features, TTL.PRODUCT_FEATURES);
  }

  getTrending(window: string): Array<{ productId: string; score: number; rank: number }> | null {
    return this.get(CacheKey.trending(window));
  }

  setTrending(window: string, entries: Array<{ productId: string; score: number; rank: number }>): void {
    this.set(CacheKey.trending(window), entries, TTL.TRENDING);
  }
}

export const cacheService = new CacheServiceWithHelpers();
