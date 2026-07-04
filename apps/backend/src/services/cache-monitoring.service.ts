export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  missRate: number;
  totalOperations: number;
  cacheSize: number;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
}

export interface LatencyPercentiles {
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface CacheKeyStats {
  key: string;
  hits: number;
  misses: number;
  lastAccessedAt: number;
}

const MAX_LATENCY_SAMPLES = 1000;

export class CacheMonitoringService {
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private cacheSize = 0;

  private hitLatencies: number[] = [];
  private missLatencies: number[] = [];
  private allLatencies: number[] = [];

  private keyStats = new Map<string, { hits: number; misses: number; lastAccessedAt: number }>();

  recordHit(key: string, latencyMs: number): void {
    this.hits++;
    this.hitLatencies.push(latencyMs);
    this.allLatencies.push(latencyMs);
    if (this.hitLatencies.length > MAX_LATENCY_SAMPLES) this.hitLatencies.shift();
    if (this.allLatencies.length > MAX_LATENCY_SAMPLES * 2) this.allLatencies.shift();

    const ks = this.keyStats.get(key) ?? { hits: 0, misses: 0, lastAccessedAt: 0 };
    ks.hits++;
    ks.lastAccessedAt = Date.now();
    this.keyStats.set(key, ks);
  }

  recordMiss(key: string, latencyMs: number): void {
    this.misses++;
    this.missLatencies.push(latencyMs);
    this.allLatencies.push(latencyMs);
    if (this.missLatencies.length > MAX_LATENCY_SAMPLES) this.missLatencies.shift();
    if (this.allLatencies.length > MAX_LATENCY_SAMPLES * 2) this.allLatencies.shift();

    const ks = this.keyStats.get(key) ?? { hits: 0, misses: 0, lastAccessedAt: 0 };
    ks.misses++;
    ks.lastAccessedAt = Date.now();
    this.keyStats.set(key, ks);
  }

  recordEviction(): void {
    this.evictions++;
    if (this.cacheSize > 0) this.cacheSize--;
  }

  setCacheSize(size: number): void {
    this.cacheSize = Math.max(0, size);
  }

  incrementCacheSize(): void { this.cacheSize++; }
  decrementCacheSize(): void { if (this.cacheSize > 0) this.cacheSize--; }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.hits / total) * 1000) / 1000 : 0;
  }

  getMissRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.misses / total) * 1000) / 1000 : 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.getHitRate(),
      missRate: this.getMissRate(),
      totalOperations: total,
      cacheSize: this.cacheSize,
      avgHitLatencyMs: this.avg(this.hitLatencies),
      avgMissLatencyMs: this.avg(this.missLatencies),
    };
  }

  getLatencyPercentiles(): LatencyPercentiles {
    const sorted = [...this.allLatencies].sort((a, b) => a - b);
    return {
      p50Ms: this.percentile(sorted, 50),
      p90Ms: this.percentile(sorted, 90),
      p95Ms: this.percentile(sorted, 95),
      p99Ms: this.percentile(sorted, 99),
    };
  }

  getHotKeys(limit = 10): CacheKeyStats[] {
    return [...this.keyStats.entries()]
      .map(([key, s]) => ({ key, ...s }))
      .sort((a, b) => b.hits + b.misses - (a.hits + a.misses))
      .slice(0, limit);
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.cacheSize = 0;
    this.hitLatencies = [];
    this.missLatencies = [];
    this.allLatencies = [];
    this.keyStats.clear();
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  private avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  }
}
