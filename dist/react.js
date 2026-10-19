import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HexPic } from './HexPic';
/**
 * React hook for converting images to ASCII art with full algorithmic controls
 */
export function useHexPic(defaultOptions = {}) {
    var _a, _b, _c, _d;
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const optionsRef = useRef(defaultOptions);
    useEffect(() => {
        optionsRef.current = defaultOptions;
    }, [defaultOptions]);
    const convert = useCallback(async (source, options) => {
        setIsLoading(true);
        setError(null);
        try {
            const mergedOptions = { ...optionsRef.current, ...options };
            const hexpic = new HexPic(mergedOptions);
            let res;
            if (typeof source === 'string') {
                res = await hexpic.fromUrl(source);
            }
            else if (source instanceof File) {
                res = await hexpic.fromFile(source);
            }
            else {
                res = await hexpic.fromImageElement(source);
            }
            setResult(res);
        }
        catch (err) {
            console.error('useHexPic: conversion failed', err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setResult(null);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const copyToClipboard = useCallback(async () => {
        if (result) {
            await result.copyToClipboard();
        }
    }, [result]);
    const saveAsText = useCallback((filename) => {
        if (result) {
            result.saveAsText(filename);
        }
    }, [result]);
    const saveAsPng = useCallback((filename, fontSize) => {
        if (result) {
            result.saveAsPng(filename, fontSize);
        }
    }, [result]);
    return {
        ascii: (_a = result === null || result === void 0 ? void 0 : result.ascii) !== null && _a !== void 0 ? _a : '',
        html: (_b = result === null || result === void 0 ? void 0 : result.html) !== null && _b !== void 0 ? _b : '',
        width: (_c = result === null || result === void 0 ? void 0 : result.width) !== null && _c !== void 0 ? _c : 0,
        height: (_d = result === null || result === void 0 ? void 0 : result.height) !== null && _d !== void 0 ? _d : 0,
        result,
        isLoading,
        error,
        convert,
        copyToClipboard,
        saveAsText,
        saveAsPng
    };
}
/**
 * Ready-to-use React component that automatically transforms an image into ASCII art.
 */
export const HexPicImage = ({ src, alt, options, style, ...props }) => {
    const { ascii, html, isLoading, error, convert } = useHexPic(options);
    useEffect(() => {
        if (src) {
            convert(src);
        }
    }, [src, convert, JSON.stringify(options)]);
    if (error) {
        return (React.createElement("div", { style: { color: 'red', ...style }, ...props }, "Error generating ASCII art"));
    }
    if (isLoading) {
        return (React.createElement("div", { style: { fontFamily: 'monospace', ...style }, ...props }, "Loading ASCII art..."));
    }
    if ((options === null || options === void 0 ? void 0 : options.colorMode) === 'color' && html) {
        return (React.createElement("div", { style: {
                fontFamily: 'monospace',
                overflow: 'hidden',
                ...style
            }, "aria-label": alt || 'ASCII Art', role: "img", dangerouslySetInnerHTML: { __html: html }, ...props }));
    }
    return (React.createElement("div", { style: {
            fontFamily: 'monospace',
            whiteSpace: 'pre',
            lineHeight: '1em',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            fontSize: '10px',
            ...style
        }, "aria-label": alt || 'ASCII Art', role: "img", ...props }, ascii));
};
//# sourceMappingURL=react.js.map