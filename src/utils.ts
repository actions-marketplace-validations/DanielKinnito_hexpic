import { CharColor } from './types';

/**
 * Built-in character sets for ASCII art, ordered from darkest to lightest.
 */
export const CHARSET_PRESETS: Record<string, string> = {
  minimalist: '#+-.',
  normal: '@%#*+=-:.',
  normal2: '&$Xx+;:.',
  alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz',
  numerical: '0896452317',
  extended: '@%#{}[]()<>^*+=~-:.',
  math: '+-×÷=≠≈∞√π',
  arrow: '↑↗→↘↓↙←↖',
  grayscale: '@$BWM#*oahkbdpwmZO0QCJYXzcvnxrjft/|()1{}[]-_+~<>i!lI;:,"^`\'.',
  max: 'ÆÑÊŒØMÉËÈÃÂWQBCæ#NÁþEÄÀHKRŽœXgÐêqÛŠÕÔA€ßpmãâG¶øðé8ÚÜ$ëdÙýèÓÞÖåÿÒb¥FDñáZPäšÇàhû§ÝkŸ®S9žUTe6µOyxÎ¾f4õ5ôú&aü™2ùçw©Y£0VÍL±3ÏÌóC@nöòs¢u‰½¼‡zJƒ%¤Itocîrjv1líd=ïì<>i7†[¿?×}*{+()/»«•¬|!¡÷¦¯—^ª„”“~³º²–°­¹‹›;:’‘‚’˜ˆ¸…·¨´`',
  codepage437: '█▓▒░',
  blockelement: '█▀▄▌▐░▒▓',
  braille: '⣿⣶⣤⣀ '
};

export const DEFAULT_CHARSET = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ';

/**
 * Resolves a charset identifier (preset name or custom string) and applies space density padding.
 */
export function resolveCharset(charset?: string, spaceDensity = 1): string {
  let base = CHARSET_PRESETS.normal;
  if (charset && typeof charset === 'string') {
    if (Object.prototype.hasOwnProperty.call(CHARSET_PRESETS, charset)) {
      base = CHARSET_PRESETS[charset];
    } else if (charset.length > 0) {
      base = charset;
    }
  }

  const padding = spaceDensity > 0 ? ' '.repeat(spaceDensity) : '';
  return base + padding;
}

/**
 * Converts an RGB value to perceived luminance (Rec. 709).
 */
export function rgbToGrayscale(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/**
 * Adjusts the contrast of a luminance value around mid-gray (128).
 */
export function adjustContrast(value: number, contrast: number): number {
  const centered = value - 128;
  const adjusted = centered * contrast + 128;
  return Math.min(255, Math.max(0, adjusted));
}

/**
 * Adjusts the brightness of a luminance value.
 */
export function adjustBrightness(value: number, brightness: number): number {
  if (brightness > 0) {
    return value + (255 - value) * brightness;
  } else if (brightness < 0) {
    return value + value * brightness;
  }
  return value;
}

/**
 * Maps a brightness value [0, 255] to an ASCII character from the resolved charset.
 */
export function getAsciiChar(brightness: number, charset: string, gamma = 1.5): string {
  const clamped = Math.min(255, Math.max(0, brightness));
  const normalized = clamped / 255;
  const adjusted = gamma === 1 ? normalized : Math.pow(normalized, gamma);
  const index = Math.floor(adjusted * (charset.length - 1));
  return charset[Math.min(Math.max(index, 0), charset.length - 1)];
}

/**
 * Applies Sobel 3x3 convolution to a raw RGBA pixel buffer to accentuate outlines.
 */
export function applyEdgeDetectionToPixels(
  src: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  intensity: number,
  invertColors = true
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(src.length);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        output[idx] = output[idx + 1] = output[idx + 2] = invertColors ? 255 : 0;
        output[idx + 3] = 255;
        continue;
      }

      let gx = 0;
      let gy = 0;

      for (let kyIdx = -1; kyIdx <= 1; kyIdx++) {
        for (let kxIdx = -1; kxIdx <= 1; kxIdx++) {
          const pixelIdx = ((y + kyIdx) * width + (x + kxIdx)) * 4;
          const lum = 0.2126 * src[pixelIdx] + 0.7152 * src[pixelIdx + 1] + 0.0722 * src[pixelIdx + 2];
          const kPos = (kyIdx + 1) * 3 + (kxIdx + 1);
          gx += lum * kx[kPos];
          gy += lum * ky[kPos];
        }
      }

      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * intensity);
      const val = invertColors ? 255 - mag : mag;

      output[idx] = val;
      output[idx + 1] = val;
      output[idx + 2] = val;
      output[idx + 3] = src[idx + 3];
    }
  }

  return output;
}

