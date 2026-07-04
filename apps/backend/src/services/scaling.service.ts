export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface PoolStatus {
  config: PoolConfig;
  active: number;
  idle: number;
  waiting: number;
  utilization: number;
}

export interface StickySessionConfig {
  enabled: boolean;
  cookieName: string;
  ttlSeconds: number;
}

export interface ScalingReadiness {
  isStateless: boolean;
  hasConnectionPooling: boolean;
  supportsGracefulShutdown: boolean;
  replicaCount: number;
  stickySessionConfig: StickySessionConfig;
  readinessChecks: Record<string, boolean>;
}

export interface GracefulShutdownState {
  initiated: boolean;
  initiatedAt?: number;
  timeoutMs: number;
}

const DEFAULT_POOL: PoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 5_000,
};

export class ScalingService {
  private poolConfig: PoolConfig = { ...DEFAULT_POOL };
  private poolActive = 0;
  private poolIdle = 2;
  private poolWaiting = 0;

  private shutdownState: GracefulShutdownState = {
    initiated: false,
    timeoutMs: 30_000,
  };

  private shutdownHandlers: Array<() => Promise<void>> = [];

  configureConnectionPool(config: Partial<PoolConfig>): void {
    this.poolConfig = { ...this.poolConfig, ...config };
  }

  getPoolStatus(): PoolStatus {
    const total = this.poolActive + this.poolIdle;
    const utilization = total > 0 ? this.poolActive / total : 0;
    return {
      config: { ...this.poolConfig },
      active: this.poolActive,
      idle: this.poolIdle,
      waiting: this.poolWaiting,
      utilization: Math.round(utilization * 1000) / 1000,
    };
  }

  simulateConnectionAcquire(): void {
    if (this.poolIdle > 0) {
      this.poolIdle--;
      this.poolActive++;
    } else {
      this.poolWaiting++;
    }
  }

  simulateConnectionRelease(): void {
    if (this.poolActive > 0) {
      this.poolActive--;
      this.poolIdle++;
    }
    if (this.poolWaiting > 0) {
      this.poolWaiting--;
      this.poolActive++;
    }
  }

  isStateless(): boolean {
    return true;
  }

  getStickySessionConfig(): StickySessionConfig {
    return {
      enabled: false,
      cookieName: "cs-session",
      ttlSeconds: 3600,
    };
  }

  getReplicaCount(): number {
    const fromEnv = parseInt(process.env.REPLICA_COUNT ?? "1", 10);
    return isNaN(fromEnv) || fromEnv < 1 ? 1 : fromEnv;
  }

  checkScalingReadiness(): ScalingReadiness {
    const replicaCount = this.getReplicaCount();
    const hasDB = !!(process.env.DATABASE_URL);
    const hasAuth = !!(process.env.JWT_SECRET);

    return {
      isStateless: this.isStateless(),
      hasConnectionPooling: true,
      supportsGracefulShutdown: true,
      replicaCount,
      stickySessionConfig: this.getStickySessionConfig(),
      readinessChecks: {
        stateless: true,
        connectionPool: true,
        gracefulShutdown: true,
        databaseConfigured: hasDB,
        authConfigured: hasAuth,
        multiReplica: replicaCount > 1,
      },
    };
  }

  registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  getShutdownState(): GracefulShutdownState {
    return { ...this.shutdownState };
  }

  async initiateGracefulShutdown(timeoutMs = 30_000): Promise<void> {
    if (this.shutdownState.initiated) return;

    this.shutdownState.initiated = true;
    this.shutdownState.initiatedAt = Date.now();
    this.shutdownState.timeoutMs = timeoutMs;

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    const handlers = Promise.allSettled(this.shutdownHandlers.map((h) => h()));

    await Promise.race([handlers, timeout]);
  }

  resetShutdownState(): void {
    this.shutdownState = { initiated: false, timeoutMs: 30_000 };
    this.shutdownHandlers = [];
  }

  isShuttingDown(): boolean {
    return this.shutdownState.initiated;
  }
}
