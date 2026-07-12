import type {
  GarmentAsset,
  GarmentAlignment,
  GarmentOverlayConfig,
  PoseLandmark,
} from './garment.types.js';
import { POSE_LANDMARKS } from './garment.types.js';

const LANDMARK_RADIUS = 5;
const SKELETON_PAIRS: [number, number][] = [
  [POSE_LANDMARKS.LEFT_SHOULDER,  POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER,  POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP,       POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_SHOULDER,  POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW,     POSE_LANDMARKS.LEFT_WRIST],
  [POSE_LANDMARKS.RIGHT_ELBOW,    POSE_LANDMARKS.RIGHT_WRIST],
];
const KEY_LANDMARKS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_ELBOW,
  POSE_LANDMARKS.RIGHT_ELBOW,
];

export class GarmentRenderer {
  /**
   * Renders a garment image onto the canvas at the computed body-relative position.
   *
   * Algorithm:
   *   1. Translate canvas origin to the detected shoulder midpoint (chestCenter).
   *   2. Rotate by shoulder tilt angle.
   *   3. Mirror for selfie cameras.
   *   4. Draw the garment image so that its shoulder anchor aligns with origin.
   *   5. Apply a subtle shadow under the garment hem for depth.
   *   6. Restore canvas state.
   *
   * The shoulder anchor position (anchorX, anchorY) is defined in normalised
   * garment image space (0–1).  For a T-shirt with anchorY=0.09 the collar
   * will appear 9% × garmentHeight above the shoulder midpoint.
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

    // Shoulder anchor in normalised garment image space
    const anchorX = (garment.anchors.leftShoulder.x + garment.anchors.rightShoulder.x) / 2;
    const anchorY = (garment.anchors.leftShoulder.y + garment.anchors.rightShoulder.y) / 2;

    const drawX = -anchorX * alignment.width;
    const drawY = -anchorY * alignment.height;

    ctx.save();

    ctx.globalAlpha = config.highContrast ? 1.0 : alignment.opacity;
    ctx.globalCompositeOperation = 'source-over';

    // Position at shoulder midpoint, apply body tilt.
    // Mirror mode: the CANVAS is CSS-flipped (in GarmentOverlay) so we don't
    // also flip here — that would double-mirror and misalign the garment.
    ctx.translate(alignment.x, alignment.y);
    ctx.rotate(alignment.rotation);

    // ── Edge softening: tiny blur on the canvas filter pipeline ─────────────
    // Softens the rectangular edge of garment images that lack a transparent
    // background, blending them into the scene more naturally.
    ctx.filter = 'blur(0.4px)';

    ctx.drawImage(image, drawX, drawY, alignment.width, alignment.height);

    ctx.filter = 'none';

    // ── Subtle depth shadow under the garment hem ────────────────────────────
    // Adds a narrow gradient strip below the bottom edge to ground the garment.
    if (alignment.opacity > 0.5 && !config.highContrast) {
      const hemY      = drawY + alignment.height;
      const shadowH   = alignment.width * 0.04; // 4% of garment width
      const gradient  = ctx.createLinearGradient(0, hemY, 0, hemY + shadowH);
      gradient.addColorStop(0, `rgba(0,0,0,${alignment.opacity * 0.18})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(drawX, hemY, alignment.width, shadowH);
    }

    ctx.restore();
  }

  /**
   * Draws debug skeleton and confidence-weighted joint dots over landmarks.
   * Skeleton lines are drawn first so joint dots appear on top.
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

    // Skeleton lines
    ctx.lineWidth = 2;
    for (const [ai, bi] of SKELETON_PAIRS) {
      const a = landmarks[ai];
      const b = landmarks[bi];
      if (!a || !b) continue;
      if (a.visibility < visibilityThreshold || b.visibility < visibilityThreshold) continue;
      const alpha = Math.min(a.visibility, b.visibility) * 0.8;
      ctx.strokeStyle = `rgba(0,255,100,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
      ctx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
      ctx.stroke();
    }

    // Joint dots
    for (const idx of KEY_LANDMARKS) {
      const lm = landmarks[idx];
      if (!lm || lm.visibility < visibilityThreshold) continue;
      ctx.fillStyle = `rgba(0,255,100,${lm.visibility})`;
      ctx.beginPath();
      ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, LANDMARK_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
