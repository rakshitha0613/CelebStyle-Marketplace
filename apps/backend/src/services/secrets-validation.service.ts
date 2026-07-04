import { createHash } from "node:crypto";

export type SecretStatus = "valid" | "invalid" | "missing" | "weak" | "expiring";

export interface SecretValidationResult {
  name: string;
  status: SecretStatus;
  message: string;
  entropy?: number;
  lengthOk?: boolean;
  rotationDue?: boolean;
  hint?: string;
}

export interface EnvValidationResult {
  required: string[];
  missing: string[];
  present: string[];
  optional: string[];
  allRequiredPresent: boolean;
}

export interface SecretsReport {
  generatedAt: number;
  secrets: SecretValidationResult[];
  envValidation: EnvValidationResult;
  overallStatus: "healthy" | "degraded" | "critical";
  criticalCount: number;
  warningCount: number;
}

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
];

const OPTIONAL_ENV_VARS = [
  "LOG_LEVEL",
  "ALLOWED_ORIGINS",
  "TRUST_PROXY",
  "REPLICA_COUNT",
  "PAYMENT_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "FRONTEND_URL",
];

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 100) / 100;
}

function hasAdequateComplexity(secret: string): boolean {
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasDigit = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
  return [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length >= 3;
}

function isCommonWeak(secret: string): boolean {
  const lower = secret.toLowerCase();
  const weakPatterns = [
    "password", "secret", "changeme", "default", "admin", "test",
    "12345", "qwerty", "letmein", "welcome", "abc123",
  ];
  return weakPatterns.some((p) => lower.includes(p));
}

export class SecretsValidationService {
  private lastReport: SecretsReport | null = null;
  private knownSecretLastRotation = new Map<string, number>();

  recordSecretRotation(secretName: string): void {
    this.knownSecretLastRotation.set(secretName, Date.now());
  }

  getLastRotation(secretName: string): number | null {
    return this.knownSecretLastRotation.get(secretName) ?? null;
  }

  validateJwtSecret(secret: string | undefined): SecretValidationResult {
    const name = "JWT_SECRET";

    if (!secret) {
      return { name, status: "missing", message: "JWT_SECRET is not set.", hint: "Set JWT_SECRET to a 48+ char random string." };
    }

    const length = secret.length;
    const entropy = shannonEntropy(secret);
    const lengthOk = length >= 32;
    const entropyOk = entropy >= 3.5;
    const complexityOk = hasAdequateComplexity(secret);
    const notWeak = !isCommonWeak(secret);

    if (!lengthOk) {
      return { name, status: "invalid", message: `JWT_SECRET is only ${length} chars — minimum 32 required.`, entropy, lengthOk, hint: "Generate: openssl rand -base64 48" };
    }
    if (!entropyOk || !complexityOk || !notWeak) {
      return { name, status: "weak", message: "JWT_SECRET has low entropy or contains weak patterns.", entropy, lengthOk, hint: "Replace with a cryptographically random string." };
    }
    return { name, status: "valid", message: `JWT_SECRET is valid (${length} chars, entropy=${entropy}).`, entropy, lengthOk };
  }

  validateDatabaseUrl(url: string | undefined): SecretValidationResult {
    const name = "DATABASE_URL";

    if (!url) {
      return { name, status: "missing", message: "DATABASE_URL is not set.", hint: "Set to a valid postgresql:// connection string." };
    }

    const hasScheme = url.startsWith("postgresql://") || url.startsWith("postgres://");
    if (!hasScheme) {
      return { name, status: "invalid", message: "DATABASE_URL does not start with postgresql:// or postgres://.", hint: "Use a valid PostgreSQL connection string." };
    }

    const localhostInProd = url.includes("localhost") && process.env.NODE_ENV === "production";
    if (localhostInProd) {
      return { name, status: "weak", message: "DATABASE_URL points to localhost in production.", hint: "Use a managed PostgreSQL service." };
    }

    const hasPgBouncer = url.includes("pgbouncer=true");
    const message = hasPgBouncer
      ? "DATABASE_URL is valid and uses PgBouncer connection pooling."
      : "DATABASE_URL is valid. Consider adding pgbouncer=true for connection pooling.";

    return { name, status: "valid", message };
  }

  validateSecret(name: string, value: string | undefined, minLength = 32): SecretValidationResult {
    if (!value) return { name, status: "missing", message: `${name} is not set.` };
    if (value.length < minLength) return { name, status: "invalid", message: `${name} is too short (${value.length} < ${minLength} chars).`, lengthOk: false };
    if (isCommonWeak(value)) return { name, status: "weak", message: `${name} contains common weak patterns.`, entropy: shannonEntropy(value), lengthOk: true };
    return { name, status: "valid", message: `${name} is valid.`, entropy: shannonEntropy(value), lengthOk: true };
  }

  validateEnvVars(): EnvValidationResult {
    const missing: string[] = [];
    const present: string[] = [];
    for (const v of REQUIRED_ENV_VARS) {
      if (process.env[v] !== undefined) present.push(v);
      else missing.push(v);
    }
    return {
      required: REQUIRED_ENV_VARS,
      missing,
      present,
      optional: OPTIONAL_ENV_VARS.filter((v) => process.env[v] !== undefined),
      allRequiredPresent: missing.length === 0,
    };
  }

  runReport(): SecretsReport {
    const secrets: SecretValidationResult[] = [
      this.validateJwtSecret(process.env.JWT_SECRET),
      this.validateDatabaseUrl(process.env.DATABASE_URL),
    ];

    const envValidation = this.validateEnvVars();
    const criticalCount = secrets.filter((s) => s.status === "missing" || s.status === "invalid").length + envValidation.missing.length;
    const warningCount = secrets.filter((s) => s.status === "weak" || s.status === "expiring").length;

    let overallStatus: SecretsReport["overallStatus"] = "healthy";
    if (criticalCount > 0) overallStatus = "critical";
    else if (warningCount > 0) overallStatus = "degraded";

    const report: SecretsReport = {
      generatedAt: Date.now(),
      secrets,
      envValidation,
      overallStatus,
      criticalCount,
      warningCount,
    };

    this.lastReport = report;
    return report;
  }

  getLastReport(): SecretsReport | null {
    return this.lastReport;
  }
}
