export type OptimizationArea =
  | "database"
  | "cache"
  | "compression"
  | "static-assets"
  | "memory"
  | "connection-pool"
  | "query"
  | "bundle";

export type OptimizationPriority = "critical" | "high" | "medium" | "low";

export interface OptimizationRecommendation {
  id: string;
  area: OptimizationArea;
  priority: OptimizationPriority;
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  implemented: boolean;
  detail?: string;
}

export interface PerformanceSnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  uptimeSeconds: number;
  gcRuns?: number;
}

export interface QueryOptimizationHint {
  pattern: string;
  issue: string;
  suggestion: string;
  severity: OptimizationPriority;
}

export interface CacheEffectiveness {
  hitRate: number;
  missRate: number;
  recommendation: string;
}

export interface OptimizationReport {
  generatedAt: number;
  recommendations: OptimizationRecommendation[];
  performanceSnapshot: PerformanceSnapshot;
  score: number;
  summary: { total: number; implemented: number; pending: number; byPriority: Record<OptimizationPriority, number> };
}

// ── Static recommendations (always applicable) ────────────────────────────────

const STATIC_RECOMMENDATIONS: OptimizationRecommendation[] = [
  // Database
  {
    id: "DB-001",
    area: "database",
    priority: "high",
    title: "PgBouncer Connection Pooling",
    description: "DATABASE_URL uses pgbouncer=true parameter — Prisma routes through PgBouncer for connection pooling.",
    impact: "Reduces PostgreSQL connection overhead by 60-80% under load.",
    effort: "low",
    implemented: true,
  },
  {
    id: "DB-002",
    area: "database",
    priority: "high",
    title: "Prisma Query Batching with findMany",
    description: "Use Prisma's select to fetch only required fields instead of full model projections.",
    impact: "Reduces payload size and query execution time by 20-40%.",
    effort: "medium",
    implemented: true,
    detail: "Repositories use explicit select clauses on heavy queries.",
  },
  {
    id: "DB-003",
    area: "database",
    priority: "medium",
    title: "Database Indexes on Foreign Keys",
    description: "Prisma schema should index all foreign key columns used in WHERE clauses.",
    impact: "Prevents sequential scans on join operations.",
    effort: "low",
    implemented: true,
  },
  {
    id: "DB-004",
    area: "database",
    priority: "medium",
    title: "Avoid N+1 Queries via Prisma include",
    description: "Use Prisma include/select rather than per-item fetches in loops.",
    impact: "Eliminates N+1 patterns that scale linearly with result set size.",
    effort: "medium",
    implemented: true,
  },
  // Cache
  {
    id: "CACHE-001",
    area: "cache",
    priority: "critical",
    title: "Redis Caching for Recommendation Results",
    description: "Cache recommendation responses in Redis with TTL to avoid recomputing expensive ML inference per request.",
    impact: "Reduces P99 recommendation latency from ~800ms to <50ms for cached users.",
    effort: "medium",
    implemented: false,
    detail: "Recommendation endpoints currently compute fresh results on every request.",
  },
  {
    id: "CACHE-002",
    area: "cache",
    priority: "high",
    title: "HTTP Cache-Control Headers for Static Assets",
    description: "Set Cache-Control: public, max-age=31536000, immutable on hashed static assets.",
    impact: "Eliminates repeat download of unchanged assets — faster subsequent page loads.",
    effort: "low",
    implemented: true,
    detail: "Next.js sets immutable cache on /_next/static/* assets.",
  },
  {
    id: "CACHE-003",
    area: "cache",
    priority: "high",
    title: "CDN-Friendly ETags on API Responses",
    description: "Add ETag/Last-Modified headers to frequently-read API endpoints (celebrities, outfits catalogue).",
    impact: "Enables conditional GET — CDN/browser avoids full response download on unchanged data.",
    effort: "medium",
    implemented: false,
  },
  {
    id: "CACHE-004",
    area: "cache",
    priority: "medium",
    title: "Prisma Query Result Caching",
    description: "Cache Prisma query results for catalogue data (celebrities, outfits) that changes infrequently.",
    impact: "Reduces DB query load by up to 90% for read-heavy catalogue endpoints.",
    effort: "medium",
    implemented: false,
  },
  // Compression
  {
    id: "COMP-001",
    area: "compression",
    priority: "high",
    title: "Gzip/Brotli Compression Enabled",
    description: "compression middleware (level 6) applied to all API responses >= 1KB.",
    impact: "Reduces payload size by 60-80% for JSON responses.",
    effort: "low",
    implemented: true,
  },
  {
    id: "COMP-002",
    area: "compression",
    priority: "medium",
    title: "Nginx Brotli for Static Assets",
    description: "Nginx gzip is enabled. Add ngx_brotli module for superior compression ratio.",
    impact: "Brotli achieves 15-20% better compression than gzip for text assets.",
    effort: "high",
    implemented: false,
    detail: "Requires nginx rebuild with ngx_brotli module.",
  },
  // Memory
  {
    id: "MEM-001",
    area: "memory",
    priority: "high",
    title: "In-Memory Store TTL and Eviction",
    description: "Ring buffers in MonitoringService, CacheMonitoringService cap at MAX_SAMPLES to prevent unbounded growth.",
    impact: "Prevents memory leaks from unbounded in-memory data accumulation.",
    effort: "low",
    implemented: true,
  },
  {
    id: "MEM-002",
    area: "memory",
    priority: "medium",
    title: "Node.js Heap Size Configuration",
    description: "Set --max-old-space-size in production based on container memory limit.",
    impact: "Prevents OOM kills by constraining heap to a predictable ceiling.",
    effort: "low",
    implemented: false,
    detail: "Add NODE_OPTIONS=--max-old-space-size=512 to backend Dockerfile CMD.",
  },
  // Connection pool
  {
    id: "POOL-001",
    area: "connection-pool",
    priority: "high",
    title: "PgBouncer Pool Mode: Transaction",
    description: "PgBouncer in transaction mode reduces DB connections from N connections to 1 per active transaction.",
    impact: "Allows hundreds of application connections with a small DB connection pool.",
    effort: "low",
    implemented: true,
    detail: "pgbouncer=true in DATABASE_URL enables transaction mode pooling.",
  },
  {
    id: "POOL-002",
    area: "connection-pool",
    priority: "medium",
    title: "Prisma connection_limit Setting",
    description: "Set connection_limit=5 in DATABASE_URL to cap Prisma's internal pool per process.",
    impact: "Prevents runaway connection growth under burst traffic.",
    effort: "low",
    implemented: false,
    detail: "Add ?connection_limit=5 to the direct (non-pooler) DATABASE_URL_DIRECT.",
  },
  // Static assets
  {
    id: "ASSET-001",
    area: "static-assets",
    priority: "medium",
    title: "Next.js Image Optimization",
    description: "next/image component provides automatic WebP conversion and responsive srcSet.",
    impact: "Images served in WebP are 30% smaller than JPEG at equivalent quality.",
    effort: "medium",
    implemented: true,
  },
  {
    id: "ASSET-002",
    area: "static-assets",
    priority: "low",
    title: "thum.io Wikipedia Screenshots",
    description: "Celebrity images fall back to thum.io screenshots for missing images.",
    impact: "Third-party image service adds latency and external dependency risk.",
    effort: "high",
    implemented: true,
    detail: "Consider pre-fetching and caching these images in a storage bucket.",
  },
  // Bundle
  {
    id: "BUNDLE-001",
    area: "bundle",
    priority: "medium",
    title: "Next.js Standalone Output",
    description: "output: 'standalone' in next.config.mjs minimizes the Docker image to only required files.",
    impact: "Reduces Docker image from ~1GB to ~200MB — faster cold starts.",
    effort: "low",
    implemented: true,
  },
  {
    id: "BUNDLE-002",
    area: "bundle",
    priority: "low",
    title: "Bundle Analysis",
    description: "Run next build with ANALYZE=true to identify large dependencies in the client bundle.",
    impact: "Identifies opportunities to lazy-load or replace large libraries.",
    effort: "low",
    implemented: false,
  },
];

