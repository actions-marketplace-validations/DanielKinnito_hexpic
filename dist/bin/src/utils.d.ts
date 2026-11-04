import { CharColor } from './types';
/**
 * Built-in character sets for ASCII art, ordered from darkest to lightest.
 */
export declare const CHARSET_PRESETS: Record<string, string>;
export declare const DEFAULT_CHARSET = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
/**
 * Resolves a charset identifier (preset name or custom string) and applies space density padding.
 */
export declare function resolveCharset(charset?: string, spaceDensity?: number): string;
/**
 * Converts an RGB value to perceived luminance (Rec. 709).
 */
export declare function rgbToGrayscale(r: number, g: number, b: number): number;
/**
 * Adjusts the contrast of a luminance value around mid-gray (128).
 */
export declare function adjustContrast(value: number, contrast: number): number;
/**
 * Adjusts the brightness of a luminance value.
 */
export declare function adjustBrightness(value: number, brightness: number): number;
/**
 * Maps a brightness value [0, 255] to an ASCII character from the resolved charset.
 */
export declare function getAsciiChar(brightness: number, charset: string, gamma?: number): string;
/**
 * Applies Sobel 3x3 convolution to a raw RGBA pixel buffer to accentuate outlines.
 */
export declare function applyEdgeDetectionToPixels(src: Uint8ClampedArray | Uint8Array, width: number, height: number, intensity: number, invertColors?: boolean): Uint8ClampedArray;
/**
 * Applies a 3x3 Sobel convolution filter to emphasize visual edges and outlines.
 */
export declare function applyEdgeDetection(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, invertColors?: boolean): void;
/**
 * Applies a 3x3 unsharp convolution sharpening kernel to raw RGBA pixel data.
 */
export declare function applySharpenToPixels(src: Uint8ClampedArray | Uint8Array, width: number, height: number, sharpness: number): Uint8ClampedArray;
/**
 * Applies a 3x3 unsharp convolution sharpening kernel to make fine details pop.
 */
export declare function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, sharpness: number): void;
/**
 * Resamples an RGBA pixel buffer to target dimensions.
 */
export declare function resamplePixels(src: Uint8ClampedArray | Uint8Array, srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Uint8ClampedArray;
/**
 * Adjusts color parameters of raw RGBA pixels without canvas.
 */
export declare function adjustPixelsColor(pixels: Uint8ClampedArray, options: {
    contrast?: number;
    brightness?: number;
    grayscale?: number;
    invert?: boolean;
}): void;
/**
 * Applies binary thresholding to image pixel data.
 */
export declare function applySimpleThresholding(data: Uint8ClampedArray, width: number, height: number, threshold: number): void;
/**
 * Renders ASCII text into clean HTML, grouping adjacent characters with identical colors.
 */
export declare function renderColorHtml(lines: string[], colors: CharColor[][], backgroundColor?: string): string;
/**
 * Renders ASCII art (monochrome or colored) to an HTML5 Canvas element.
 */
export declare function asciiToCanvas(ascii: string, colors?: CharColor[][], fontSize?: number, bg?: string, fg?: string): HTMLCanvasElement;
/**
 * Downloads a Blob as a file with a specified filename in browser environments.
 */
export declare function downloadBlob(blob: Blob, filename: string): void;
/**
 * Copies text to the system clipboard using the modern Clipboard API with fallback.
 */
export declare function copyTextToClipboard(text: string): Promise<void>;
/**
 * Loads an image from a URL with crossOrigin anonymous.
 */
export declare function loadImage(url: string): Promise<HTMLImageElement>;
/**
 * Converts ASCII text (and optional character colors) into a scalable, responsive SVG string.
 */
export declare function asciiToSvg(ascii: string, colors?: CharColor[][], fontSize?: number, bg?: string, fg?: string): string;
//# sourceMappingURL=utils.d.ts.map