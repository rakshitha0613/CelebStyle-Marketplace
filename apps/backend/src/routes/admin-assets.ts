import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { existsSync, statSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve, normalize } from "path";
import { pathToFileURL } from "url";
import { authenticate } from "../auth/middleware/authenticate.js";
import { authorize } from "../auth/middleware/authorize.js";

const execFileAsync = promisify(execFile);

// This route lives at apps/backend/src/routes/, the asset pipeline at
// <repo root>/scripts/ — three levels up from the compiled/dev cwd
// (apps/backend), since routes always run with cwd === apps/backend.
const ROOT_DIR = resolve(process.cwd(), "..", "..");
const SCRIPTS_DIR = join(ROOT_DIR, "scripts");
const MANIFEST_PATH = join(SCRIPTS_DIR, "asset-manifest.json");
const ASSET_MANAGER_CLI = join(SCRIPTS_DIR, "asset-manager.mjs");
const PUBLIC_DIR = join(ROOT_DIR, "apps", "frontend", "public");

function moduleUrl(relPath: string): string {
  return pathToFileURL(join(SCRIPTS_DIR, "asset-manager", relPath)).href;
}

type ManifestSlot = {
  prompt: string | null;
  backend: "pollinations" | "replicate" | "manual-upload" | null;
  model: string | null;
  seed: number | null;
  generatedAt: string | null;
  width: number | null;
  height: number | null;
  status: "generated" | "failed" | "never-attempted" | "broken";
  needsPaidUpgrade: boolean;
  qualityFlag: string | null;
  lastVerified: string | null;
  error: string | null;
  attempts: number;
  promptHash: string | null;
};

function loadManifestRaw(): { version: number; slots: Record<string, ManifestSlot> } {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, slots: {} };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { version: 1, slots: {} };
  }
}

async function loadAllSlotPaths(): Promise<Array<{ path: string; kind: string; tier: string }>> {
  const mod = await import(moduleUrl("slots.mjs"));
  return mod.buildAllSlots().map((s: { path: string; kind: string; tier: string }) => ({
    path: s.path,
    kind: s.kind,
    tier: s.tier,
  }));
}

type AssetListItem = ManifestSlot & {
  path: string;
  kind: string | null;
  tier: string | null;
  existsOnDisk: boolean;
  fileSizeBytes: number | null;
};

function defaultManifestSlot(): ManifestSlot {
  return {
    prompt: null,
    backend: null,
    model: null,
    seed: null,
    generatedAt: null,
    width: null,
    height: null,
    status: "never-attempted",
    needsPaidUpgrade: false,
    qualityFlag: null,
    lastVerified: null,
    error: null,
    attempts: 0,
    promptHash: null,
  };
}

function diskInfo(relPath: string): { existsOnDisk: boolean; fileSizeBytes: number | null } {
  const abs = join(PUBLIC_DIR, ...relPath.split("/"));
  if (!existsSync(abs)) return { existsOnDisk: false, fileSizeBytes: null };
  const stats = statSync(abs);
  return { existsOnDisk: stats.size > 0, fileSizeBytes: stats.size };
}

async function buildAssetList(): Promise<AssetListItem[]> {
  const manifest = loadManifestRaw();
  const allSlots = await loadAllSlotPaths();
  const slotMeta = new Map(allSlots.map((s) => [s.path, s]));

  const paths = new Set<string>([...Object.keys(manifest.slots), ...allSlots.map((s) => s.path)]);

  return [...paths].map((path) => {
    const entry = manifest.slots[path] ?? defaultManifestSlot();
    const meta = slotMeta.get(path);
    const disk = diskInfo(path);
    return { ...entry, path, kind: meta?.kind ?? null, tier: meta?.tier ?? null, ...disk };
  });
}

function matchesFilter(item: AssetListItem, filter: string | undefined): boolean {
  switch (filter) {
    case "missing":
      return item.status === "never-attempted";
    case "failed":
      return item.status === "failed";
    case "needsPaidUpgrade":
      return item.needsPaidUpgrade === true;
    case "pollinations":
      return item.backend === "pollinations";
    case "premium":
      return item.backend === "replicate";
    case "brokenPaths":
      return item.status === "broken" || (item.status === "generated" && !item.existsOnDisk);
    default:
      return true;
  }
}

function findDuplicates(items: AssetListItem[]): AssetListItem[] {
  const hashToPaths = new Map<string, AssetListItem[]>();
  for (const item of items) {
    if (item.status !== "generated" || !item.existsOnDisk) continue;
    const abs = join(PUBLIC_DIR, ...item.path.split("/"));
    try {
      const hash = createHash("sha1").update(readFileSync(abs)).digest("hex");
      const bucket = hashToPaths.get(hash) ?? [];
      bucket.push(item);
      hashToPaths.set(hash, bucket);
    } catch {
      // unreadable file — skip, doesn't count as a duplicate
    }
  }
  return [...hashToPaths.values()].filter((bucket) => bucket.length > 1).flat();
}

