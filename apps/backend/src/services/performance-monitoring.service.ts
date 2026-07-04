export interface SlowQuery {
  query: string;
  durationMs: number;
  timestamp: number;
  callCount: number;
}

export interface RequestProfile {
  requestId: string;
  route: string;
  method: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  memoryDeltaBytes?: number;
}

export interface MemoryPressure {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  externalMB: number;
  usagePercent: number;
  pressure: "low" | "moderate" | "high" | "critical";
  baselineDeltaMB: number;
}

export interface LongRunningRequest {
  requestId: string;
  route: string;
  method: string;
  startTime: number;
  elapsedMs: number;
}

const SLOW_QUERY_THRESHOLD_MS = 500;
const MAX_SLOW_QUERIES = 200;
const MAX_PROFILES = 1000;

export class PerformanceMonitoringService {
  private slowQueries: SlowQuery[] = [];
  private queryAggregates = new Map<string, { totalMs: number; count: number; maxMs: number }>();

  private activeProfiles = new Map<string, Omit<RequestProfile, "endTime" | "durationMs">>();
  private completedProfiles: RequestProfile[] = [];

  private memoryBaseline = process.memoryUsage().heapUsed;
  private longRunningRequests = new Map<string, { route: string; method: string; startTime: number }>();

  recordQueryDuration(query: string, durationMs: number, threshold = SLOW_QUERY_THRESHOLD_MS): void {
    const agg = this.queryAggregates.get(query) ?? { totalMs: 0, count: 0, maxMs: 0 };
    agg.totalMs += durationMs;
    agg.count++;
    agg.maxMs = Math.max(agg.maxMs, durationMs);
    this.queryAggregates.set(query, agg);

    if (durationMs >= threshold) {
      const existing = this.slowQueries.find((q) => q.query === query);
      if (existing) {
        existing.callCount++;
        if (durationMs > existing.durationMs) existing.durationMs = durationMs;
        existing.timestamp = Date.now();
      } else {
        this.slowQueries.push({ query, durationMs, timestamp: Date.now(), callCount: 1 });
        if (this.slowQueries.length > MAX_SLOW_QUERIES) this.slowQueries.shift();
      }
    }
  }

  getSlowQueries(thresholdMs = SLOW_QUERY_THRESHOLD_MS): SlowQuery[] {
    return this.slowQueries
      .filter((q) => q.durationMs >= thresholdMs)
      .sort((a, b) => b.durationMs - a.durationMs);
  }

  getQueryStats(query: string): { avgMs: number; maxMs: number; count: number } | null {
    const agg = this.queryAggregates.get(query);
    if (!agg) return null;
    return {
      avgMs: Math.round((agg.totalMs / agg.count) * 10) / 10,
      maxMs: agg.maxMs,
      count: agg.count,
    };
  }

  startRequestProfile(requestId: string, route: string, method = "GET"): void {
    this.activeProfiles.set(requestId, {
      requestId,
      route,
      method,
      startTime: Date.now(),
    });
    this.longRunningRequests.set(requestId, { route, method, startTime: Date.now() });
  }

  endRequestProfile(requestId: string): RequestProfile | null {
    const profile = this.activeProfiles.get(requestId);
    if (!profile) return null;

    const endTime = Date.now();
    const durationMs = endTime - profile.startTime;
    const memAfter = process.memoryUsage().heapUsed;

    const completed: RequestProfile = {
      ...profile,
      endTime,
      durationMs,
      memoryDeltaBytes: memAfter - this.memoryBaseline,
    };

    this.activeProfiles.delete(requestId);
    this.longRunningRequests.delete(requestId);
    this.completedProfiles.push(completed);
    if (this.completedProfiles.length > MAX_PROFILES) this.completedProfiles.shift();

    return completed;
  }

  getCompletedProfiles(limit = 50): RequestProfile[] {
    return this.completedProfiles.slice(-limit);
  }

  detectLongRunningRequests(thresholdMs = 5000): LongRunningRequest[] {
    const now = Date.now();
    const result: LongRunningRequest[] = [];
    for (const [requestId, info] of this.longRunningRequests.entries()) {
      const elapsedMs = now - info.startTime;
      if (elapsedMs >= thresholdMs) {
        result.push({ requestId, ...info, elapsedMs });
      }
    }
    return result.sort((a, b) => b.elapsedMs - a.elapsedMs);
  }

  checkMemoryPressure(): MemoryPressure {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    const heapTotalMB = mem.heapTotal / (1024 * 1024);
    const rssMB = mem.rss / (1024 * 1024);
    const externalMB = mem.external / (1024 * 1024);
    const baselineDeltaMB = (mem.heapUsed - this.memoryBaseline) / (1024 * 1024);
    const usagePercent = heapTotalMB > 0 ? (heapUsedMB / heapTotalMB) * 100 : 0;

    let pressure: MemoryPressure["pressure"] = "low";
    if (usagePercent > 90) pressure = "critical";
    else if (usagePercent > 75) pressure = "high";
    else if (usagePercent > 60) pressure = "moderate";

    return {
      heapUsedMB: Math.round(heapUsedMB * 10) / 10,
      heapTotalMB: Math.round(heapTotalMB * 10) / 10,
      rssMB: Math.round(rssMB * 10) / 10,
      externalMB: Math.round(externalMB * 10) / 10,
      usagePercent: Math.round(usagePercent * 10) / 10,
      pressure,
      baselineDeltaMB: Math.round(baselineDeltaMB * 10) / 10,
    };
  }

  resetMemoryBaseline(): void {
    this.memoryBaseline = process.memoryUsage().heapUsed;
  }

  clearSlowQueries(): void {
    this.slowQueries = [];
    this.queryAggregates.clear();
  }
}
