export interface DecodedImage {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
export declare const MAX_IMAGE_BUFFER_BYTES: number;
export declare const MAX_IMAGE_PIXELS = 25000000;
export declare const DEFAULT_FETCH_TIMEOUT_MS = 15000;
/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
export declare function decodeImageBuffer(buffer: Buffer): DecodedImage;
/**
 * Resolves an image input string (file path, data URI, or URL) into a raw Buffer.
 */
export declare function resolveImageSource(source: string): Promise<Buffer>;
//# sourceMappingURL=imageDecoder.d.ts.map