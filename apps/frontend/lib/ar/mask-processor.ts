/**
 * Pure mask manipulation utilities — no browser APIs, fully testable in Node.js.
 */

export function thresholdMask(
  confidenceMask: Float32Array,
  threshold: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(confidenceMask.length);
  for (let i = 0; i < confidenceMask.length; i++) {
    result[i] = confidenceMask[i] >= threshold ? 255 : 0;
  }
  return result;
}

export function smoothMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(mask);

  const result = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += mask[ny * width + nx];
            count++;
          }
        }
      }
      result[y * width + x] = Math.round(sum / count);
    }
  }
  return result;
}

export function temporalSmooth(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  factor: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(current.length);
  const clampedFactor = Math.max(0, Math.min(1, factor));
  for (let i = 0; i < current.length; i++) {
    result[i] = Math.round(current[i] * (1 - clampedFactor) + previous[i] * clampedFactor);
  }
  return result;
}

export function blendMasks(
  maskA: Uint8ClampedArray,
  maskB: Uint8ClampedArray,
  alpha: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(maskA.length);
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  for (let i = 0; i < maskA.length; i++) {
    result[i] = Math.round(maskA[i] * (1 - clampedAlpha) + maskB[i] * clampedAlpha);
  }
  return result;
}

export function computeCoverage(mask: Uint8ClampedArray): number {
  if (mask.length === 0) return 0;
  let personPixels = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 127) personPixels++;
  }
  return personPixels / mask.length;
}

export function getMaskBoundingBox(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function erodeMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  kernelSize: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(mask.length);
  const r = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const v = mask[ny * width + nx];
            if (v < minVal) minVal = v;
          } else {
            minVal = 0;
          }
        }
      }
      result[y * width + x] = minVal;
    }
  }
  return result;
}
