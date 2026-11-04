import { AsciiArtOptions, AsciiArtResult } from './types';
/**
 * Main engine for converting images to studio-quality ASCII art
 */
export declare class HexPic {
    private options;
    private canvas?;
    private ctx?;
    /**
     * Creates a new HexPic instance
     * @param options Optional configuration options
     */
    constructor(options?: AsciiArtOptions);
    private ensureCanvas;
    /**
     * Updates options for ASCII art generation
     */
    setOptions(options: AsciiArtOptions): void;
    /**
     * Gets a copy of the current configuration options
     */
    getOptions(): Required<AsciiArtOptions>;
    /**
     * Converts an HTMLImageElement to ASCII art
     */
    fromImageElement(image: HTMLImageElement, options?: AsciiArtOptions): Promise<AsciiArtResult>;
    /**
     * Converts an image URL to ASCII art
     */
    fromUrl(url: string, options?: AsciiArtOptions): Promise<AsciiArtResult>;
    /**
     * Converts a File object to ASCII art
     */
    fromFile(file: File, options?: AsciiArtOptions): Promise<AsciiArtResult>;
    /**
     * Automatically scans the DOM for elements with data-hexpic and renders ASCII art into them.
     */
    static init(selector?: string): Promise<void>;
    /**
     * Internal processing pipeline: Pre-filtering -> Spatial Convolution -> Dithering -> ASCII Quantization
     */
    private convertImage;
    /**
     * Converts a raw RGBA pixel buffer directly to ASCII art without requiring a browser DOM or Canvas.
     * Ideal for Node.js servers, Web Workers, and MCP tool execution.
     */
    fromPixels(pixels: Uint8ClampedArray | Uint8Array, sourceWidth: number, sourceHeight: number, options?: AsciiArtOptions): AsciiArtResult;
    /**
     * Internal pixel processing pipeline: Binary thresholding -> Luminance matrix -> Error-diffusion dithering -> ASCII quantization
     */
    processPixelData(data: Uint8ClampedArray | Uint8Array, canvasWidth: number, canvasHeight: number, currentOptions: Required<AsciiArtOptions>): AsciiArtResult;
}
export default HexPic;
//# sourceMappingURL=HexPic.d.ts.map