/**
 * Applies a 3x3 Sobel convolution filter to emphasize visual edges and outlines.
 */
export function applyEdgeDetection(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  invertColors = true
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const output = applyEdgeDetectionToPixels(imgData.data, width, height, intensity, invertColors);
  putImageDataSafe(ctx, output, width, height);
}

/**
 * Helper to write pixels to canvas safely across browser and test environments
 */
function putImageDataSafe(ctx: CanvasRenderingContext2D, data: Uint8ClampedArray, width: number, height: number): void {
  try {
    let imgData: ImageData;
    if (typeof ctx.createImageData === 'function') {
      imgData = ctx.createImageData(width, height);
      imgData.data.set(data);
    } else if (typeof (globalThis as any).ImageData !== 'undefined') {
      imgData = new (globalThis as any).ImageData(data, width, height);
    } else {
      imgData = { data, width, height } as unknown as ImageData;
    }
    if (typeof ctx.putImageData === 'function') {
      ctx.putImageData(imgData, 0, 0);
    }
  } catch {
    // Graceful fallback if mock environment does not support putImageData
  }
}

/**
 * Applies a 3x3 unsharp convolution sharpening kernel to raw RGBA pixel data.
 */
export function applySharpenToPixels(
  src: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  sharpness: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(src.length);
  const kernel = [-1, -1, -1, -1, sharpness, -1, -1, -1, -1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        output[idx] = src[idx];
        output[idx + 1] = src[idx + 1];
        output[idx + 2] = src[idx + 2];
        output[idx + 3] = src[idx + 3];
        continue;
      }

      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
          const kWeight = kernel[(ky + 1) * 3 + (kx + 1)];
          r += src[pixelIdx] * kWeight;
          g += src[pixelIdx + 1] * kWeight;
          b += src[pixelIdx + 2] * kWeight;
        }
      }

      output[idx] = Math.min(255, Math.max(0, r));
      output[idx + 1] = Math.min(255, Math.max(0, g));
      output[idx + 2] = Math.min(255, Math.max(0, b));
      output[idx + 3] = src[idx + 3];
    }
  }

  return output;
}

/**
 * Applies a 3x3 unsharp convolution sharpening kernel to make fine details pop.
 */
export function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sharpness: number
): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const output = applySharpenToPixels(imgData.data, width, height, sharpness);
  putImageDataSafe(ctx, output, width, height);
}

/**
 * Resamples an RGBA pixel buffer to target dimensions.
 */
export function resamplePixels(
  src: Uint8ClampedArray | Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(srcWidth - 1, Math.floor(x * xRatio));
      const srcY = Math.min(srcHeight - 1, Math.floor(y * yRatio));
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}

/**
 * Adjusts color parameters of raw RGBA pixels without canvas.
 */
export function adjustPixelsColor(
  pixels: Uint8ClampedArray,
  options: {
    contrast?: number;
    brightness?: number;
    grayscale?: number;
    invert?: boolean;
  }
): void {
  const { contrast = 100, brightness = 100, grayscale = 0, invert = false } = options;
  if (contrast === 100 && brightness === 100 && grayscale === 0 && !invert) {
    return;
  }

  const cFactor = contrast / 100;
  const bFactor = brightness / 100;
  const gFactor = grayscale / 100;

  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    if (bFactor !== 1) {
      r *= bFactor;
      g *= bFactor;
      b *= bFactor;
    }

    if (cFactor !== 1) {
      r = (r - 128) * cFactor + 128;
      g = (g - 128) * cFactor + 128;
      b = (b - 128) * cFactor + 128;
    }

    if (gFactor > 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = r * (1 - gFactor) + lum * gFactor;
      g = g * (1 - gFactor) + lum * gFactor;
      b = b * (1 - gFactor) + lum * gFactor;
    }

    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    pixels[i] = Math.min(255, Math.max(0, Math.round(r)));
    pixels[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    pixels[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
  }
}

/**
 * Applies binary thresholding to image pixel data.
 */
export function applySimpleThresholding(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
      const val = lum < threshold ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
  }
}

/**
 * Renders ASCII text into clean HTML, grouping adjacent characters with identical colors.
 */