export const adminAssetsRouter = Router();

adminAssetsRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

// GET /api/admin/assets?filter=missing|failed|needsPaidUpgrade|pollinations|premium|brokenPaths|duplicates
adminAssetsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = req.query.filter as string | undefined;
    const all = await buildAssetList();
    const items = filter === "duplicates" ? findDuplicates(all) : all.filter((item) => matchesFilter(item, filter));

    const summary = {
      total: all.length,
      missing: all.filter((i) => matchesFilter(i, "missing")).length,
      failed: all.filter((i) => matchesFilter(i, "failed")).length,
      needsPaidUpgrade: all.filter((i) => matchesFilter(i, "needsPaidUpgrade")).length,
      pollinations: all.filter((i) => matchesFilter(i, "pollinations")).length,
      premium: all.filter((i) => matchesFilter(i, "premium")).length,
      brokenPaths: all.filter((i) => matchesFilter(i, "brokenPaths")).length,
      duplicates: findDuplicates(all).length,
    };

    res.json({ data: items, summary });
  } catch (err) { next(err); }
});

// GET /api/admin/assets/detail?path=assets/celebrities/x/portrait.webp
adminAssetsRouter.get("/detail", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.query.path as string | undefined;
    if (!path) {
      res.status(400).json({ message: "path query param is required" });
      return;
    }
    const all = await buildAssetList();
    const item = all.find((i) => i.path === path);
    if (!item) {
      res.status(404).json({ message: "Asset not found" });
      return;
    }
    res.json({ data: item });
  } catch (err) { next(err); }
});

// POST /api/admin/assets/regenerate  { paths: string[] }
adminAssetsRouter.post("/regenerate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paths } = req.body as { paths?: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      res.status(400).json({ message: "paths (non-empty array) is required" });
      return;
    }
    await execFileAsync(
      "node",
      [ASSET_MANAGER_CLI, "generate", `--paths=${paths.join(",")}`, "--force"],
      { cwd: ROOT_DIR, timeout: 10 * 60 * 1000 }
    );
    const manifest = loadManifestRaw();
    const updated = paths.map((p) => ({ path: p, ...(manifest.slots[p] ?? defaultManifestSlot()) }));
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// POST /api/admin/assets/upload  { path: string, base64: string }
// Writes directly to local disk under apps/frontend/public/ — deliberately
// bypasses the Cloudinary upload.ts flow; asset-manager-owned images stay local.
adminAssetsRouter.post("/upload", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path, base64 } = req.body as { path?: string; base64?: string };
    if (!path || !base64) {
      res.status(400).json({ message: "path and base64 are required" });
      return;
    }
    const normalized = normalize(path).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized.startsWith("assets/") || normalized.includes("..")) {
      res.status(400).json({ message: "path must be a relative path under assets/" });
      return;
    }
    const destPath = join(PUBLIC_DIR, ...normalized.split("/"));
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const buffer = Buffer.from(raw, "base64");

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, buffer);

    let width: number | null = null;
    let height: number | null = null;
    try {
      const { readImageMeta } = await import(moduleUrl("encode.mjs"));
      const meta = await readImageMeta(destPath);
      width = meta.width;
      height = meta.height;
    } catch {
      // sharp probe failed — non-fatal, dimensions stay null
    }

    const { loadManifest, updateSlot } = await import(moduleUrl("manifest.mjs"));
    const manifest = loadManifest();
    const now = new Date().toISOString();
    const entry = updateSlot(manifest, normalized, {
      backend: "manual-upload",
      model: null,
      status: "generated",
      generatedAt: now,
      lastVerified: now,
      width,
      height,
      error: null,
    });

    res.json({ data: { path: normalized, ...entry } });
  } catch (err) { next(err); }
});

// POST /api/admin/assets/verify-all
adminAssetsRouter.post("/verify-all", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await execFileAsync("node", [ASSET_MANAGER_CLI, "verify-all"], { cwd: ROOT_DIR, timeout: 10 * 60 * 1000 });
    const all = await buildAssetList();
    const summary = {
      generated: all.filter((i) => i.status === "generated").length,
      failed: all.filter((i) => i.status === "failed").length,
      pending: all.filter((i) => i.status === "never-attempted").length,
      needsPaidUpgrade: all.filter((i) => i.needsPaidUpgrade).length,
      brokenReferences: all.filter((i) => matchesFilter(i, "brokenPaths")).length,
    };
    res.json({ data: summary });
  } catch (err) { next(err); }
});
