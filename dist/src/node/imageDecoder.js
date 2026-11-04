import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
export function decodeImageBuffer(buffer) {
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47) {
        try {
            const png = PNG.sync.read(buffer);
            return {
                data: new Uint8ClampedArray(png.data),
                width: png.width,
                height: png.height
            };
        }
        catch (err) {
            throw new Error(`Failed to decode PNG image: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
    }
    // Check JPEG signature: FF D8 FF
    if (buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff) {
        try {
            const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
            return {
                data: new Uint8ClampedArray(decoded.data),
                width: decoded.width,
                height: decoded.height
            };
        }
        catch (err) {
            throw new Error(`Failed to decode JPEG image: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
    }
    // Fallback try PNG
    try {
        const png = PNG.sync.read(buffer);
        return {
            data: new Uint8ClampedArray(png.data),
            width: png.width,
            height: png.height
        };
    }
    catch (_a) {
        // Fallback try JPEG
        try {
            const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
            return {
                data: new Uint8ClampedArray(decoded.data),
                width: decoded.width,
                height: decoded.height
            };
        }
        catch (_b) {
            throw new Error('Unsupported or corrupted image format. Expected PNG or JPEG buffer.');
        }
    }
}
/**
 * Resolves an image input string (file path, data URI, or URL) into a raw Buffer.
 */
export async function resolveImageSource(source) {
    const trimmed = source.trim();
    // 1. Data URI
    if (trimmed.startsWith('data:')) {
        const matches = trimmed.match(/^data:image\/[a-zA-Z+.-]+;base64,(.+)$/);
        if (!matches || !matches[1]) {
            throw new Error('Invalid data URI format. Expected "data:image/<type>;base64,<data>".');
        }
        return Buffer.from(matches[1], 'base64');
    }
    // 2. HTTP(S) URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const res = await fetch(trimmed);
        if (!res.ok) {
            throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
        }
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
    }
    // 3. Local file path
    const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Local image file does not exist at path: "${trimmed}" (resolved to: "${resolvedPath}")`);
    }
    return fs.promises.readFile(resolvedPath);
}
//# sourceMappingURL=imageDecoder.js.map