export function renderColorHtml(lines: string[], colors: CharColor[][], backgroundColor = '#000000'): string {
  const safeBg = escapeHtml(backgroundColor);
  let html = `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${safeBg}; margin: 0; padding: 0;">`;

  for (let y = 0; y < lines.length; y++) {
    const lineChars = lines[y];
    const rowColors = colors[y] || [];

    let currentColor = '';
    let buffer = '';

    for (let x = 0; x < lineChars.length; x++) {
      const char = lineChars[x];
      const color = rowColors[x] ? `rgb(${rowColors[x].r},${rowColors[x].g},${rowColors[x].b})` : 'inherit';

      const escapedChar = escapeHtml(char);

      if (color !== currentColor) {
        if (buffer) {
          html += currentColor === 'inherit' ? buffer : `<span style="color:${currentColor}">${buffer}</span>`;
          buffer = '';
        }
        currentColor = color;
      }
      buffer += escapedChar;
    }

    if (buffer) {
      html += currentColor === 'inherit' ? buffer : `<span style="color:${currentColor}">${buffer}</span>`;
    }
    if (y < lines.length - 1) {
      html += '\n';
    }
  }

  html += '</pre>';
  return html;
}

/**
 * Renders ASCII art (monochrome or colored) to an HTML5 Canvas element.
 */
export function asciiToCanvas(
  ascii: string,
  colors?: CharColor[][],
  fontSize = 12,
  bg = '#000000',
  fg = '#ffffff'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const lines = ascii.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const maxLineLength = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const lineHeight = fontSize;
  ctx.font = `${fontSize}px monospace`;
  const charWidth = ctx.measureText('M').width || fontSize * 0.6;

  canvas.width = Math.ceil(maxLineLength * charWidth);
  canvas.height = Math.ceil(lines.length * lineHeight);

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const rowColors = colors?.[y];

    if (rowColors && rowColors.length > 0) {
      for (let x = 0; x < line.length; x++) {
        const c = rowColors[x] || { r: 255, g: 255, b: 255 };
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        ctx.fillText(line[x], x * charWidth, y * lineHeight);
      }
    } else {
      ctx.fillStyle = fg;
      ctx.fillText(line, 0, y * lineHeight);
    }
  }

  return canvas;
}

/**
 * Downloads a Blob as a file with a specified filename in browser environments.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || !window.document) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies text to the system clipboard using the modern Clipboard API with fallback.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Loads an image from a URL with crossOrigin anonymous.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image from URL: ${e}`));
    img.src = url;
  });
}

/**
 * Escapes characters for safe inclusion in XML/SVG documents.
 */
export function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&apos;';
      default: return m;
    }
  });
}

/**
 * Escapes characters for safe inclusion in HTML documents and attributes.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      default: return m;
    }
  });
}

/**
 * Converts ASCII text (and optional character colors) into a scalable, responsive SVG string.
 */
export function asciiToSvg(
  ascii: string,
  colors?: CharColor[][],
  fontSize = 12,
  bg = '#000000',
  fg = '#ffffff'
): string {
  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12;
  const safeBg = escapeXml(bg);
  const safeFg = escapeXml(fg);

  const lines = ascii.split('\n');
  const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
  const charWidth = safeFontSize * 0.6;
  const lineHeight = safeFontSize;
  const svgWidth = Math.ceil(maxLineLength * charWidth);
  const svgHeight = Math.ceil(lines.length * lineHeight);

  const textLines: string[] = [];

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const yPos = (y + 0.85) * lineHeight;

    if (!colors || !colors[y]) {
      // Monochrome line
      textLines.push(
        `    <text x="0" y="${yPos.toFixed(2)}" fill="${safeFg}" xml:space="preserve">${escapeXml(line)}</text>`
      );
    } else {
      // Color mode line with consecutive color grouping
      const rowColors = colors[y];
      let tspanBuffer = '';
      let currentColor = '';
      let currentText = '';

      for (let x = 0; x < line.length; x++) {
        const char = line[x];
        const color = rowColors[x] || { r: 255, g: 255, b: 255 };
        const colorStr = `rgb(${color.r},${color.g},${color.b})`;

        if (colorStr === currentColor) {
          currentText += char;
        } else {
          if (currentText.length > 0) {
            tspanBuffer += `<tspan fill="${currentColor}">${escapeXml(currentText)}</tspan>`;
          }
          currentColor = colorStr;
          currentText = char;
        }
      }

      if (currentText.length > 0) {
        tspanBuffer += `<tspan fill="${currentColor}">${escapeXml(currentText)}</tspan>`;
      }

      textLines.push(
        `    <text x="0" y="${yPos.toFixed(2)}" xml:space="preserve">${tspanBuffer}</text>`
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`,
    `  <rect width="100%" height="100%" fill="${safeBg}"/>`,
    `  <g font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" font-size="${safeFontSize}px" letter-spacing="0">`,
    textLines.join('\n'),
    `  </g>`,
    `</svg>`
  ].join('\n');
}
