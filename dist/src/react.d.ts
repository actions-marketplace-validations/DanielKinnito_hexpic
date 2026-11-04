import React from 'react';
import { AsciiArtOptions, AsciiArtResult } from './types';
export interface UseHexPicResult {
    ascii: string;
    html: string;
    width: number;
    height: number;
    result: AsciiArtResult | null;
    isLoading: boolean;
    error: Error | null;
    convert: (source: string | File | HTMLImageElement, options?: AsciiArtOptions) => Promise<void>;
    copyToClipboard: () => Promise<void>;
    saveAsText: (filename?: string) => void;
    saveAsPng: (filename?: string, fontSize?: number) => void;
}
/**
 * React hook for converting images to ASCII art with full algorithmic controls
 */
export declare function useHexPic(defaultOptions?: AsciiArtOptions): UseHexPicResult;
export interface HexPicImageProps extends React.HTMLAttributes<HTMLDivElement> {
    src: string;
    alt?: string;
    options?: AsciiArtOptions;
}
/**
 * Ready-to-use React component that automatically transforms an image into ASCII art.
 */
export declare const HexPicImage: React.FC<HexPicImageProps>;
//# sourceMappingURL=react.d.ts.map