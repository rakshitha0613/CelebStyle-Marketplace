import type { SystemMetrics, RequestMetrics, BusinessMetrics } from "./monitoring.service.js";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertState = "firing" | "resolved" | "acknowledged";

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  cooldownMs: number;
  evaluate: (metrics: EvaluationContext) => boolean;
}

export interface EvaluationContext {
  system: SystemMetrics;
  requests: RequestMetrics;
  business: BusinessMetrics;
}

export interface Alert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  state: AlertState;
  description: string;
  firedAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
}

export interface AlertHistoryEntry extends Alert {
  durationMs?: number;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "high-cpu",
    name: "High CPU Usage",
    description: "CPU usage exceeded 85%",
    severity: "warning",
    cooldownMs: 60_000,
    evaluate: (ctx) => ctx.system.cpu.usagePercent > 85,
  },
  {
    id: "critical-cpu",
    name: "Critical CPU Usage",
    description: "CPU usage exceeded 95%",
    severity: "critical",
    cooldownMs: 30_000,
    evaluate: (ctx) => ctx.system.cpu.usagePercent > 95,
  },
  {
    id: "high-memory",
    name: "High Memory Usage",
    description: "Memory usage exceeded 80%",
    severity: "warning",
    cooldownMs: 60_000,
    evaluate: (ctx) => ctx.system.memory.usagePercent > 80,
  },
  {
    id: "critical-memory",
    name: "Critical Memory Usage",
    description: "Memory usage exceeded 90%",
    severity: "critical",
    cooldownMs: 30_000,
    evaluate: (ctx) => ctx.system.memory.usagePercent > 90,
  },
  {
    id: "high-error-rate",
    name: "High Error Rate",
    description: "Error rate exceeded 5%",
    severity: "critical",
    cooldownMs: 30_000,
    evaluate: (ctx) => ctx.requests.errorRate > 0.05,
  },
  {
    id: "slow-responses",
    name: "Slow API Responses",
    description: "P95 response time exceeded 2000ms",
    severity: "warning",
    cooldownMs: 60_000,
    evaluate: (ctx) => ctx.requests.p95Ms > 2000,
  },
  {
    id: "payment-failures",
    name: "Payment Processing Failures",
    description: "Payment error rate is high",
    severity: "critical",
    cooldownMs: 30_000,
    evaluate: (ctx) => ctx.requests.errorRate > 0.03 && ctx.business.paymentsPerMinute > 0,
  },
  {
    id: "recommendation-slow",
    name: "Slow Recommendation Latency",
    description: "Recommendation latency exceeded 1500ms",
    severity: "warning",
    cooldownMs: 120_000,
    evaluate: (ctx) => ctx.business.recommendationLatencyMs > 1500,
  },
  {
    id: "ar-slow",
    name: "Slow AR Processing",
    description: "AR session duration exceeded 5 minutes (300000ms)",
    severity: "info",
    cooldownMs: 300_000,
    evaluate: (ctx) => ctx.business.arSessionDurationMs > 300_000,
  },
  {
    id: "db-unavailable",
    name: "Database Unavailable",
    description: "DB latency exceeded 5000ms (possible outage)",
    severity: "critical",
    cooldownMs: 15_000,
    evaluate: (ctx) => ctx.business.dbLatencyMs > 5000,
  },
  {
    id: "redis-unavailable",
    name: "Redis Unavailable",
    description: "Redis latency exceeded 2000ms (possible outage)",
    severity: "critical",
    cooldownMs: 15_000,
    evaluate: (ctx) => ctx.business.redisLatencyMs > 2000,
  },
];

export class AlertingService {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private history: AlertHistoryEntry[] = [];
  private lastFired = new Map<string, number>();
  private alertCounter = 0;

  constructor(useDefaultRules = true) {
    if (useDefaultRules) {
      for (const rule of DEFAULT_RULES) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getRules(): AlertRule[] {
    return [...this.rules.values()];
  }

  evaluate(ctx: EvaluationContext): Alert[] {
    const now = Date.now();
    const fired: Alert[] = [];

    for (const rule of this.rules.values()) {
      const isTriggered = rule.evaluate(ctx);
      const existingAlert = this.activeAlerts.get(rule.id);
      const lastFiredAt = this.lastFired.get(rule.id) ?? 0;
      const cooldownElapsed = now - lastFiredAt >= rule.cooldownMs;

      if (isTriggered && !existingAlert && cooldownElapsed) {
        const alert: Alert = {
          alertId: `alert-${++this.alertCounter}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          state: "firing",
          description: rule.description,
          firedAt: now,
        };
        this.activeAlerts.set(rule.id, alert);
        this.lastFired.set(rule.id, now);
        fired.push(alert);
      } else if (!isTriggered && existingAlert && existingAlert.state === "firing") {
        const resolved: AlertHistoryEntry = {
          ...existingAlert,
          state: "resolved",
          resolvedAt: now,
          durationMs: now - existingAlert.firedAt,
        };
        this.history.push(resolved);
        this.activeAlerts.delete(rule.id);
      }
    }

    return fired;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy = "system"): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.alertId === alertId) {
        alert.state = "acknowledged";
        alert.acknowledgedAt = Date.now();
        alert.acknowledgedBy = acknowledgedBy;
        return true;
      }
    }
    return false;
  }

  clearAlert(alertId: string): boolean {
    for (const [ruleId, alert] of this.activeAlerts.entries()) {
      if (alert.alertId === alertId) {
        const entry: AlertHistoryEntry = {
          ...alert,
          state: "resolved",
          resolvedAt: Date.now(),
          durationMs: Date.now() - alert.firedAt,
        };
        this.history.push(entry);
        this.activeAlerts.delete(ruleId);
        return true;
      }
    }
    return false;
  }

  getActiveAlerts(): Alert[] {
    return [...this.activeAlerts.values()];
  }

  getAlertHistory(limit = 100): AlertHistoryEntry[] {
    return this.history.slice(-limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}
