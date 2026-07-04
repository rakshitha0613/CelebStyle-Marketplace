import { createHash } from "node:crypto";

export type BackupType = "full" | "incremental" | "differential" | "wal";
export type BackupStatus = "completed" | "failed" | "in-progress" | "pending" | "verified";

export interface BackupRecord {
  id: string;
  type: BackupType;
  status: BackupStatus;
  startedAt: number;
  completedAt?: number;
  sizeBytes?: number;
  checksum?: string;
  location?: string;
  retentionUntil?: number;
  verifiedAt?: number;
  errorMessage?: string;
}

export interface BackupPolicy {
  fullBackupIntervalMs: number;
  incrementalIntervalMs: number;
  retentionMs: number;
  minBackupsToKeep: number;
  encryptionRequired: boolean;
  checksumRequired: boolean;
  offSiteRequired: boolean;
}

export interface BackupValidationResult {
  backupId: string;
  valid: boolean;
  checksumMatch: boolean;
  withinRetention: boolean;
  readable: boolean;
  issues: string[];
}

export interface BackupComplianceReport {
  generatedAt: number;
  policy: BackupPolicy;
  lastFullBackup: BackupRecord | null;
  lastIncrementalBackup: BackupRecord | null;
  totalBackups: number;
  failedBackups: number;
  rpoCompliant: boolean;
  retentionCompliant: boolean;
  issues: string[];
  rpoHours: number;
  actualRpoHours: number;
}

const DEFAULT_POLICY: BackupPolicy = {
  fullBackupIntervalMs: 24 * 60 * 60 * 1000,       // 24h
  incrementalIntervalMs: 60 * 60 * 1000,             // 1h
  retentionMs: 30 * 24 * 60 * 60 * 1000,            // 30 days
  minBackupsToKeep: 7,
  encryptionRequired: true,
  checksumRequired: true,
  offSiteRequired: true,
};

