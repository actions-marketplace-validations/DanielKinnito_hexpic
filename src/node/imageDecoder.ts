import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const MAX_IMAGE_BUFFER_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapixels (e.g. 5000x5000)
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000; // 15 seconds

function validateImageDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions: ${width}x${height}`);
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error(
      `Image dimensions (${width}x${height} = ${width * height} pixels) exceed safety limit of ${MAX_IMAGE_PIXELS} pixels to prevent memory exhaustion.`
    );
  }
}

/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
export function decodeImageBuffer(buffer: Buffer): DecodedImage {
  if (buffer.length > MAX_IMAGE_BUFFER_BYTES) {
    throw new Error(`Image buffer (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 25MB.`);
  }

  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    try {
      const png = PNG.sync.read(buffer);
      validateImageDimensions(png.width, png.height);
      return {
        data: new Uint8ClampedArray(png.data),
        width: png.width,
        height: png.height
      };
    } catch (err: any) {
      throw new Error(`Failed to decode PNG image: ${err?.message || err}`);
    }
  }

  // Check JPEG signature: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    try {
      const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      validateImageDimensions(decoded.width, decoded.height);
      return {
        data: new Uint8ClampedArray(decoded.data),
        width: decoded.width,
        height: decoded.height
      };
    } catch (err: any) {
      throw new Error(`Failed to decode JPEG image: ${err?.message || err}`);
    }
  }

  // Fallback try PNG
  try {
    const png = PNG.sync.read(buffer);
    validateImageDimensions(png.width, png.height);
    return {
      data: new Uint8ClampedArray(png.data),
      width: png.width,
      height: png.height
    };
  } catch {
    // Fallback try JPEG
    try {
      const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      validateImageDimensions(decoded.width, decoded.height);
      return {
        data: new Uint8ClampedArray(decoded.data),
        width: decoded.width,
        height: decoded.height
      };
    } catch {
      throw new Error('Unsupported or corrupted image format. Expected PNG or JPEG buffer.');
    }
  }
}

/**
 * Resolves an image input string (file path, data URI, or URL) into a raw Buffer.
 */
export async function resolveImageSource(source: string): Promise<Buffer> {
  const trimmed = source.trim();

  // 1. Data URI
  if (trimmed.startsWith('data:')) {
    const matches = trimmed.match(/^data:image\/[a-zA-Z+.-]+;base64,(.+)$/);
    if (!matches || !matches[1]) {
      throw new Error('Invalid data URI format. Expected "data:image/<type>;base64,<data>".');
    }
    if (matches[1].length > MAX_IMAGE_BUFFER_BYTES * 1.4) {
      throw new Error('Data URI payload exceeds maximum allowed size of 25MB.');
    }
    return Buffer.from(matches[1], 'base64');
  }

  // 2. HTTP(S) URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(trimmed, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
      }
      const contentLength = res.headers?.get ? res.headers.get('content-length') : null;
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BUFFER_BYTES) {
        throw new Error(`Remote image (${contentLength} bytes) exceeds maximum allowed size of 25MB.`);
      }
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > MAX_IMAGE_BUFFER_BYTES) {
        throw new Error(`Remote image (${arrayBuf.byteLength} bytes) exceeds maximum allowed size of 25MB.`);
      }
      return Buffer.from(arrayBuf);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Image fetch request timed out after ${DEFAULT_FETCH_TIMEOUT_MS / 1000} seconds.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // 3. Local file path
  const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Local image file does not exist (not found) at path: "${trimmed}" (resolved to: "${resolvedPath}")`);
  }

  const stat = await fs.promises.stat(resolvedPath);
  if (stat.size > MAX_IMAGE_BUFFER_BYTES) {
    throw new Error(`Local image file (${(stat.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 25MB.`);
  }

  return fs.promises.readFile(resolvedPath);
}

