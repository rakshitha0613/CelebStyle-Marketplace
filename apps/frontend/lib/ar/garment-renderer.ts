import type {
  GarmentAsset,
  GarmentAlignment,
  GarmentOverlayConfig,
  PoseLandmark,
} from './garment.types.js';
import { POSE_LANDMARKS } from './garment.types.js';

const LANDMARK_RADIUS = 5;
const SKELETON_PAIRS: [number, number][] = [
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
];
const KEY_LANDMARKS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
];

export class GarmentRenderer {
  /**
   * Draws a garment image onto the canvas aligned to the computed transform.
   *
   * The garment's shoulder anchor (defined in normalised garment coordinates)
   * is placed at alignment.x / alignment.y; the image is then rotated and
   * optionally mirrored.
   */
  render(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    garment: GarmentAsset,
    alignment: GarmentAlignment,
    config: GarmentOverlayConfig,
  ): void {
    if (!alignment.visible) return;
    if (alignment.opacity <= 0 && !config.highContrast) return;

    // Shoulder anchor position within the garment image (normalised 0–1)
    const anchorX =
      (garment.anchors.leftShoulder.x + garment.anchors.rightShoulder.x) / 2;
    const anchorY =
      (garment.anchors.leftShoulder.y + garment.anchors.rightShoulder.y) / 2;

    ctx.save();
    ctx.globalAlpha = config.highContrast ? 1.0 : alignment.opacity;
    ctx.globalCompositeOperation = 'source-over';

    ctx.translate(alignment.x, alignment.y);
    ctx.rotate(alignment.rotation);
    if (alignment.mirrored) ctx.scale(-1, 1);

    ctx.drawImage(
      image,
      -anchorX * alignment.width,
      -anchorY * alignment.height,
      alignment.width,
      alignment.height,
    );

    ctx.restore();
  }

  /**
   * Draws debug skeleton and key joint dots over detected pose landmarks.
   * Uses high-visibility green (#00ff64) with per-landmark alpha tied to
   * confidence.
   */
  renderLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    canvasWidth: number,
    canvasHeight: number,
    visibilityThreshold = 0.3,
  ): void {
    if (!landmarks.length) return;
    ctx.save();

    // Draw skeleton edges first so dots appear on top
    ctx.lineWidth = 2;
    for (const [ai, bi] of SKELETON_PAIRS) {
      const a = landmarks[ai];
      const b = landmarks[bi];
      if (!a || !b) continue;
      if (a.visibility < visibilityThreshold || b.visibility < visibilityThreshold) continue;
      ctx.strokeStyle = `rgba(0,255,100,${Math.min(a.visibility, b.visibility) * 0.8})`;
      ctx.beginPath();
      ctx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
      ctx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
      ctx.stroke();
    }

    // Draw key joint dots
    for (const idx of KEY_LANDMARKS) {
      const lm = landmarks[idx];
      if (!lm || lm.visibility < visibilityThreshold) continue;
      ctx.fillStyle = `rgba(0,255,100,${lm.visibility})`;
      ctx.beginPath();
      ctx.arc(
        lm.x * canvasWidth,
        lm.y * canvasHeight,
        LANDMARK_RADIUS,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}