const QUERY_HINTS: QueryOptimizationHint[] = [
  {
    pattern: "findMany without take/skip",
    issue: "Unbounded findMany can return all rows — use pagination.",
    suggestion: "Always pass take and skip (or cursor) to findMany on tables that grow unboundedly.",
    severity: "high",
  },
  {
    pattern: "SELECT * (no select clause)",
    issue: "Fetching all columns when only a subset is needed wastes bandwidth and parse time.",
    suggestion: "Use Prisma select to specify only required fields.",
    severity: "medium",
  },
  {
    pattern: "Nested include without depth limit",
    issue: "Deep nested includes can trigger hundreds of sub-queries.",
    suggestion: "Limit include depth to 2 levels; join manually for deep relations.",
    severity: "high",
  },
  {
    pattern: "prisma.$transaction with many operations",
    issue: "Long transactions hold locks and block other writers.",
    suggestion: "Keep transactions short; use PgBouncer transaction mode.",
    severity: "medium",
  },
  {
    pattern: "count on large tables without index",
    issue: "COUNT(*) on unindexed tables requires a full sequential scan.",
    suggestion: "Add index on commonly-counted columns; use approximate counts for UI.",
    severity: "low",
  },
];

export class PerformanceOptimizationService {
  private snapshots: PerformanceSnapshot[] = [];
  private customRecommendations: OptimizationRecommendation[] = [];

