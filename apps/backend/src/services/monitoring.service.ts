import { cpus, freemem, totalmem } from "node:os";
import { statfs } from "node:fs/promises";

export interface SystemMetrics {
  cpu: { usagePercent: number; coreCount: number; loadAvg: number[] };
  memory: { usedMB: number; totalMB: number; usagePercent: number };
  disk: { usedGB: number; totalGB: number; usagePercent: number };
  timestamp: number;
}

export interface RequestMetrics {
  requestsPerMinute: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  activeConnections: number;
}

export interface BusinessMetrics {
  activeUsers: number;
  ordersPerMinute: number;
  paymentsPerMinute: number;
  recommendationLatencyMs: number;
  arSessionDurationMs: number;
  dbLatencyMs: number;
  redisLatencyMs: number;
  queueLatencyMs: number;
}

export interface MetricsSummary {
  system: SystemMetrics;
  requests: RequestMetrics;
  business: BusinessMetrics;
}

interface DurationSample {
  durationMs: number;
  statusCode: number;
  timestamp: number;
}

interface BusinessCounter {
  value: number;
  windowStart: number;
}

const MAX_SAMPLES = 2000;
const ONE_MINUTE_MS = 60_000;

export class MonitoringService {
  private samples: DurationSample[] = [];
  private activeConnections = 0;

  private prevCpuUsage = process.cpuUsage();
  private prevCpuTime = Date.now();

  private businessCounters = {
    orders: [] as number[],
    payments: [] as number[],
    activeUsers: new Set<string>(),
    recommendationLatencies: [] as number[],
    arSessionDurations: [] as number[],
    dbLatencies: [] as number[],
    redisLatencies: [] as number[],
    queueLatencies: [] as number[],
  };

  recordRequest(durationMs: number, statusCode: number): void {
    this.samples.push({ durationMs, statusCode, timestamp: Date.now() });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  incrementConnections(): void { this.activeConnections++; }
  decrementConnections(): void { if (this.activeConnections > 0) this.activeConnections--; }

  recordActiveUser(userId: string): void {
    this.businessCounters.activeUsers.add(userId);
  }

  recordOrder(timestampMs = Date.now()): void {
    this.businessCounters.orders.push(timestampMs);
  }

  recordPayment(timestampMs = Date.now()): void {
    this.businessCounters.payments.push(timestampMs);
  }

  recordRecommendationLatency(ms: number): void {
    this.businessCounters.recommendationLatencies.push(ms);
    if (this.businessCounters.recommendationLatencies.length > 500) {
      this.businessCounters.recommendationLatencies.shift();
    }
  }

  recordArSessionDuration(ms: number): void {
    this.businessCounters.arSessionDurations.push(ms);
    if (this.businessCounters.arSessionDurations.length > 200) {
      this.businessCounters.arSessionDurations.shift();
    }
  }

  recordDbLatency(ms: number): void {
    this.businessCounters.dbLatencies.push(ms);
    if (this.businessCounters.dbLatencies.length > 500) this.businessCounters.dbLatencies.shift();
  }

  recordRedisLatency(ms: number): void {
    this.businessCounters.redisLatencies.push(ms);
    if (this.businessCounters.redisLatencies.length > 500) this.businessCounters.redisLatencies.shift();
  }

  recordQueueLatency(ms: number): void {
    this.businessCounters.queueLatencies.push(ms);
    if (this.businessCounters.queueLatencies.length > 500) this.businessCounters.queueLatencies.shift();
  }

  collectSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const elapsedMs = now - this.prevCpuTime;
    const current = process.cpuUsage(this.prevCpuUsage);
    const totalMicros = elapsedMs * 1000;
    const cpuUsedMicros = current.user + current.system;
    const coreCount = cpus().length;
    const usagePercent = totalMicros > 0 && coreCount > 0
      ? Math.min(100, Math.max(0, (cpuUsedMicros / (totalMicros * coreCount)) * 100))
      : 0;

    this.prevCpuUsage = process.cpuUsage();
    this.prevCpuTime = now;

    const totalMemBytes = totalmem();
    const freeMemBytes = freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const totalMB = totalMemBytes / (1024 * 1024);
    const usedMB = usedMemBytes / (1024 * 1024);

    return {
      cpu: {
        usagePercent: Math.round(usagePercent * 10) / 10,
        coreCount,
        loadAvg: [0, 0, 0],
      },
      memory: {
        usedMB: Math.round(usedMB),
        totalMB: Math.round(totalMB),
        usagePercent: Math.round((usedMB / totalMB) * 100 * 10) / 10,
      },
      disk: this.diskFallback,
      timestamp: now,
    };
  }

