import type { InitStatus } from './garment.types.js';
import type {
  Scene3DConfig,
  LightingPreset,
  EnvironmentPreset,
} from './three.types.js';
import { LIGHTING_PRESETS, DEFAULT_SCENE_CONFIG } from './three.types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyThree = any;

/**
 * Imperative Three.js scene manager.
 *
 * Wraps a plain THREE.WebGLRenderer canvas (not R3F) for cases where direct
 * scene control is needed — e.g. headless rendering or dedicated AR passes.
 * When used alongside R3F, prefer configuring lights/environment declaratively
 * via SceneRenderer children.
 */
export class ThreeSceneService {
  private status: InitStatus = 'UNINITIALIZED';
  private config: Scene3DConfig;

  private _scene:    AnyThree = null;
  private _camera:   AnyThree = null;
  private _renderer: AnyThree = null;
  private _lights:   AnyThree[] = [];

  constructor(config: Scene3DConfig = DEFAULT_SCENE_CONFIG) {
    this.config = { ...config };
  }

  get initStatus(): InitStatus { return this.status; }
  get isReady(): boolean       { return this.status === 'READY'; }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.status === 'READY' || this.status === 'INITIALIZING') return;
    this.status = 'INITIALIZING';

    try {
      const THREE = await import('three');

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        50,
        canvas.width / canvas.height,
        0.01,
        100,
      );
      camera.position.set(0, 1, 3);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha:     true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.width, canvas.height, false);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping       = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      this._scene    = scene;
      this._camera   = camera;
      this._renderer = renderer;

      this._applyLighting(THREE, scene, this.config.lighting);

      this.status = 'READY';
    } catch (err) {
      this.status = 'ERROR';
      throw err;
    }
  }

  private _applyLighting(
    THREE: typeof import('three'),
    scene: import('three').Scene,
    preset: LightingPreset,
  ): void {
    // Remove old lights
    for (const light of this._lights) scene.remove(light);
    this._lights = [];

    const cfg = LIGHTING_PRESETS[preset];

    const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
    const directional = new THREE.DirectionalLight(0xffffff, cfg.directionalIntensity);
    directional.position.set(...cfg.directionalPosition);
    directional.castShadow = true;

    scene.add(ambient, directional);
    this._lights = [ambient, directional];
  }

  setLighting(preset: LightingPreset): void {
    this.config.lighting = preset;
    // Re-apply at next render if already initialized — requires Three.js reference
    // For live updates, callers should re-initialize or use the R3F declarative API
  }

  updateConfig(patch: Partial<Scene3DConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): Scene3DConfig { return { ...this.config }; }

  /** Called every frame from the main RAF loop */
  render(_timestamp: number): void {
    if (!this.isReady) return;
    this._renderer.render(this._scene, this._camera);
  }

  resize(width: number, height: number): void {
    if (!this.isReady) return;
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height, false);
  }

  destroy(): void {
    if (this._renderer) {
      this._renderer.dispose();
    }
    this._scene    = null;
    this._camera   = null;
    this._renderer = null;
    this._lights   = [];
    this.status    = 'UNINITIALIZED';
  }
}