  takeSnapshot(): PerformanceSnapshot {
    const mem = process.memoryUsage();
    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      uptimeSeconds: Math.round(process.uptime()),
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 100) this.snapshots.shift();
    return snapshot;
  }

  getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  getMemoryTrend(): "stable" | "growing" | "shrinking" {
    if (this.snapshots.length < 3) return "stable";
    const recent = this.snapshots.slice(-5);
    const first = recent[0].heapUsedMB;
    const last = recent[recent.length - 1].heapUsedMB;
    const delta = last - first;
    if (delta > 10) return "growing";
    if (delta < -10) return "shrinking";
    return "stable";
  }

  addRecommendation(rec: OptimizationRecommendation): void {
    this.customRecommendations.push(rec);
  }

  getRecommendations(filter?: { area?: OptimizationArea; priority?: OptimizationPriority; implemented?: boolean }): OptimizationRecommendation[] {
    let recs = [...STATIC_RECOMMENDATIONS, ...this.customRecommendations];
    if (filter?.area) recs = recs.filter((r) => r.area === filter.area);
    if (filter?.priority) recs = recs.filter((r) => r.priority === filter.priority);
    if (filter?.implemented !== undefined) recs = recs.filter((r) => r.implemented === filter.implemented);
    return recs;
  }

  getQueryHints(): QueryOptimizationHint[] {
    return QUERY_HINTS;
  }

  evaluateCacheEffectiveness(hitRate: number): CacheEffectiveness {
    let recommendation: string;
    if (hitRate >= 0.9) {
      recommendation = "Excellent cache hit rate. Current TTL and key strategy are well-tuned.";
    } else if (hitRate >= 0.7) {
      recommendation = "Good hit rate. Review TTL for high-miss keys and consider cache warming.";
    } else if (hitRate >= 0.5) {
      recommendation = "Moderate hit rate. Audit cache key design and eviction policy.";
    } else {
      recommendation = "Low hit rate. Cache may be under-sized or TTLs too short. Review Redis maxmemory-policy.";
    }
    return { hitRate, missRate: 1 - hitRate, recommendation };
  }

  generateReport(): OptimizationReport {
    const snapshot = this.takeSnapshot();
    const recs = this.getRecommendations();
    const implemented = recs.filter((r) => r.implemented).length;
    const pending = recs.filter((r) => !r.implemented).length;
    const byPriority: Record<OptimizationPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of recs) {
      if (!r.implemented) byPriority[r.priority]++;
    }

    // Score: deduct for each pending recommendation weighted by priority
    const weights: Record<OptimizationPriority, number> = { critical: 25, high: 15, medium: 8, low: 3 };
    const maxScore = recs.reduce((s, r) => s + weights[r.priority], 0);
    const pendingScore = recs.filter((r) => !r.implemented).reduce((s, r) => s + weights[r.priority], 0);
    const score = maxScore > 0 ? Math.round(((maxScore - pendingScore) / maxScore) * 100) : 100;

    return {
      generatedAt: Date.now(),
      recommendations: recs,
      performanceSnapshot: snapshot,
      score,
      summary: { total: recs.length, implemented, pending, byPriority },
    };
  }
}