function generateChecksum(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

let backupCounter = 0;

export class BackupValidationService {
  private backups: BackupRecord[] = [];
  private policy: BackupPolicy = { ...DEFAULT_POLICY };

  configurePolicy(policy: Partial<BackupPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  getPolicy(): BackupPolicy {
    return { ...this.policy };
  }

  recordBackup(backup: Omit<BackupRecord, "id">): BackupRecord {
    const record: BackupRecord = {
      id: `backup-${++backupCounter}-${Date.now()}`,
      ...backup,
    };
    this.backups.push(record);
    return record;
  }

  simulateFullBackup(sizeBytes = 5 * 1024 * 1024 * 1024): BackupRecord {
    const now = Date.now();
    const data = `full-backup-${now}-${sizeBytes}`;
    const record = this.recordBackup({
      type: "full",
      status: "completed",
      startedAt: now - 3600_000,
      completedAt: now,
      sizeBytes,
      checksum: generateChecksum(data),
      location: "s3://celebstyle-backups/full/",
      retentionUntil: now + this.policy.retentionMs,
      verifiedAt: now,
    });
    return record;
  }

  simulateIncrementalBackup(sizeBytes = 100 * 1024 * 1024): BackupRecord {
    const now = Date.now();
    const data = `incremental-backup-${now}-${sizeBytes}`;
    return this.recordBackup({
      type: "incremental",
      status: "completed",
      startedAt: now - 600_000,
      completedAt: now,
      sizeBytes,
      checksum: generateChecksum(data),
      location: "s3://celebstyle-backups/incremental/",
      retentionUntil: now + this.policy.retentionMs,
      verifiedAt: now,
    });
  }

  recordFailedBackup(type: BackupType, errorMessage: string): BackupRecord {
    return this.recordBackup({
      type,
      status: "failed",
      startedAt: Date.now() - 60_000,
      errorMessage,
    });
  }

  validateBackup(backupId: string): BackupValidationResult {
    const backup = this.backups.find((b) => b.id === backupId);
    const issues: string[] = [];

    if (!backup) {
      return { backupId, valid: false, checksumMatch: false, withinRetention: false, readable: false, issues: ["Backup record not found."] };
    }

    const now = Date.now();
    const withinRetention = backup.retentionUntil !== undefined && backup.retentionUntil > now;
    if (!withinRetention) issues.push("Backup is outside retention period.");

    const checksumMatch = backup.checksum !== undefined && backup.checksum.length === 64;
    if (!checksumMatch) issues.push("Backup checksum missing or malformed.");

    if (backup.status === "failed") issues.push(`Backup failed: ${backup.errorMessage ?? "unknown error"}`);

    const readable = backup.status === "completed" || backup.status === "verified";
    if (!readable) issues.push("Backup is not in a readable/completed state.");

    if (this.policy.encryptionRequired && !backup.location?.includes("s3://")) {
      issues.push("Backup location does not indicate encrypted off-site storage.");
    }

    return {
      backupId,
      valid: issues.length === 0,
      checksumMatch,
      withinRetention,
      readable,
      issues,
    };
  }

  getBackups(filter?: { type?: BackupType; status?: BackupStatus }): BackupRecord[] {
    let records = [...this.backups];
    if (filter?.type) records = records.filter((b) => b.type === filter.type);
    if (filter?.status) records = records.filter((b) => b.status === filter.status);
    return records.sort((a, b) => b.startedAt - a.startedAt);
  }

  getLastBackup(type: BackupType): BackupRecord | null {
    const records = this.getBackups({ type, status: "completed" });
    return records[0] ?? null;
  }

  generateComplianceReport(): BackupComplianceReport {
    const now = Date.now();
    const policy = this.policy;
    const issues: string[] = [];

    const lastFull = this.getLastBackup("full");
    const lastIncremental = this.getLastBackup("incremental");

    const rpoHours = policy.fullBackupIntervalMs / 3_600_000;
    let actualRpoHours = Infinity;

    if (!lastFull) {
      issues.push("No successful full backup found.");
    } else {
      const age = now - (lastFull.completedAt ?? lastFull.startedAt);
      actualRpoHours = age / 3_600_000;
      if (age > policy.fullBackupIntervalMs) {
        issues.push(`Last full backup is ${Math.round(actualRpoHours)}h old — exceeds RPO of ${rpoHours}h.`);
      }
    }

    if (lastIncremental) {
      const incrAge = now - (lastIncremental.completedAt ?? lastIncremental.startedAt);
      const incrAgeHours = incrAge / 3_600_000;
      actualRpoHours = Math.min(actualRpoHours, incrAgeHours);
    }

    const failedCount = this.backups.filter((b) => b.status === "failed").length;
    if (failedCount > 0) issues.push(`${failedCount} backup(s) have failed status.`);

    const completedCount = this.backups.filter((b) => b.status === "completed" || b.status === "verified").length;
    if (completedCount < policy.minBackupsToKeep) {
      issues.push(`Only ${completedCount} completed backups — minimum is ${policy.minBackupsToKeep}.`);
    }

    // Check retention compliance
    const expired = this.backups.filter((b) => b.retentionUntil !== undefined && b.retentionUntil <= now);
    const retentionCompliant = expired.length === 0;
    if (!retentionCompliant) issues.push(`${expired.length} backup(s) have expired retention.`);

    const rpoCompliant = actualRpoHours <= rpoHours;

    return {
      generatedAt: now,
      policy,
      lastFullBackup: lastFull,
      lastIncrementalBackup: lastIncremental,
      totalBackups: this.backups.length,
      failedBackups: failedCount,
      rpoCompliant,
      retentionCompliant,
      issues,
      rpoHours,
      actualRpoHours: actualRpoHours === Infinity ? -1 : Math.round(actualRpoHours * 10) / 10,
    };
  }

  clearBackups(): void {
    this.backups = [];
  }
}
