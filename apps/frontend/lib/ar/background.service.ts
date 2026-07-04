import type { BackgroundConfig, BackgroundMode, MaskData } from './types.js';

export class BackgroundService {
  private config: BackgroundConfig;
  private replacementImage: HTMLImageElement | null = null;
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;

  constructor(config: BackgroundConfig) {
    this.config = { ...config };
    if (config.replacementImageUrl) {
      void this.loadReplacementImage(config.replacementImageUrl);
    }
  }

  get mode(): BackgroundMode { return this.config.mode; }

  updateConfig(config: Partial<BackgroundConfig>): void {
    const prevUrl = this.config.replacementImageUrl;
    this.config = { ...this.config, ...config };
    if (config.replacementImageUrl && config.replacementImageUrl !== prevUrl) {
      void this.loadReplacementImage(config.replacementImageUrl);
    }
  }

  private async loadReplacementImage(url: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    try {
      await img.decode();
      this.replacementImage = img;
    } catch {
      console.warn('[BackgroundService] Failed to load replacement image');
    }
  }

  private ensureTempCanvas(width: number, height: number): CanvasRenderingContext2D {
    if (!this.tempCanvas) this.tempCanvas = document.createElement('canvas');
    if (this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
      this.tempCtx = null;
    }
    if (!this.tempCtx) this.tempCtx = this.tempCanvas.getContext('2d')!;
    return this.tempCtx;
  }

  apply(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: MaskData | null,
    w: number,
    h: number,
  ): void {
    ctx.clearRect(0, 0, w, h);

    if (!mask || this.config.mode === 'NONE') {
      ctx.drawImage(video, 0, 0, w, h);
      return;
    }

    switch (this.config.mode) {
      case 'BLUR': this.applyBlur(ctx, video, mask, w, h); break;
      case 'REPLACE': this.applyReplacement(ctx, video, mask, w, h); break;
      case 'TRANSPARENT': this.applyTransparent(ctx, video, mask, w, h); break;
    }
  }

  private applyBlur(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: MaskData,
    w: number,
    h: number,
  ): void {
    const tmp = this.ensureTempCanvas(w, h);
    tmp.drawImage(video, 0, 0, w, h);
    const sharpData = tmp.getImageData(0, 0, w, h);

    ctx.filter = `blur(${this.config.blurStrength}px)`;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.filter = 'none';

    const outputData = ctx.getImageData(0, 0, w, h);
    this.compositePersonOnBackground(sharpData, outputData, mask, w, h);
    ctx.putImageData(outputData, 0, 0);
  }

  private applyReplacement(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: MaskData,
    w: number,
    h: number,
  ): void {
    if (this.replacementImage) {
      ctx.drawImage(this.replacementImage, 0, 0, w, h);
    } else {
      ctx.fillStyle = this.config.color ?? '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
    }

    const tmp = this.ensureTempCanvas(w, h);
    tmp.drawImage(video, 0, 0, w, h);
    const sharpData = tmp.getImageData(0, 0, w, h);
    const outputData = ctx.getImageData(0, 0, w, h);
    this.compositePersonOnBackground(sharpData, outputData, mask, w, h);
    ctx.putImageData(outputData, 0, 0);
  }

  private applyTransparent(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    mask: MaskData,
    w: number,
    h: number,
  ): void {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;
    const scaleX = mask.width / w;
    const scaleY = mask.height / h;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const mX = Math.floor(x * scaleX);
        const mY = Math.floor(y * scaleY);
        data[(y * w + x) * 4 + 3] = mask.data[mY * mask.width + mX];
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private compositePersonOnBackground(
    person: ImageData,
    bg: ImageData,
    mask: MaskData,
    w: number,
    h: number,
  ): void {
    const scaleX = mask.width / w;
    const scaleY = mask.height / h;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const mX = Math.floor(x * scaleX);
        const mY = Math.floor(y * scaleY);
        const alpha = mask.data[mY * mask.width + mX] / 255;
        const idx = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          bg.data[idx + c] = Math.round(
            person.data[idx + c] * alpha + bg.data[idx + c] * (1 - alpha),
          );
        }
        bg.data[idx + 3] = 255;
      }
    }
  }

  destroy(): void {
    this.replacementImage = null;
    this.tempCanvas = null;
    this.tempCtx = null;
  }
}
