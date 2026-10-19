import { AsciiArtOptions, AsciiArtResult } from './types';
/**
 * Main engine for converting images to studio-quality ASCII art
 */
export declare class HexPic {
    private options;
    private canvas;
    private ctx;
    /**
     * Creates a new HexPic instance
     * @param options Optional configuration options
     */
    constructor(options?: AsciiArtOptions);
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
}
export default HexPic;
//# sourceMappingURL=HexPic.d.ts.map