import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { EventEmitter } from "events";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ── PGlite pg-compatible wrappers ─────────────────────────────────────────────

type QueryConfig = {
  text: string;
  values?: unknown[];
  name?: string;
  rowMode?: string;
};

// OID constants matching pg-types builtins
const OID_DATE        = 1082;
const OID_TIMESTAMP   = 1114;
const OID_TIMESTAMPTZ = 1184;
const OID_TIMESTAMP_A = 1115;  // TIMESTAMP[]
const OID_TIMESTAMPTZ_A = 1185; // TIMESTAMPTZ[]
const OID_DATE_A      = 1182;  // DATE[]

/**
 * PGlite returns timestamps as JavaScript Date objects and JSON as plain objects.
 * Prisma's driver-adapter protocol expects timestamps as ISO strings
 * (e.g. "2026-07-11T13:14:32.653+00:00") and JSON decoded.
 */
function convertValue(value: unknown, oid: number): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    const iso = value.toISOString(); // "2026-07-11T13:14:32.653Z"
    if (oid === OID_DATE || oid === OID_DATE_A) {
      return iso.split("T")[0]; // "2026-07-11"
    }
    // TIMESTAMP and TIMESTAMPTZ — strip trailing Z, append +00:00
    return iso.slice(0, -1) + "+00:00";
  }

  // Array of dates (e.g. TIMESTAMP[])
  if (
    Array.isArray(value) &&
    (oid === OID_TIMESTAMP_A || oid === OID_TIMESTAMPTZ_A || oid === OID_DATE_A)
  ) {
    return (value as unknown[]).map((v) => convertValue(v, oid - 1));
  }

  return value;
}

/** Convert PGlite rows: apply type coercions and optionally convert to arrays. */
function adaptRows(
  rows: Record<string, unknown>[],
  fields: { name: string; dataTypeID: number }[],
  rowMode: string | undefined
): unknown[] {
  if (rowMode === "array") {
    return rows.map((row) =>
      fields.map((f) => convertValue(row[f.name], f.dataTypeID))
    );
  }
  return rows.map((row) =>
    Object.fromEntries(
      fields.map((f) => [f.name, convertValue(row[f.name], f.dataTypeID)])
    )
  );
}

/** A fake pg.Client that delegates all queries to PGlite. */
class PGliteClient extends EventEmitter {
  private db: PGlite;

  constructor(db: PGlite) {
    super();
    this.db = db;
  }

  async query(textOrConfig: string | QueryConfig, values?: unknown[]) {
    let sql: string;
    let params: unknown[];
    let rowMode: string | undefined;

    if (typeof textOrConfig === "object") {
      sql = textOrConfig.text;
      params = textOrConfig.values ?? values ?? [];
      rowMode = textOrConfig.rowMode;
    } else {
      sql = textOrConfig;
      params = values ?? [];
    }

    const result = await this.db.query(sql, params as never[]);
    const fields = result.fields as { name: string; dataTypeID: number }[];
    return {
      rows: adaptRows(result.rows as Record<string, unknown>[], fields, rowMode),
      rowCount: result.affectedRows ?? result.rows.length,
      fields,
      command: "",
    };
  }

  // pg.Client compatibility — no-ops for PGlite (no TCP connections)
  release(_err?: Error) {}
}

/** A fake pg.Pool that passes `instanceof pg.Pool` check but uses PGlite. */
class PGlitePool extends pg.Pool {
  private db: PGlite;

  constructor(db: PGlite) {
    // max:0 prevents pg.Pool from opening any real TCP connections
    super({ max: 0, connectionTimeoutMillis: 1 });
    this.db = db;
  }

  async connect() {
    return new PGliteClient(this.db) as unknown as pg.PoolClient;
  }

  async query(textOrConfig: string | QueryConfig, values?: unknown[]) {
    let sql: string;
    let params: unknown[];
    let rowMode: string | undefined;

    if (typeof textOrConfig === "object" && (textOrConfig as QueryConfig).text) {
      sql = (textOrConfig as QueryConfig).text;
      params = (textOrConfig as QueryConfig).values ?? values ?? [];
      rowMode = (textOrConfig as QueryConfig).rowMode;
    } else {
      sql = textOrConfig as string;
      params = values ?? [];
    }

    const result = await this.db.query(sql, params as never[]);
    const fields = result.fields as { name: string; dataTypeID: number }[];
    return {
      rows: adaptRows(result.rows as Record<string, unknown>[], fields, rowMode),
      rowCount: result.affectedRows ?? result.rows.length,
      fields,
      command: "",
    } as unknown as pg.QueryResult;
  }

  end() {
    return Promise.resolve();
  }
}

// ── Migration runner ──────────────────────────────────────────────────────────

const DATA_DIR  = path.resolve(process.cwd(), ".pglite-data");
const MIGS_DIR  = path.resolve(process.cwd(), "prisma/migrations");

const isFirstRun = !existsSync(DATA_DIR);

const pglite = await PGlite.create({ dataDir: DATA_DIR });

if (isFirstRun) {
  const entries = await readdir(MIGS_DIR, { withFileTypes: true });
  const migDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const dir of migDirs) {
    const sqlPath = path.join(MIGS_DIR, dir, "migration.sql");
    if (!existsSync(sqlPath)) continue;

    const sql = await readFile(sqlPath, "utf-8");
    const needsVector =
      sql.includes("vector(1536)") ||
      sql.includes("EXTENSION IF NOT EXISTS vector") ||
      sql.includes("hnsw");

    if (needsVector) {
      // Run the non-vector parts of this migration only
      const lines = sql.split("\n");
      let inVectorBlock = false;
      const safe: string[] = [];
      for (const line of lines) {
        if (
          line.includes("CREATE EXTENSION") ||
          line.includes("vector(1536)") ||
          line.includes("hnsw") ||
          line.includes("vector_cosine_ops")
        ) {
          inVectorBlock = true;
        }
        if (!inVectorBlock) {
          safe.push(line);
        }
        // Reset block at statement end
        if (inVectorBlock && line.trim().endsWith(";")) {
          inVectorBlock = false;
        }
      }
      const safeSql = safe.join("\n").trim();
      if (safeSql) {
        try {
          await pglite.exec(safeSql);
        } catch (e) {
          // Partial errors are acceptable (e.g. IF NOT EXISTS guards)
        }
      }
      continue;
    }

    try {
      await pglite.exec(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      console.warn(`[db] migration ${dir}: skipped (${msg})`);
    }
  }

  console.log("[db] PGlite schema initialised from migrations");
}

// ── Prisma client ─────────────────────────────────────────────────────────────

const pool    = new PGlitePool(pglite) as unknown as pg.Pool;
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
