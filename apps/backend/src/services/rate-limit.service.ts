export interface RateLimitRule {
  id: string;
  route: string;
  method: string | "*";
  maxRequests: number;
  windowMs: number;
  description: string;
  enabled: boolean;
}

export interface RateLimitHit {
  ip: string;
  route: string;
  timestamp: number;
  blocked: boolean;
}

export interface IpCounterEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
}

export interface RateLimitStats {
  rule: RateLimitRule;
  totalHits: number;
  blockedHits: number;
  uniqueIps: number;
  blockRate: number;
}

export interface AdaptiveThrottleConfig {
  enabled: boolean;
  cpuThreshold: number;
  memoryThreshold: number;
  throttleMultiplier: number;
}

const DEFAULT_RULES: RateLimitRule[] = [
  {
    id: "global",
    route: "*",
    method: "*",
    maxRequests: process.env.NODE_ENV === "production" ? 300 : 1000,
    windowMs: 15 * 60 * 1000,
    description: "Global rate limit per IP",
    enabled: true,
  },
  {
    id: "auth",
    route: "/api/auth/*",
    method: "*",
    maxRequests: process.env.NODE_ENV === "production" ? 20 : 200,
    windowMs: 15 * 60 * 1000,
    description: "Auth endpoint rate limit — brute force protection",
    enabled: true,
  },
  {
    id: "api",
    route: "/api/*",
    method: "*",
    maxRequests: process.env.NODE_ENV === "production" ? 120 : 1000,
    windowMs: 60 * 1000,
    description: "General API rate limit per IP per minute",
    enabled: true,
  },
  {
    id: "checkout",
    route: "/api/checkout",
    method: "POST",
    maxRequests: process.env.NODE_ENV === "production" ? 5 : 50,
    windowMs: 60 * 1000,
    description: "Checkout rate limit — prevent order flooding",
    enabled: true,
  },
  {
    id: "recommendations",
    route: "/api/recommendations/*",
    method: "GET",
    maxRequests: process.env.NODE_ENV === "production" ? 30 : 300,
    windowMs: 60 * 1000,
    description: "Recommendation endpoint — ML inference rate limit",
    enabled: true,
  },
];

export class RateLimitService {
  private rules = new Map<string, RateLimitRule>();
  private hits: RateLimitHit[] = [];
  private ipCounters = new Map<string, Map<string, IpCounterEntry>>();
  private allowlist = new Set<string>();
  private denylist = new Set<string>();
  private adaptiveConfig: AdaptiveThrottleConfig = {
    enabled: false,
    cpuThreshold: 80,
    memoryThreshold: 85,
    throttleMultiplier: 0.5,
  };

  constructor(useDefaults = true) {
    if (useDefaults) {
      for (const rule of DEFAULT_RULES) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): RateLimitRule | undefined {
    return this.rules.get(ruleId);
  }

  getRules(): RateLimitRule[] {
    return [...this.rules.values()];
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = true;
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = false;
  }

  addToAllowlist(ip: string): void {
    this.allowlist.add(ip);
    this.denylist.delete(ip);
  }

  removeFromAllowlist(ip: string): void {
    this.allowlist.delete(ip);
  }

  addToDenylist(ip: string): void {
    this.denylist.add(ip);
    this.allowlist.delete(ip);
  }

  removeFromDenylist(ip: string): void {
    this.denylist.delete(ip);
  }

  isAllowlisted(ip: string): boolean {
    return this.allowlist.has(ip);
  }

  isDenylisted(ip: string): boolean {
    return this.denylist.has(ip);
  }

  getAllowlist(): string[] {
    return [...this.allowlist];
  }

  getDenylist(): string[] {
    return [...this.denylist];
  }

  configureAdaptiveThrottling(config: Partial<AdaptiveThrottleConfig>): void {
    this.adaptiveConfig = { ...this.adaptiveConfig, ...config };
  }

  getAdaptiveConfig(): AdaptiveThrottleConfig {
    return { ...this.adaptiveConfig };
  }

  getEffectiveLimit(ruleId: string, cpuPercent = 0, memPercent = 0): number {
    const rule = this.rules.get(ruleId);
    if (!rule) return 0;
    if (!this.adaptiveConfig.enabled) return rule.maxRequests;

    const cpuHighLoad = cpuPercent > this.adaptiveConfig.cpuThreshold;
    const memHighLoad = memPercent > this.adaptiveConfig.memoryThreshold;

    if (cpuHighLoad || memHighLoad) {
      return Math.ceil(rule.maxRequests * this.adaptiveConfig.throttleMultiplier);
    }
    return rule.maxRequests;
  }

  checkLimit(ip: string, ruleId: string): { allowed: boolean; remaining: number; resetAt: number } {
    if (this.denylist.has(ip)) return { allowed: false, remaining: 0, resetAt: Date.now() + 3600_000 };
    if (this.allowlist.has(ip)) return { allowed: true, remaining: 999_999, resetAt: Date.now() + 60_000 };

    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return { allowed: true, remaining: 999_999, resetAt: Date.now() + 60_000 };

    const now = Date.now();
    let ruleCounters = this.ipCounters.get(ruleId);
    if (!ruleCounters) {
      ruleCounters = new Map();
      this.ipCounters.set(ruleId, ruleCounters);
    }

    let entry = ruleCounters.get(ip);
    if (!entry || now - entry.windowStart >= rule.windowMs) {
      entry = { count: 0, windowStart: now, blocked: false };
    }

    entry.count++;
    const allowed = entry.count <= rule.maxRequests;
    entry.blocked = !allowed;
    ruleCounters.set(ip, entry);

    this.hits.push({ ip, route: rule.route, timestamp: now, blocked: !allowed });
    if (this.hits.length > 10_000) this.hits.shift();

    return {
      allowed,
      remaining: Math.max(0, rule.maxRequests - entry.count),
      resetAt: entry.windowStart + rule.windowMs,
    };
  }

  getStats(ruleId: string): RateLimitStats | null {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const ruleHits = this.hits.filter((h) => h.route === rule.route);
    const blocked = ruleHits.filter((h) => h.blocked).length;
    const uniqueIps = new Set(ruleHits.map((h) => h.ip)).size;
    const blockRate = ruleHits.length > 0 ? Math.round((blocked / ruleHits.length) * 1000) / 1000 : 0;

    return { rule: { ...rule }, totalHits: ruleHits.length, blockedHits: blocked, uniqueIps, blockRate };
  }

  getAllStats(): RateLimitStats[] {
    return [...this.rules.keys()].map((id) => this.getStats(id)).filter((s): s is RateLimitStats => s !== null);
  }

  clearHits(): void {
    this.hits = [];
    this.ipCounters.clear();
  }
}