  async collectSystemMetricsWithDisk(): Promise<SystemMetrics> {
    const metrics = this.collectSystemMetrics();
    metrics.disk = await this.getDiskMetrics();
    return metrics;
  }

  private diskFallback = { usedGB: 0, totalGB: 0, usagePercent: 0 };

  private async getDiskMetrics(): Promise<{ usedGB: number; totalGB: number; usagePercent: number }> {
    try {
      const stats = await statfs(process.cwd());
      const bsize = stats.bsize;
      const totalGB = (stats.blocks * bsize) / 1e9;
      const freeGB = (stats.bavail * bsize) / 1e9;
      const usedGB = totalGB - freeGB;
      const usagePercent = totalGB > 0 ? Math.round((usedGB / totalGB) * 100 * 10) / 10 : 0;
      return {
        usedGB: Math.round(usedGB * 10) / 10,
        totalGB: Math.round(totalGB * 10) / 10,
        usagePercent,
      };
    } catch {
      return this.diskFallback;
    }
  }

  collectRequestMetrics(): RequestMetrics {
    const now = Date.now();
    const windowStart = now - ONE_MINUTE_MS;
    const recent = this.samples.filter((s) => s.timestamp >= windowStart);
    const durations = recent.map((s) => s.durationMs).sort((a, b) => a - b);

    const errors = recent.filter((s) => s.statusCode >= 500);
    const errorRate = recent.length > 0 ? errors.length / recent.length : 0;

    return {
      requestsPerMinute: recent.length,
      p50Ms: this.percentile(durations, 50),
      p95Ms: this.percentile(durations, 95),
      p99Ms: this.percentile(durations, 99),
      errorRate: Math.round(errorRate * 1000) / 1000,
      activeConnections: this.activeConnections,
    };
  }

  collectBusinessMetrics(): BusinessMetrics {
    const now = Date.now();
    const windowStart = now - ONE_MINUTE_MS;

    const recentOrders = this.businessCounters.orders.filter((t) => t >= windowStart);
    const recentPayments = this.businessCounters.payments.filter((t) => t >= windowStart);

    // Trim old events
    this.businessCounters.orders = this.businessCounters.orders.filter((t) => t >= windowStart);
    this.businessCounters.payments = this.businessCounters.payments.filter((t) => t >= windowStart);

    const recLats = this.businessCounters.recommendationLatencies;
    const arDurations = this.businessCounters.arSessionDurations;
    const dbLats = this.businessCounters.dbLatencies;
    const redisLats = this.businessCounters.redisLatencies;
    const queueLats = this.businessCounters.queueLatencies;

    return {
      activeUsers: this.businessCounters.activeUsers.size,
      ordersPerMinute: recentOrders.length,
      paymentsPerMinute: recentPayments.length,
      recommendationLatencyMs: recLats.length > 0 ? this.avg(recLats) : 0,
      arSessionDurationMs: arDurations.length > 0 ? this.avg(arDurations) : 0,
      dbLatencyMs: dbLats.length > 0 ? this.avg(dbLats) : 0,
      redisLatencyMs: redisLats.length > 0 ? this.avg(redisLats) : 0,
      queueLatencyMs: queueLats.length > 0 ? this.avg(queueLats) : 0,
    };
  }

  getMetricsSummary(): MetricsSummary {
    return {
      system: this.collectSystemMetrics(),
      requests: this.collectRequestMetrics(),
      business: this.collectBusinessMetrics(),
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  private avg(arr: number[]): number {
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  }
}
