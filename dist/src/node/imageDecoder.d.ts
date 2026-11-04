export interface DecodedImage {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}
/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
export declare function decodeImageBuffer(buffer: Buffer): DecodedImage;
/**
 * Resolves an image input string (file path, data URI, or URL) into a raw Buffer.
 */
export declare function resolveImageSource(source: string): Promise<Buffer>;
//# sourceMappingURL=imageDecoder.d.ts.map