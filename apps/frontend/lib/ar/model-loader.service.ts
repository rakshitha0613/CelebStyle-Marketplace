import type { LoadedModel, LODLevel } from './three.types.js';
import { LOD_POLY_THRESHOLDS } from './three.types.js';

const MAX_CACHE_SIZE   = 10;
const DRACO_CDN        = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
const GLTF_LOADER_PATH = 'three/examples/jsm/loaders/GLTFLoader.js';
const DRACO_LOADER_PATH = 'three/examples/jsm/loaders/DRACOLoader.js';

type GLTFResult = {
  scene: object;
  scenes: object[];
  animations: object[];
  asset: { version: string };
  userData: Record<string, unknown>;
};

interface CacheEntry {
  meta: LoadedModel;
  gltf: GLTFResult;
}

export type LoadStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export class ModelLoaderService {
  private readonly cache    = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CacheEntry>>();
  private readonly dracoPath: string;
  private status: LoadStatus = 'IDLE';

  constructor(dracoPath = DRACO_CDN) {
    this.dracoPath = dracoPath;
  }

  get currentStatus(): LoadStatus { return this.status; }

  /**
   * Load a GLB/GLTF model (with optional Draco compression).
   * Repeated calls for the same URL return the cached result.
   * Concurrent calls for the same URL share a single in-flight request.
   */
  async load(url: string): Promise<{ meta: LoadedModel; gltf: GLTFResult }> {
    // Cache hit
    const hit = this.cache.get(url);
    if (hit) {
      hit.meta.lastAccessed = Date.now();
      return hit;
    }

    // In-flight deduplication
    const flying = this.inflight.get(url);
    if (flying) {
      return flying;
    }

    const promise = this._fetch(url);
    this.inflight.set(url, promise);

    try {
      const entry = await promise;
      this.cache.set(url, entry);
      return entry;
    } finally {
      this.inflight.delete(url);
    }
  }

  private async _fetch(url: string): Promise<CacheEntry> {
    this.status = 'LOADING';

    try {
      // Dynamic imports keep Three.js out of the SSR bundle
      const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import(/* webpackChunkName: "gltf-loader" */ GLTF_LOADER_PATH as never) as Promise<{ GLTFLoader: new () => { setDRACOLoader(d: unknown): void; load(url: string, onLoad: (g: GLTFResult) => void, onProgress: undefined, onError: (e: unknown) => void): void } }>,
        import(/* webpackChunkName: "draco-loader" */ DRACO_LOADER_PATH as never) as Promise<{ DRACOLoader: new () => { setDecoderPath(path: string): void; preload(): void } }>,
      ]);

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(this.dracoPath);
      dracoLoader.preload();

      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      const gltf = await new Promise<GLTFResult>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      if (this.cache.size >= MAX_CACHE_SIZE) this._evict();

      const polyCount = this._countPolygons(gltf);

      const meta: LoadedModel = {
        id:            url,
        url,
        polyCount,
        lodLevel:      this._selectLOD(polyCount),
        hasAnimations: Array.isArray(gltf.animations) && gltf.animations.length > 0,
        hasSkeleton:   this._detectSkeleton(gltf),
        loadedAt:      Date.now(),
        lastAccessed:  Date.now(),
      };

      this.status = 'READY';
      const entry: CacheEntry = { meta, gltf };
      return entry;
    } catch (err) {
      this.status = 'ERROR';
      throw err;
    }
  }

  /** Walk the scene graph to sum triangle counts */
  private _countPolygons(gltf: GLTFResult): number {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traverse = (node: any) => {
      if (node?.geometry?.index) {
        count += node.geometry.index.count / 3;
      } else if (node?.geometry?.attributes?.position) {
        count += node.geometry.attributes.position.count / 3;
      }
      if (Array.isArray(node?.children)) node.children.forEach(traverse);
    };
    traverse(gltf.scene);
    return Math.round(count);
  }

  private _detectSkeleton(gltf: GLTFResult): boolean {
    let found = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traverse = (node: any) => {
      if (node?.isSkinnedMesh) { found = true; return; }
      if (Array.isArray(node?.children)) node.children.forEach(traverse);
    };
    traverse(gltf.scene);
    return found;
  }

  selectLOD(polyCount: number, cameraDistance = 0): LODLevel {
    return this._selectLOD(polyCount, cameraDistance);
  }

  private _selectLOD(polyCount: number, cameraDistance = 0): LODLevel {
    if (polyCount >= LOD_POLY_THRESHOLDS.LOW || cameraDistance >= 4.0) return 'LOW';
    if (polyCount >= LOD_POLY_THRESHOLDS.MEDIUM || cameraDistance >= 2.0) return 'MEDIUM';
    return 'HIGH';
  }

  /** Evict the least-recently-accessed entry */
  private _evict(): void {
    let oldestKey  = '';
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.meta.lastAccessed < oldestTime) {
        oldestTime = entry.meta.lastAccessed;
        oldestKey  = key;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  preload(urls: string[]): void {
    for (const url of urls) {
      if (!this.isLoaded(url) && !this.isLoading(url)) {
        void this.load(url);
      }
    }
  }

  isLoaded(url: string): boolean  { return this.cache.has(url); }
  isLoading(url: string): boolean { return this.inflight.has(url); }
  getCacheSize(): number           { return this.cache.size; }
  clearCache(): void               { this.cache.clear(); this.status = 'IDLE'; }

  getMetadata(url: string): LoadedModel | null {
    return this.cache.get(url)?.meta ?? null;
  }
}
