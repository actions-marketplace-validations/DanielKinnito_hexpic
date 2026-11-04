import { AsciiArtOptions, AsciiArtResult, CharColor } from './types';
import {
  DEFAULT_CHARSET,
  resolveCharset,
  rgbToGrayscale,
  getAsciiChar,
  applyEdgeDetection,
  applySharpen,
  applyEdgeDetectionToPixels,
  applySharpenToPixels,
  resamplePixels,
  adjustPixelsColor,
  applySimpleThresholding,
  renderColorHtml,
  asciiToCanvas,
  asciiToSvg,
  downloadBlob,
  copyTextToClipboard,
  loadImage
} from './utils';

/**
 * Default options for ASCII art generation
 */
const DEFAULT_OPTIONS: Required<AsciiArtOptions> = {
  width: 80,
  height: 40,
  charset: 'normal',
  dithering: 'none',
  colorMode: 'monochrome',
  invert: false,
  contrast: 100,
  brightness: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  useSharpen: false,
  sharpness: 9,
  useEdgeDetection: false,
  edgeIntensity: 1,
  invertEdgeColors: true,
  useThreshold: false,
  thresholdOffset: 128,
  spaceDensity: 1,
  transparentFrame: 0,
  preserveAspectRatio: true,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontAspectRatio: 0.55
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/**
 * Main engine for converting images to studio-quality ASCII art
 */
export class HexPic {
  private options: Required<AsciiArtOptions>;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  /**
   * Creates a new HexPic instance
   * @param options Optional configuration options
   */
  constructor(options: AsciiArtOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private ensureCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!this.canvas || !this.ctx) {
      if (typeof document === 'undefined') {
        throw new Error('Canvas rendering is not supported in a headless environment. Use fromPixels() instead.');
      }
      this.canvas = document.createElement('canvas');
      const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Could not create canvas context');
      }
      this.ctx = ctx;
    }
    return { canvas: this.canvas, ctx: this.ctx };
  }

  /**
   * Updates options for ASCII art generation
   */
  public setOptions(options: AsciiArtOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Gets a copy of the current configuration options
   */
  public getOptions(): Required<AsciiArtOptions> {
    return { ...this.options };
  }

  /**
   * Converts an HTMLImageElement to ASCII art
   */
  public async fromImageElement(image: HTMLImageElement, options?: AsciiArtOptions): Promise<AsciiArtResult> {
    return this.convertImage(image, options);
  }

  /**
   * Converts an image URL to ASCII art
   */
  public async fromUrl(url: string, options?: AsciiArtOptions): Promise<AsciiArtResult> {
    const image = await loadImage(url);
    return this.convertImage(image, options);
  }

  /**
   * Converts a File object to ASCII art
   */
  public fromFile(file: File, options?: AsciiArtOptions): Promise<AsciiArtResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('Failed to read file');
          }
          const image = new Image();
          image.onload = async () => {
            try {
              const result = await this.convertImage(image, options);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          };
          image.onerror = () => reject(new Error('Failed to load image from file'));
          image.src = e.target.result as string;
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Automatically scans the DOM for elements with data-hexpic and renders ASCII art into them.
   */
  public static async init(selector = '[data-hexpic]'): Promise<void> {
    if (typeof document === 'undefined') return;

    const elements = document.querySelectorAll(selector);
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const src = el.getAttribute('src') || el.getAttribute('data-hexpic-src');
      if (!src) continue;

      const opts: AsciiArtOptions = {};
      if (el.dataset.hexpicWidth) opts.width = parseInt(el.dataset.hexpicWidth, 10);
      if (el.dataset.hexpicHeight) opts.height = parseInt(el.dataset.hexpicHeight, 10);
      if (el.dataset.hexpicCharset) opts.charset = el.dataset.hexpicCharset as any;
      if (el.dataset.hexpicDithering) opts.dithering = el.dataset.hexpicDithering as any;
      if (el.dataset.hexpicColorMode) opts.colorMode = el.dataset.hexpicColorMode as any;
      if (el.dataset.hexpicContrast) opts.contrast = parseFloat(el.dataset.hexpicContrast);
      if (el.dataset.hexpicBrightness) opts.brightness = parseFloat(el.dataset.hexpicBrightness);
      if (el.dataset.hexpicSharpen === 'true') opts.useSharpen = true;
      if (el.dataset.hexpicEdge === 'true') opts.useEdgeDetection = true;

      const hexpic = new HexPic(opts);
      try {
        const result = await hexpic.fromUrl(src);
        const container = document.createElement('div');
        container.className = 'hexpic-container';
        container.innerHTML = result.html;

        if (el.tagName.toLowerCase() === 'img') {
          el.parentNode?.replaceChild(container, el);
        } else {
          el.innerHTML = '';
          el.appendChild(container);
        }
      } catch (err) {
        console.error('HexPic failed to render element:', el, err);
      }
    }
  }

  /**
   * Internal processing pipeline: Pre-filtering -> Spatial Convolution -> Dithering -> ASCII Quantization
   */
  private async convertImage(image: HTMLImageElement, options?: AsciiArtOptions): Promise<AsciiArtResult> {
    const currentOptions = { ...this.options, ...options };
    const {
      width: targetWidth,
      height: targetHeight,
      charset,
      dithering,
      colorMode,
      contrast,
      brightness,
      saturation,
      hue,
      grayscale,
      sepia,
      invert,
      useSharpen,
      sharpness,
      useEdgeDetection,
      edgeIntensity,
      invertEdgeColors,
      useThreshold,
      thresholdOffset,
      spaceDensity,
      transparentFrame,
      preserveAspectRatio,
      backgroundColor,
      textColor,
      fontAspectRatio
    } = currentOptions;

    // Calculate dimensions
    const isExplicitHeight = options?.height !== undefined && options.height > 0;
    let width = targetWidth;
    let height = isExplicitHeight ? targetHeight : 0;

    if (!preserveAspectRatio && isExplicitHeight) {
      width = targetWidth;
      height = targetHeight;
    } else {
      const imageAspect = (image.width || 1) / (image.height || 1);
      // Account for monospace character geometry (characters are taller than wide)
      const correctedAspect = imageAspect / fontAspectRatio;

      if (isExplicitHeight && preserveAspectRatio) {
        if (targetWidth / targetHeight > correctedAspect) {
          width = Math.max(1, Math.floor(targetHeight * correctedAspect));
          height = targetHeight;
        } else {
          width = targetWidth;
          height = Math.max(1, Math.floor(targetWidth / correctedAspect));
        }
      } else {
        width = targetWidth;
        height = Math.max(1, Math.floor(targetWidth / correctedAspect));
      }
    }

    const frame = Math.max(0, transparentFrame);
    const canvasWidth = width + 2 * frame;
    const canvasHeight = height + 2 * frame;

    const { canvas, ctx } = this.ensureCanvas();
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Apply CSS color-grading filters before drawing image
    const filters: string[] = [];
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
    if (grayscale !== 0) filters.push(`grayscale(${grayscale}%)`);
    if (sepia !== 0) filters.push(`sepia(${sepia}%)`);
    if (invert) filters.push('invert(100%)');

    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
    ctx.drawImage(image, frame, frame, width, height);
    ctx.filter = 'none';

    // 3. Spatial convolutions: Edge detection and sharpening
    if (useEdgeDetection) {
      applyEdgeDetection(ctx, canvasWidth, canvasHeight, edgeIntensity, invertEdgeColors);
    }
    if (useSharpen) {
      applySharpen(ctx, canvasWidth, canvasHeight, sharpness);
    }

    // 4. Retrieve pixel data
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    return this.processPixelData(imgData.data, canvasWidth, canvasHeight, currentOptions);
  }

  /**
   * Converts a raw RGBA pixel buffer directly to ASCII art without requiring a browser DOM or Canvas.
   * Ideal for Node.js servers, Web Workers, and MCP tool execution.
   */
  public fromPixels(
    pixels: Uint8ClampedArray | Uint8Array,
    sourceWidth: number,
    sourceHeight: number,
    options?: AsciiArtOptions
  ): AsciiArtResult {
    const currentOptions = { ...this.options, ...options };
    const {
      width: targetWidth,
      height: targetHeight,
      preserveAspectRatio,
      fontAspectRatio,
      transparentFrame,
      useEdgeDetection,
      edgeIntensity,
      invertEdgeColors,
      useSharpen,
      sharpness,
      contrast,
      brightness,
      grayscale,
      invert
    } = currentOptions;

    // Calculate dimensions
    const isExplicitHeight = options?.height !== undefined && options.height > 0;
    let width = targetWidth;
    let height = isExplicitHeight ? targetHeight : 0;

    if (!preserveAspectRatio && isExplicitHeight) {
      width = targetWidth;
      height = targetHeight;
    } else {
      const imageAspect = (sourceWidth || 1) / (sourceHeight || 1);
      const correctedAspect = imageAspect / fontAspectRatio;

      if (isExplicitHeight && preserveAspectRatio) {
        if (targetWidth / targetHeight > correctedAspect) {
          width = Math.max(1, Math.floor(targetHeight * correctedAspect));
          height = targetHeight;
        } else {
          width = targetWidth;
          height = Math.max(1, Math.floor(targetWidth / correctedAspect));
        }
      } else {
        width = targetWidth;
        height = Math.max(1, Math.floor(targetWidth / correctedAspect));
      }
    }

    const frame = Math.max(0, transparentFrame);
    const canvasWidth = width + 2 * frame;
    const canvasHeight = height + 2 * frame;

    // Resample pixels to target width & height
    let data = resamplePixels(pixels, sourceWidth, sourceHeight, width, height);

    // Apply frame padding if needed
    if (frame > 0) {
      const framed = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4;
          const dstIdx = ((y + frame) * canvasWidth + (x + frame)) * 4;
          framed[dstIdx] = data[srcIdx];
          framed[dstIdx + 1] = data[srcIdx + 1];
          framed[dstIdx + 2] = data[srcIdx + 2];
          framed[dstIdx + 3] = data[srcIdx + 3];
        }
      }
      data = framed;
    }

    // Color grading adjustments
    adjustPixelsColor(data, { contrast, brightness, grayscale, invert });

    // Spatial convolution filters
    if (useEdgeDetection) {
      data = applyEdgeDetectionToPixels(data, canvasWidth, canvasHeight, edgeIntensity, invertEdgeColors);
    }
    if (useSharpen) {
      data = applySharpenToPixels(data, canvasWidth, canvasHeight, sharpness);
    }

    return this.processPixelData(data, canvasWidth, canvasHeight, currentOptions);
  }

  /**
   * Internal pixel processing pipeline: Binary thresholding -> Luminance matrix -> Error-diffusion dithering -> ASCII quantization
   */
  public processPixelData(
    data: Uint8ClampedArray | Uint8Array,
    canvasWidth: number,
    canvasHeight: number,
    currentOptions: Required<AsciiArtOptions>
  ): AsciiArtResult {
    const {
      charset,
      dithering,
      colorMode,
      useThreshold,
      thresholdOffset,
      spaceDensity,
      backgroundColor,
      textColor
    } = currentOptions;

    // 1. Binary thresholding if enabled
    if (useThreshold) {
      applySimpleThresholding(data as Uint8ClampedArray, canvasWidth, canvasHeight, thresholdOffset);
    }

    // 2. Resolve character palette with space density padding
    const resolvedCharset = resolveCharset(charset, spaceDensity);
    const charsetLen = resolvedCharset.length;

    // 3. Populate luminance matrix
    const lum = new Float32Array(canvasWidth * canvasHeight);
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const i = (y * canvasWidth + x) * 4;
        if (data[i + 3] < 16) {
          lum[y * canvasWidth + x] = 255; // Transparent -> space
        } else {
          lum[y * canvasWidth + x] = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
        }
      }
    }

    // 4. Dithering Error Diffusion
    if (dithering !== 'none' && charsetLen > 1) {
      const steps = charsetLen - 1;

      for (let y = 0; y < canvasHeight; y++) {
        for (let x = 0; x < canvasWidth; x++) {
          const idx = y * canvasWidth + x;
          const oldVal = lum[idx];
          const clampedOld = Math.min(255, Math.max(0, oldVal));
          const quantized = Math.round((clampedOld / 255) * steps) / steps * 255;
          const err = oldVal - quantized;

          if (dithering === 'floyd-steinberg') {
            if (x + 1 < canvasWidth) lum[idx + 1] += err * (7 / 16);
            if (y + 1 < canvasHeight) {
              if (x > 0) lum[idx + canvasWidth - 1] += err * (3 / 16);
              lum[idx + canvasWidth] += err * (5 / 16);
              if (x + 1 < canvasWidth) lum[idx + canvasWidth + 1] += err * (1 / 16);
            }
          } else if (dithering === 'atkinson') {
            const eighth = err * (1 / 8);
            if (x + 1 < canvasWidth) lum[idx + 1] += eighth;
            if (x + 2 < canvasWidth) lum[idx + 2] += eighth;
            if (y + 1 < canvasHeight) {
              if (x > 0) lum[idx + canvasWidth - 1] += eighth;
              lum[idx + canvasWidth] += eighth;
              if (x + 1 < canvasWidth) lum[idx + canvasWidth + 1] += eighth;
            }
            if (y + 2 < canvasHeight) {
              lum[idx + 2 * canvasWidth] += eighth;
            }
          } else if (dithering === 'jjn') {
            const spread = (dx: number, dy: number, w: number) => {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
                lum[ny * canvasWidth + nx] += err * (w / 48);
              }
            };
            spread(1, 0, 7); spread(2, 0, 5);
            spread(-2, 1, 3); spread(-1, 1, 5); spread(0, 1, 7); spread(1, 1, 5); spread(2, 1, 3);
            spread(-2, 2, 1); spread(-1, 2, 3); spread(0, 2, 5); spread(1, 2, 3); spread(2, 2, 1);
          } else if (dithering === 'stucki') {
            const spread = (dx: number, dy: number, w: number) => {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
                lum[ny * canvasWidth + nx] += err * (w / 42);
              }
            };
            spread(1, 0, 8); spread(2, 0, 4);
            spread(-2, 1, 2); spread(-1, 1, 4); spread(0, 1, 8); spread(1, 1, 4); spread(2, 1, 2);
            spread(-2, 2, 1); spread(-1, 2, 2); spread(0, 2, 4); spread(1, 2, 2); spread(2, 2, 1);
          }

          lum[idx] = quantized;
        }
      }
    }

    // 5. Generate characters and colors
    const lines: string[] = [];
    const colors: CharColor[][] = [];
    const isColor = colorMode === 'color';

    for (let y = 0; y < canvasHeight; y++) {
      let line = '';
      const rowColors: CharColor[] = [];

      for (let x = 0; x < canvasWidth; x++) {
        const i = (y * canvasWidth + x) * 4;
        if (data[i + 3] < 16) {
          line += ' ';
          if (isColor) rowColors.push({ r: 0, g: 0, b: 0 });
          continue;
        }

        const b = Math.min(255, Math.max(0, lum[y * canvasWidth + x]));
        const char = getAsciiChar(b, resolvedCharset);
        line += char;

        if (isColor) {
          rowColors.push({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2]
          });
        }
      }

      lines.push(line);
      if (isColor) colors.push(rowColors);
    }

    const ascii = lines.join('\n');
    const html = isColor
      ? renderColorHtml(lines, colors, backgroundColor)
      : `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${backgroundColor}; color: ${textColor}; margin: 0; padding: 0;">${escapeHtml(ascii)}</pre>`;

    return {
      ascii,
      html,
      width: canvasWidth,
      height: canvasHeight,
      charset: resolvedCharset,
      colors: isColor ? colors : undefined,
      async copyToClipboard(): Promise<void> {
        await copyTextToClipboard(ascii);
      },
      saveAsText(filename = 'ascii-art.txt'): void {
        if (typeof Blob === 'undefined') {
          throw new Error('saveAsText requires a browser environment. Use result.ascii in Node.js.');
        }
        const blob = new Blob([ascii], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, filename);
      },
      saveAsPng(filename = 'ascii-art.png', fontSize = 12, bg = backgroundColor, fg = textColor): void {
        const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, filename);
        }, 'image/png');
      },
      toPngDataUrl(fontSize = 12, bg = backgroundColor, fg = textColor): string {
        const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
        return canvas.toDataURL('image/png');
      },
      toPngBlob(fontSize = 12, bg = backgroundColor, fg = textColor): Promise<Blob> {
        const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
        return new Promise((res, rej) => {
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas blob generation failed'))), 'image/png');
        });
      },
      toSvg(fontSize = 12, bg = backgroundColor, fg = textColor): string {
        return asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
      },
      saveAsSvg(filename = 'ascii-art.svg', fontSize = 12, bg = backgroundColor, fg = textColor): void {
        const svgString = asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
        if (typeof Blob === 'undefined') {
          throw new Error('saveAsSvg requires a browser environment. Use result.toSvg() in Node.js.');
        }
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, filename);
      },
      toSvgBlob(fontSize = 12, bg = backgroundColor, fg = textColor): Promise<Blob> {
        const svgString = asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
        if (typeof Blob === 'undefined') {
          return Promise.reject(new Error('toSvgBlob requires a browser environment. Use result.toSvg() in Node.js.'));
        }
        return Promise.resolve(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
      }
    };
  }
}

export default HexPic;
