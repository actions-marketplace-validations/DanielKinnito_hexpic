import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HexPic } from './HexPic';
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
export function useHexPic(defaultOptions: AsciiArtOptions = {}): UseHexPicResult {
  const [result, setResult] = useState<AsciiArtResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef(defaultOptions);

  useEffect(() => {
    optionsRef.current = defaultOptions;
  }, [defaultOptions]);

  const convert = useCallback(async (source: string | File | HTMLImageElement, options?: AsciiArtOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      const mergedOptions = { ...optionsRef.current, ...options };
      const hexpic = new HexPic(mergedOptions);

      let res: AsciiArtResult;
      if (typeof source === 'string') {
        res = await hexpic.fromUrl(source);
      } else if (source instanceof File) {
        res = await hexpic.fromFile(source);
      } else {
        res = await hexpic.fromImageElement(source);
      }

      setResult(res);
    } catch (err) {
      console.error('useHexPic: conversion failed', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (result) {
      await result.copyToClipboard();
    }
  }, [result]);

  const saveAsText = useCallback((filename?: string) => {
    if (result) {
      result.saveAsText(filename);
    }
  }, [result]);

  const saveAsPng = useCallback((filename?: string, fontSize?: number) => {
    if (result) {
      result.saveAsPng(filename, fontSize);
    }
  }, [result]);

  return {
    ascii: result?.ascii ?? '',
    html: result?.html ?? '',
    width: result?.width ?? 0,
    height: result?.height ?? 0,
    result,
    isLoading,
    error,
    convert,
    copyToClipboard,
    saveAsText,
    saveAsPng
  };
}

export interface HexPicImageProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt?: string;
  options?: AsciiArtOptions;
}

/**
 * Ready-to-use React component that automatically transforms an image into ASCII art.
 */
export const HexPicImage: React.FC<HexPicImageProps> = ({
  src,
  alt,
  options,
  style,
  ...props
}) => {
  const { ascii, html, isLoading, error, convert } = useHexPic(options);

  useEffect(() => {
    if (src) {
      convert(src);
    }
  }, [src, convert, JSON.stringify(options)]);

  if (error) {
    return (
      <div style={{ color: 'red', ...style }} {...props}>
        Error generating ASCII art
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'monospace', ...style }} {...props}>
        Loading ASCII art...
      </div>
    );
  }

  if (options?.colorMode === 'color' && html) {
    return (
      <div
        style={{
          fontFamily: 'monospace',
          overflow: 'hidden',
          ...style
        }}
        aria-label={alt || 'ASCII Art'}
        role="img"
        dangerouslySetInnerHTML={{ __html: html }}
        {...props}
      />
    );
  }

  return (
    <div
      style={{
        fontFamily: 'monospace',
        whiteSpace: 'pre',
        lineHeight: '1em',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontSize: '10px',
        ...style
      }}
      aria-label={alt || 'ASCII Art'}
      role="img"
      {...props}
    >
      {ascii}
    </div>
  );
};
