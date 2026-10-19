/**
 * Options for ASCII art generation
 */
export type DitheringMode = 'none' | 'floyd-steinberg' | 'atkinson' | 'jjn' | 'stucki';
export type ColorMode = 'monochrome' | 'color';

export type CharsetPreset =
  | 'minimalist'
  | 'normal'
  | 'normal2'
  | 'alphabetic'
  | 'alphanumeric'
  | 'numerical'
  | 'extended'
  | 'math'
  | 'arrow'
  | 'grayscale'
  | 'max'
  | 'codepage437'
  | 'blockelement'
  | 'braille';

export interface CharColor {
  r: number;
  g: number;
  b: number;
}

export interface AsciiArtOptions {
  /** Width of the output ASCII art (in characters). Default: 100 */
  width?: number;
  /** Height of the output ASCII art (in characters). Default: auto-calculated */
  height?: number;
  /**
   * Character set to use, either a preset name or a custom string ordered from darkest to lightest.
   * Presets: 'minimalist', 'normal', 'normal2', 'alphabetic', 'alphanumeric', 'numerical',
   * 'extended', 'math', 'arrow', 'grayscale', 'max', 'codepage437', 'blockelement', 'braille'.
   * Default: 'normal'
   */
  charset?: CharsetPreset | string;
  /** Dithering algorithm to diffuse quantization error and create smooth shading. Default: 'none' */
  dithering?: DitheringMode;
  /** Color mode: 'monochrome' returns plain ASCII, 'color' generates HTML with styled spans. Default: 'monochrome' */
  colorMode?: ColorMode;
  /** Whether to invert the brightness. Default: false */
  invert?: boolean;
  /** Contrast percentage (0 to 200, where 100 is normal). Default: 100 */
  contrast?: number;
  /** Brightness percentage (0 to 200, where 100 is normal). Default: 100 */
  brightness?: number;
  /** Saturation percentage (0 to 400, where 100 is normal). Default: 100 */
  saturation?: number;
  /** Hue adjustment in degrees (0 to 360). Default: 0 */
  hue?: number;
  /** Grayscale filter percentage (0 to 100). Default: 0 */
  grayscale?: number;
  /** Sepia filter percentage (0 to 100). Default: 0 */
  sepia?: number;
  /** Whether to apply 3x3 unsharp mask / convolution sharpening. Default: false */
  useSharpen?: boolean;
  /** Sharpen intensity (1 to 20, center weight). Default: 9 */
  sharpness?: number;
  /** Whether to apply Sobel edge detection to accentuate outlines. Default: false */
  useEdgeDetection?: boolean;
  /** Sobel edge intensity multiplier (0 to 2). Default: 1 */
  edgeIntensity?: number;
  /** Whether to invert edge colors (dark edges vs light edges). Default: true */
  invertEdgeColors?: boolean;
  /** Whether to apply hard binary thresholding. Default: false */
  useThreshold?: boolean;
  /** Threshold luminance cutoff offset (0 to 255). Default: 128 */
  thresholdOffset?: number;
  /**
   * Space density (number of blank trailing spaces added to the light end of the charset).
   * Prevents noisy punctuation marks in backgrounds and highlights. Default: 1
   */
  spaceDensity?: number;
  /** Transparent frame / border padding around the image. Default: 0 */
  transparentFrame?: number;
  /** Whether to preserve aspect ratio. Default: true */
  preserveAspectRatio?: boolean;
  /** Background color for transparent images or canvas export (e.g. '#000000'). Default: '#000000' */
  backgroundColor?: string;
  /** Foreground font color for monochrome canvas/HTML export. Default: '#ffffff' */
  textColor?: string;
  /** Aspect ratio of the monospace font (width/height). Default: ~0.55 */
  fontAspectRatio?: number;
}

/**
 * Represents the result of ASCII art conversion
 */
export interface AsciiArtResult {
  /** The plain text ASCII art */
  ascii: string;
  /** The HTML representation (with colored spans if colorMode is 'color') */
  html: string;
  /** The width of the ASCII art in characters */
  width: number;
  /** The height of the ASCII art in characters */
  height: number;
  /** The character set used for the conversion */
  charset: string;
  /** Grid of colors per character if colorMode is 'color' */
  colors?: CharColor[][];
  /** Copy the plain ASCII art to the system clipboard */
  copyToClipboard(): Promise<void>;
  /** Trigger a browser download of the ASCII art as a .txt file */
  saveAsText(filename?: string): void;
  /** Render the ASCII art onto a Canvas and trigger download as a PNG image */
  saveAsPng(filename?: string, fontSize?: number, bg?: string, fg?: string): void;
  /** Render the ASCII art onto a Canvas and return a data URL */
  toPngDataUrl(fontSize?: number, bg?: string, fg?: string): string;
  /** Render the ASCII art onto a Canvas and return a Blob */
  toPngBlob(fontSize?: number, bg?: string, fg?: string): Promise<Blob>;
}
