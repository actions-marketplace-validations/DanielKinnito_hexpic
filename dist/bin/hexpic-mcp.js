#!/usr/bin/env node

'use strict';

var stdio_js = require('@modelcontextprotocol/sdk/server/stdio.js');
var mcp_js = require('@modelcontextprotocol/sdk/server/mcp.js');
var zod = require('zod');
var fs = require('fs');
var path = require('path');
var pngjs = require('pngjs');
var jpeg = require('jpeg-js');

/**
 * Built-in character sets for ASCII art, ordered from darkest to lightest.
 */
const CHARSET_PRESETS = {
    minimalist: '#+-.',
    normal: '@%#*+=-:.',
    normal2: '&$Xx+;:.',
    alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz',
    numerical: '0896452317',
    extended: '@%#{}[]()<>^*+=~-:.',
    math: '+-×÷=≠≈∞√π',
    arrow: '↑↗→↘↓↙←↖',
    grayscale: '@$BWM#*oahkbdpwmZO0QCJYXzcvnxrjft/|()1{}[]-_+~<>i!lI;:,"^`\'.',
    max: 'ÆÑÊŒØMÉËÈÃÂWQBCæ#NÁþEÄÀHKRŽœXgÐêqÛŠÕÔA€ßpmãâG¶øðé8ÚÜ$ëdÙýèÓÞÖåÿÒb¥FDñáZPäšÇàhû§ÝkŸ®S9žUTe6µOyxÎ¾f4õ5ôú&aü™2ùçw©Y£0VÍL±3ÏÌóC@nöòs¢u‰½¼‡zJƒ%¤Itocîrjv1líd=ïì<>i7†[¿?×}*{+()/»«•¬|!¡÷¦¯—^ª„”“~³º²–°­¹‹›;:’‘‚’˜ˆ¸…·¨´`',
    codepage437: '█▓▒░',
    blockelement: '█▀▄▌▐░▒▓',
    braille: '⣿⣶⣤⣀ '
};
/**
 * Resolves a charset identifier (preset name or custom string) and applies space density padding.
 */
function resolveCharset(charset, spaceDensity = 1) {
    let base = CHARSET_PRESETS.normal;
    if (charset && typeof charset === 'string') {
        if (Object.prototype.hasOwnProperty.call(CHARSET_PRESETS, charset)) {
            base = CHARSET_PRESETS[charset];
        }
        else if (charset.length > 0) {
            base = charset;
        }
    }
    const padding = spaceDensity > 0 ? ' '.repeat(spaceDensity) : '';
    return base + padding;
}
/**
 * Converts an RGB value to perceived luminance (Rec. 709).
 */
function rgbToGrayscale(r, g, b) {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}
/**
 * Maps a brightness value [0, 255] to an ASCII character from the resolved charset.
 */
function getAsciiChar(brightness, charset, gamma = 1.5) {
    const clamped = Math.min(255, Math.max(0, brightness));
    const normalized = clamped / 255;
    const adjusted = gamma === 1 ? normalized : Math.pow(normalized, gamma);
    const index = Math.floor(adjusted * (charset.length - 1));
    return charset[Math.min(Math.max(index, 0), charset.length - 1)];
}
/**
 * Applies Sobel 3x3 convolution to a raw RGBA pixel buffer to accentuate outlines.
 */
function applyEdgeDetectionToPixels(src, width, height, intensity, invertColors = true) {
    const output = new Uint8ClampedArray(src.length);
    const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                output[idx] = output[idx + 1] = output[idx + 2] = invertColors ? 255 : 0;
                output[idx + 3] = 255;
                continue;
            }
            let gx = 0;
            let gy = 0;
            for (let kyIdx = -1; kyIdx <= 1; kyIdx++) {
                for (let kxIdx = -1; kxIdx <= 1; kxIdx++) {
                    const pixelIdx = ((y + kyIdx) * width + (x + kxIdx)) * 4;
                    const lum = 0.2126 * src[pixelIdx] + 0.7152 * src[pixelIdx + 1] + 0.0722 * src[pixelIdx + 2];
                    const kPos = (kyIdx + 1) * 3 + (kxIdx + 1);
                    gx += lum * kx[kPos];
                    gy += lum * ky[kPos];
                }
            }
            const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * intensity);
            const val = invertColors ? 255 - mag : mag;
            output[idx] = val;
            output[idx + 1] = val;
            output[idx + 2] = val;
            output[idx + 3] = src[idx + 3];
        }
    }
    return output;
}
/**
 * Applies a 3x3 Sobel convolution filter to emphasize visual edges and outlines.
 */
function applyEdgeDetection(ctx, width, height, intensity, invertColors = true) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const output = applyEdgeDetectionToPixels(imgData.data, width, height, intensity, invertColors);
    putImageDataSafe(ctx, output, width, height);
}
/**
 * Helper to write pixels to canvas safely across browser and test environments
 */
function putImageDataSafe(ctx, data, width, height) {
    try {
        let imgData;
        if (typeof ctx.createImageData === 'function') {
            imgData = ctx.createImageData(width, height);
            imgData.data.set(data);
        }
        else if (typeof globalThis.ImageData !== 'undefined') {
            imgData = new globalThis.ImageData(data, width, height);
        }
        else {
            imgData = { data, width, height };
        }
        if (typeof ctx.putImageData === 'function') {
            ctx.putImageData(imgData, 0, 0);
        }
    }
    catch (_a) {
        // Graceful fallback if mock environment does not support putImageData
    }
}
/**
 * Applies a 3x3 unsharp convolution sharpening kernel to raw RGBA pixel data.
 */
function applySharpenToPixels(src, width, height, sharpness) {
    const output = new Uint8ClampedArray(src.length);
    const kernel = [-1, -1, -1, -1, sharpness, -1, -1, -1, -1];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                output[idx] = src[idx];
                output[idx + 1] = src[idx + 1];
                output[idx + 2] = src[idx + 2];
                output[idx + 3] = src[idx + 3];
                continue;
            }
            let r = 0, g = 0, b = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
                    const kWeight = kernel[(ky + 1) * 3 + (kx + 1)];
                    r += src[pixelIdx] * kWeight;
                    g += src[pixelIdx + 1] * kWeight;
                    b += src[pixelIdx + 2] * kWeight;
                }
            }
            output[idx] = Math.min(255, Math.max(0, r));
            output[idx + 1] = Math.min(255, Math.max(0, g));
            output[idx + 2] = Math.min(255, Math.max(0, b));
            output[idx + 3] = src[idx + 3];
        }
    }
    return output;
}
/**
 * Applies a 3x3 unsharp convolution sharpening kernel to make fine details pop.
 */
function applySharpen(ctx, width, height, sharpness) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const output = applySharpenToPixels(imgData.data, width, height, sharpness);
    putImageDataSafe(ctx, output, width, height);
}
/**
 * Resamples an RGBA pixel buffer to target dimensions.
 */
function resamplePixels(src, srcWidth, srcHeight, dstWidth, dstHeight) {
    const dst = new Uint8ClampedArray(dstWidth * dstHeight * 4);
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;
    for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
            const srcX = Math.min(srcWidth - 1, Math.floor(x * xRatio));
            const srcY = Math.min(srcHeight - 1, Math.floor(y * yRatio));
            const srcIdx = (srcY * srcWidth + srcX) * 4;
            const dstIdx = (y * dstWidth + x) * 4;
            dst[dstIdx] = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
        }
    }
    return dst;
}
/**
 * Adjusts color parameters of raw RGBA pixels without canvas.
 */
function adjustPixelsColor(pixels, options) {
    const { contrast = 100, brightness = 100, grayscale = 0, invert = false } = options;
    if (contrast === 100 && brightness === 100 && grayscale === 0 && !invert) {
        return;
    }
    const cFactor = contrast / 100;
    const bFactor = brightness / 100;
    const gFactor = grayscale / 100;
    for (let i = 0; i < pixels.length; i += 4) {
        let r = pixels[i];
        let g = pixels[i + 1];
        let b = pixels[i + 2];
        if (bFactor !== 1) {
            r *= bFactor;
            g *= bFactor;
            b *= bFactor;
        }
        if (cFactor !== 1) {
            r = (r - 128) * cFactor + 128;
            g = (g - 128) * cFactor + 128;
            b = (b - 128) * cFactor + 128;
        }
        if (gFactor > 0) {
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = r * (1 - gFactor) + lum * gFactor;
            g = g * (1 - gFactor) + lum * gFactor;
            b = b * (1 - gFactor) + lum * gFactor;
        }
        if (invert) {
            r = 255 - r;
            g = 255 - g;
            b = 255 - b;
        }
        pixels[i] = Math.min(255, Math.max(0, Math.round(r)));
        pixels[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
        pixels[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
    }
}
/**
 * Applies binary thresholding to image pixel data.
 */
function applySimpleThresholding(data, width, height, threshold) {
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const lum = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
            const val = lum < threshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = val;
        }
    }
}
/**
 * Renders ASCII text into clean HTML, grouping adjacent characters with identical colors.
 */
function renderColorHtml(lines, colors, backgroundColor = '#000000') {
    let html = `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${backgroundColor}; margin: 0; padding: 0;">`;
    for (let y = 0; y < lines.length; y++) {
        const lineChars = lines[y];
        const rowColors = colors[y] || [];
        let currentColor = '';
        let buffer = '';
        for (let x = 0; x < lineChars.length; x++) {
            const char = lineChars[x];
            const color = rowColors[x] ? `rgb(${rowColors[x].r},${rowColors[x].g},${rowColors[x].b})` : 'inherit';
            const escapedChar = char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char;
            if (color !== currentColor) {
                if (buffer) {
                    html += currentColor === 'inherit' ? buffer : `<span style="color:${currentColor}">${buffer}</span>`;
                    buffer = '';
                }
                currentColor = color;
            }
            buffer += escapedChar;
        }
        if (buffer) {
            html += currentColor === 'inherit' ? buffer : `<span style="color:${currentColor}">${buffer}</span>`;
        }
        if (y < lines.length - 1) {
            html += '\n';
        }
    }
    html += '</pre>';
    return html;
}
/**
 * Renders ASCII art (monochrome or colored) to an HTML5 Canvas element.
 */
function asciiToCanvas(ascii, colors, fontSize = 12, bg = '#000000', fg = '#ffffff') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Could not get canvas context');
    const lines = ascii.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    const maxLineLength = lines.reduce((max, l) => Math.max(max, l.length), 0);
    const lineHeight = fontSize;
    ctx.font = `${fontSize}px monospace`;
    const charWidth = ctx.measureText('M').width || fontSize * 0.6;
    canvas.width = Math.ceil(maxLineLength * charWidth);
    canvas.height = Math.ceil(lines.length * lineHeight);
    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    for (let y = 0; y < lines.length; y++) {
        const line = lines[y];
        const rowColors = colors === null || colors === void 0 ? void 0 : colors[y];
        if (rowColors && rowColors.length > 0) {
            for (let x = 0; x < line.length; x++) {
                const c = rowColors[x] || { r: 255, g: 255, b: 255 };
                ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
                ctx.fillText(line[x], x * charWidth, y * lineHeight);
            }
        }
        else {
            ctx.fillStyle = fg;
            ctx.fillText(line, 0, y * lineHeight);
        }
    }
    return canvas;
}
/**
 * Downloads a Blob as a file with a specified filename in browser environments.
 */
function downloadBlob(blob, filename) {
    if (typeof window === 'undefined' || !window.document)
        return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
/**
 * Copies text to the system clipboard using the modern Clipboard API with fallback.
 */
async function copyTextToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        }
        finally {
            document.body.removeChild(textarea);
        }
    }
}
/**
 * Loads an image from a URL with crossOrigin anonymous.
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image from URL: ${e}`));
        img.src = url;
    });
}

/**
 * Default options for ASCII art generation
 */
const DEFAULT_OPTIONS = {
    width: 80,
    height: 40,
    charset: 'normal',
    dithering: 'none',
    colorMode: 'monochrome',
    invert: false,
    contrast: 100,
    brightness: 100,
    saturation: 100,
    hue: 0,
    grayscale: 0,
    sepia: 0,
    useSharpen: false,
    sharpness: 9,
    useEdgeDetection: false,
    edgeIntensity: 1,
    invertEdgeColors: true,
    useThreshold: false,
    thresholdOffset: 128,
    spaceDensity: 1,
    transparentFrame: 0,
    preserveAspectRatio: true,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontAspectRatio: 0.55
};
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            default: return '&#39;';
        }
    });
}
/**
 * Main engine for converting images to studio-quality ASCII art
 */
class HexPic {
    /**
     * Creates a new HexPic instance
     * @param options Optional configuration options
     */
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    ensureCanvas() {
        if (!this.canvas || !this.ctx) {
            if (typeof document === 'undefined') {
                throw new Error('Canvas rendering is not supported in a headless environment. Use fromPixels() instead.');
            }
            this.canvas = document.createElement('canvas');
            const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                throw new Error('Could not create canvas context');
            }
            this.ctx = ctx;
        }
        return { canvas: this.canvas, ctx: this.ctx };
    }
    /**
     * Updates options for ASCII art generation
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
    /**
     * Gets a copy of the current configuration options
     */
    getOptions() {
        return { ...this.options };
    }
    /**
     * Converts an HTMLImageElement to ASCII art
     */
    async fromImageElement(image, options) {
        return this.convertImage(image, options);
    }
    /**
     * Converts an image URL to ASCII art
     */
    async fromUrl(url, options) {
        const image = await loadImage(url);
        return this.convertImage(image, options);
    }
    /**
     * Converts a File object to ASCII art
     */
    fromFile(file, options) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                var _a;
                try {
                    if (!((_a = e.target) === null || _a === void 0 ? void 0 : _a.result)) {
                        throw new Error('Failed to read file');
                    }
                    const image = new Image();
                    image.onload = async () => {
                        try {
                            const result = await this.convertImage(image, options);
                            resolve(result);
                        }
                        catch (err) {
                            reject(err);
                        }
                    };
                    image.onerror = () => reject(new Error('Failed to load image from file'));
                    image.src = e.target.result;
                }
                catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    /**
     * Automatically scans the DOM for elements with data-hexpic and renders ASCII art into them.
     */
    static async init(selector = '[data-hexpic]') {
        var _a;
        if (typeof document === 'undefined')
            return;
        const elements = document.querySelectorAll(selector);
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const src = el.getAttribute('src') || el.getAttribute('data-hexpic-src');
            if (!src)
                continue;
            const opts = {};
            if (el.dataset.hexpicWidth)
                opts.width = parseInt(el.dataset.hexpicWidth, 10);
            if (el.dataset.hexpicHeight)
                opts.height = parseInt(el.dataset.hexpicHeight, 10);
            if (el.dataset.hexpicCharset)
                opts.charset = el.dataset.hexpicCharset;
            if (el.dataset.hexpicDithering)
                opts.dithering = el.dataset.hexpicDithering;
            if (el.dataset.hexpicColorMode)
                opts.colorMode = el.dataset.hexpicColorMode;
            if (el.dataset.hexpicContrast)
                opts.contrast = parseFloat(el.dataset.hexpicContrast);
            if (el.dataset.hexpicBrightness)
                opts.brightness = parseFloat(el.dataset.hexpicBrightness);
            if (el.dataset.hexpicSharpen === 'true')
                opts.useSharpen = true;
            if (el.dataset.hexpicEdge === 'true')
                opts.useEdgeDetection = true;
            const hexpic = new HexPic(opts);
            try {
                const result = await hexpic.fromUrl(src);
                const container = document.createElement('div');
                container.className = 'hexpic-container';
                container.innerHTML = result.html;
                if (el.tagName.toLowerCase() === 'img') {
                    (_a = el.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(container, el);
                }
                else {
                    el.innerHTML = '';
                    el.appendChild(container);
                }
            }
            catch (err) {
                console.error('HexPic failed to render element:', el, err);
            }
        }
    }
    /**
     * Internal processing pipeline: Pre-filtering -> Spatial Convolution -> Dithering -> ASCII Quantization
     */
    async convertImage(image, options) {
        const currentOptions = { ...this.options, ...options };
        const { width: targetWidth, height: targetHeight, charset, dithering, colorMode, contrast, brightness, saturation, hue, grayscale, sepia, invert, useSharpen, sharpness, useEdgeDetection, edgeIntensity, invertEdgeColors, useThreshold, thresholdOffset, spaceDensity, transparentFrame, preserveAspectRatio, backgroundColor, textColor, fontAspectRatio } = currentOptions;
        // Calculate dimensions
        const isExplicitHeight = (options === null || options === void 0 ? void 0 : options.height) !== undefined && options.height > 0;
        let width = targetWidth;
        let height = isExplicitHeight ? targetHeight : 0;
        if (!preserveAspectRatio && isExplicitHeight) {
            width = targetWidth;
            height = targetHeight;
        }
        else {
            const imageAspect = (image.width || 1) / (image.height || 1);
            // Account for monospace character geometry (characters are taller than wide)
            const correctedAspect = imageAspect / fontAspectRatio;
            if (isExplicitHeight && preserveAspectRatio) {
                if (targetWidth / targetHeight > correctedAspect) {
                    width = Math.max(1, Math.floor(targetHeight * correctedAspect));
                    height = targetHeight;
                }
                else {
                    width = targetWidth;
                    height = Math.max(1, Math.floor(targetWidth / correctedAspect));
                }
            }
            else {
                width = targetWidth;
                height = Math.max(1, Math.floor(targetWidth / correctedAspect));
            }
        }
        const frame = Math.max(0, transparentFrame);
        const canvasWidth = width + 2 * frame;
        const canvasHeight = height + 2 * frame;
        const { canvas, ctx } = this.ensureCanvas();
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        // 1. Draw background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        // 2. Apply CSS color-grading filters before drawing image
        const filters = [];
        if (brightness !== 100)
            filters.push(`brightness(${brightness}%)`);
        if (contrast !== 100)
            filters.push(`contrast(${contrast}%)`);
        if (saturation !== 100)
            filters.push(`saturate(${saturation}%)`);
        if (hue !== 0)
            filters.push(`hue-rotate(${hue}deg)`);
        if (grayscale !== 0)
            filters.push(`grayscale(${grayscale}%)`);
        if (sepia !== 0)
            filters.push(`sepia(${sepia}%)`);
        if (invert)
            filters.push('invert(100%)');
        ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
        ctx.drawImage(image, frame, frame, width, height);
        ctx.filter = 'none';
        // 3. Spatial convolutions: Edge detection and sharpening
        if (useEdgeDetection) {
            applyEdgeDetection(ctx, canvasWidth, canvasHeight, edgeIntensity, invertEdgeColors);
        }
        if (useSharpen) {
            applySharpen(ctx, canvasWidth, canvasHeight, sharpness);
        }
        // 4. Retrieve pixel data
        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        return this.processPixelData(imgData.data, canvasWidth, canvasHeight, currentOptions);
    }
    /**
     * Converts a raw RGBA pixel buffer directly to ASCII art without requiring a browser DOM or Canvas.
     * Ideal for Node.js servers, Web Workers, and MCP tool execution.
     */
    fromPixels(pixels, sourceWidth, sourceHeight, options) {
        const currentOptions = { ...this.options, ...options };
        const { width: targetWidth, height: targetHeight, preserveAspectRatio, fontAspectRatio, transparentFrame, useEdgeDetection, edgeIntensity, invertEdgeColors, useSharpen, sharpness, contrast, brightness, grayscale, invert } = currentOptions;
        // Calculate dimensions
        const isExplicitHeight = (options === null || options === void 0 ? void 0 : options.height) !== undefined && options.height > 0;
        let width = targetWidth;
        let height = isExplicitHeight ? targetHeight : 0;
        if (!preserveAspectRatio && isExplicitHeight) {
            width = targetWidth;
            height = targetHeight;
        }
        else {
            const imageAspect = (sourceWidth || 1) / (sourceHeight || 1);
            const correctedAspect = imageAspect / fontAspectRatio;
            if (isExplicitHeight && preserveAspectRatio) {
                if (targetWidth / targetHeight > correctedAspect) {
                    width = Math.max(1, Math.floor(targetHeight * correctedAspect));
                    height = targetHeight;
                }
                else {
                    width = targetWidth;
                    height = Math.max(1, Math.floor(targetWidth / correctedAspect));
                }
            }
            else {
                width = targetWidth;
                height = Math.max(1, Math.floor(targetWidth / correctedAspect));
            }
        }
        const frame = Math.max(0, transparentFrame);
        const canvasWidth = width + 2 * frame;
        const canvasHeight = height + 2 * frame;
        // Resample pixels to target width & height
        let data = resamplePixels(pixels, sourceWidth, sourceHeight, width, height);
        // Apply frame padding if needed
        if (frame > 0) {
            const framed = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const srcIdx = (y * width + x) * 4;
                    const dstIdx = ((y + frame) * canvasWidth + (x + frame)) * 4;
                    framed[dstIdx] = data[srcIdx];
                    framed[dstIdx + 1] = data[srcIdx + 1];
                    framed[dstIdx + 2] = data[srcIdx + 2];
                    framed[dstIdx + 3] = data[srcIdx + 3];
                }
            }
            data = framed;
        }
        // Color grading adjustments
        adjustPixelsColor(data, { contrast, brightness, grayscale, invert });
        // Spatial convolution filters
        if (useEdgeDetection) {
            data = applyEdgeDetectionToPixels(data, canvasWidth, canvasHeight, edgeIntensity, invertEdgeColors);
        }
        if (useSharpen) {
            data = applySharpenToPixels(data, canvasWidth, canvasHeight, sharpness);
        }
        return this.processPixelData(data, canvasWidth, canvasHeight, currentOptions);
    }
    /**
     * Internal pixel processing pipeline: Binary thresholding -> Luminance matrix -> Error-diffusion dithering -> ASCII quantization
     */
    processPixelData(data, canvasWidth, canvasHeight, currentOptions) {
        const { charset, dithering, colorMode, useThreshold, thresholdOffset, spaceDensity, backgroundColor, textColor } = currentOptions;
        // 1. Binary thresholding if enabled
        if (useThreshold) {
            applySimpleThresholding(data, canvasWidth, canvasHeight, thresholdOffset);
        }
        // 2. Resolve character palette with space density padding
        const resolvedCharset = resolveCharset(charset, spaceDensity);
        const charsetLen = resolvedCharset.length;
        // 3. Populate luminance matrix
        const lum = new Float32Array(canvasWidth * canvasHeight);
        for (let y = 0; y < canvasHeight; y++) {
            for (let x = 0; x < canvasWidth; x++) {
                const i = (y * canvasWidth + x) * 4;
                if (data[i + 3] < 16) {
                    lum[y * canvasWidth + x] = 255; // Transparent -> space
                }
                else {
                    lum[y * canvasWidth + x] = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
                }
            }
        }
        // 4. Dithering Error Diffusion
        if (dithering !== 'none' && charsetLen > 1) {
            const steps = charsetLen - 1;
            for (let y = 0; y < canvasHeight; y++) {
                for (let x = 0; x < canvasWidth; x++) {
                    const idx = y * canvasWidth + x;
                    const oldVal = lum[idx];
                    const clampedOld = Math.min(255, Math.max(0, oldVal));
                    const quantized = Math.round((clampedOld / 255) * steps) / steps * 255;
                    const err = oldVal - quantized;
                    if (dithering === 'floyd-steinberg') {
                        if (x + 1 < canvasWidth)
                            lum[idx + 1] += err * (7 / 16);
                        if (y + 1 < canvasHeight) {
                            if (x > 0)
                                lum[idx + canvasWidth - 1] += err * (3 / 16);
                            lum[idx + canvasWidth] += err * (5 / 16);
                            if (x + 1 < canvasWidth)
                                lum[idx + canvasWidth + 1] += err * (1 / 16);
                        }
                    }
                    else if (dithering === 'atkinson') {
                        const eighth = err * (1 / 8);
                        if (x + 1 < canvasWidth)
                            lum[idx + 1] += eighth;
                        if (x + 2 < canvasWidth)
                            lum[idx + 2] += eighth;
                        if (y + 1 < canvasHeight) {
                            if (x > 0)
                                lum[idx + canvasWidth - 1] += eighth;
                            lum[idx + canvasWidth] += eighth;
                            if (x + 1 < canvasWidth)
                                lum[idx + canvasWidth + 1] += eighth;
                        }
                        if (y + 2 < canvasHeight) {
                            lum[idx + 2 * canvasWidth] += eighth;
                        }
                    }
                    else if (dithering === 'jjn') {
                        const spread = (dx, dy, w) => {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
                                lum[ny * canvasWidth + nx] += err * (w / 48);
                            }
                        };
                        spread(1, 0, 7);
                        spread(2, 0, 5);
                        spread(-2, 1, 3);
                        spread(-1, 1, 5);
                        spread(0, 1, 7);
                        spread(1, 1, 5);
                        spread(2, 1, 3);
                        spread(-2, 2, 1);
                        spread(-1, 2, 3);
                        spread(0, 2, 5);
                        spread(1, 2, 3);
                        spread(2, 2, 1);
                    }
                    else if (dithering === 'stucki') {
                        const spread = (dx, dy, w) => {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
                                lum[ny * canvasWidth + nx] += err * (w / 42);
                            }
                        };
                        spread(1, 0, 8);
                        spread(2, 0, 4);
                        spread(-2, 1, 2);
                        spread(-1, 1, 4);
                        spread(0, 1, 8);
                        spread(1, 1, 4);
                        spread(2, 1, 2);
                        spread(-2, 2, 1);
                        spread(-1, 2, 2);
                        spread(0, 2, 4);
                        spread(1, 2, 2);
                        spread(2, 2, 1);
                    }
                    lum[idx] = quantized;
                }
            }
        }
        // 5. Generate characters and colors
        const lines = [];
        const colors = [];
        const isColor = colorMode === 'color';
        for (let y = 0; y < canvasHeight; y++) {
            let line = '';
            const rowColors = [];
            for (let x = 0; x < canvasWidth; x++) {
                const i = (y * canvasWidth + x) * 4;
                if (data[i + 3] < 16) {
                    line += ' ';
                    if (isColor)
                        rowColors.push({ r: 0, g: 0, b: 0 });
                    continue;
                }
                const b = Math.min(255, Math.max(0, lum[y * canvasWidth + x]));
                const char = getAsciiChar(b, resolvedCharset);
                line += char;
                if (isColor) {
                    rowColors.push({
                        r: data[i],
                        g: data[i + 1],
                        b: data[i + 2]
                    });
                }
            }
            lines.push(line);
            if (isColor)
                colors.push(rowColors);
        }
        const ascii = lines.join('\n');
        const html = isColor
            ? renderColorHtml(lines, colors, backgroundColor)
            : `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${backgroundColor}; color: ${textColor}; margin: 0; padding: 0;">${escapeHtml(ascii)}</pre>`;
        return {
            ascii,
            html,
            width: canvasWidth,
            height: canvasHeight,
            charset: resolvedCharset,
            colors: isColor ? colors : undefined,
            async copyToClipboard() {
                await copyTextToClipboard(ascii);
            },
            saveAsText(filename = 'ascii-art.txt') {
                if (typeof Blob === 'undefined') {
                    throw new Error('saveAsText requires a browser environment. Use result.ascii in Node.js.');
                }
                const blob = new Blob([ascii], { type: 'text/plain;charset=utf-8' });
                downloadBlob(blob, filename);
            },
            saveAsPng(filename = 'ascii-art.png', fontSize = 12, bg = backgroundColor, fg = textColor) {
                const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
                canvas.toBlob((blob) => {
                    if (blob)
                        downloadBlob(blob, filename);
                }, 'image/png');
            },
            toPngDataUrl(fontSize = 12, bg = backgroundColor, fg = textColor) {
                const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
                return canvas.toDataURL('image/png');
            },
            toPngBlob(fontSize = 12, bg = backgroundColor, fg = textColor) {
                const canvas = asciiToCanvas(ascii, isColor ? colors : undefined, fontSize, bg, fg);
                return new Promise((res, rej) => {
                    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas blob generation failed'))), 'image/png');
                });
            }
        };
    }
}

/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
function decodeImageBuffer(buffer) {
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47) {
        try {
            const png = pngjs.PNG.sync.read(buffer);
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
        const png = pngjs.PNG.sync.read(buffer);
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
async function resolveImageSource(source) {
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

const VALID_DITHERING_MODES = ['none', 'floyd-steinberg', 'atkinson', 'jjn', 'stucki'];
const VALID_COLOR_MODES = ['monochrome', 'color'];
const convertImageSchema = {
    source: zod.z.string().describe('File path (e.g. "./image.png"), remote HTTP/HTTPS URL, or base64 data URI.'),
    width: zod.z.number().int().min(10).max(300).optional().describe('Output width in characters. Default: 80.'),
    height: zod.z.number().int().min(5).max(300).optional().describe('Output height in characters (auto-calculated if omitted).'),
    dithering: zod.z.enum(VALID_DITHERING_MODES).optional().describe('Error diffusion dithering algorithm ("none", "atkinson", "floyd-steinberg", "jjn", "stucki"). Default: "none".'),
    charset: zod.z.string().optional().describe('Preset name ("normal", "blockelement", "codepage437", "braille", "minimalist", "math", "extended") or custom character sequence from darkest to lightest. Default: "normal".'),
    colorMode: zod.z.enum(VALID_COLOR_MODES).optional().describe('"monochrome" (plain ASCII) or "color" (HTML spans). Default: "monochrome".'),
    useEdgeDetection: zod.z.boolean().optional().describe('Whether to apply Sobel convolution edge detection. Default: false.'),
    edgeIntensity: zod.z.number().min(0.1).max(3.0).optional().describe('Sobel edge intensity multiplier. Default: 1.0.'),
    useSharpen: zod.z.boolean().optional().describe('Whether to apply unsharp mask sharpening. Default: false.'),
    sharpness: zod.z.number().min(1).max(20).optional().describe('Sharpening weight (1-20). Default: 9.'),
    contrast: zod.z.number().min(0).max(300).optional().describe('Contrast percentage (100 is normal). Default: 100.'),
    brightness: zod.z.number().min(0).max(300).optional().describe('Brightness percentage (100 is normal). Default: 100.'),
    invert: zod.z.boolean().optional().describe('Invert brightness. Default: false.')
};
const analyzeSpatialLayoutSchema = {
    source: zod.z.string().describe('File path, remote URL, or base64 data URI of the image to analyze.'),
    width: zod.z.number().int().min(10).max(120).optional().describe('Width of the structural ASCII contour map. Default: 60.'),
    edgeIntensity: zod.z.number().min(0.1).max(3.0).optional().describe('Edge detection sensitivity. Default: 1.2.')
};
/**
 * Tool Handler: convert_image
 */
async function handleConvertImage(args) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const buffer = await resolveImageSource(args.source);
    const decoded = decodeImageBuffer(buffer);
    const hexpic = new HexPic();
    const result = hexpic.fromPixels(decoded.data, decoded.width, decoded.height, {
        width: (_a = args.width) !== null && _a !== void 0 ? _a : 80,
        height: args.height,
        dithering: (_b = args.dithering) !== null && _b !== void 0 ? _b : 'none',
        charset: (_c = args.charset) !== null && _c !== void 0 ? _c : 'normal',
        colorMode: (_d = args.colorMode) !== null && _d !== void 0 ? _d : 'monochrome',
        useEdgeDetection: (_e = args.useEdgeDetection) !== null && _e !== void 0 ? _e : false,
        edgeIntensity: (_f = args.edgeIntensity) !== null && _f !== void 0 ? _f : 1.0,
        useSharpen: (_g = args.useSharpen) !== null && _g !== void 0 ? _g : false,
        sharpness: (_h = args.sharpness) !== null && _h !== void 0 ? _h : 9,
        contrast: (_j = args.contrast) !== null && _j !== void 0 ? _j : 100,
        brightness: (_k = args.brightness) !== null && _k !== void 0 ? _k : 100,
        invert: (_l = args.invert) !== null && _l !== void 0 ? _l : false
    });
    const outputMarkdown = [
        `### HexPic ASCII Output`,
        `- Dimensions: ${result.width} cols × ${result.height} rows`,
        `- Character Count: ${result.ascii.length}`,
        `- Source Input: ${decoded.width}×${decoded.height} px`,
        '',
        '```text',
        result.ascii,
        '```'
    ];
    if (args.colorMode === 'color') {
        outputMarkdown.push('', '### HTML Output', '```html', result.html, '```');
    }
    return {
        content: [{
                type: 'text',
                text: outputMarkdown.join('\n')
            }]
    };
}
/**
 * Tool Handler: analyze_spatial_layout
 */
async function handleAnalyzeSpatialLayout(args) {
    var _a, _b;
    const buffer = await resolveImageSource(args.source);
    const decoded = decodeImageBuffer(buffer);
    const width = (_a = args.width) !== null && _a !== void 0 ? _a : 60;
    const hexpic = new HexPic();
    // Run edge detection to extract outlines and contours
    const result = hexpic.fromPixels(decoded.data, decoded.width, decoded.height, {
        width,
        useEdgeDetection: true,
        edgeIntensity: (_b = args.edgeIntensity) !== null && _b !== void 0 ? _b : 1.2,
        invertEdgeColors: true,
        charset: 'normal',
        spaceDensity: 2
    });
    const rows = result.ascii.split('\n');
    const h = rows.length;
    const w = result.width;
    // Calculate quadrant density distribution
    const midX = Math.floor(w / 2);
    const midY = Math.floor(h / 2);
    let qTopLeft = 0, qTopRight = 0, qBottomLeft = 0, qBottomRight = 0, center = 0;
    let totalChars = 0;
    for (let y = 0; y < h; y++) {
        const row = rows[y] || '';
        for (let x = 0; x < w; x++) {
            const char = row[x] || ' ';
            const isEdge = char !== ' ';
            if (isEdge) {
                totalChars++;
                if (x < midX && y < midY)
                    qTopLeft++;
                else if (x >= midX && y < midY)
                    qTopRight++;
                else if (x < midX && y >= midY)
                    qBottomLeft++;
                else
                    qBottomRight++;
                // Center region (middle 50% bounding box)
                if (x >= w * 0.25 && x <= w * 0.75 && y >= h * 0.25 && y <= h * 0.75) {
                    center++;
                }
            }
        }
    }
    const area = w * h;
    const overallDensity = ((totalChars / area) * 100).toFixed(1);
    const tlPct = (((qTopLeft / (midX * midY || 1))) * 100).toFixed(1);
    const trPct = (((qTopRight / ((w - midX) * midY || 1))) * 100).toFixed(1);
    const blPct = (((qBottomLeft / (midX * (h - midY) || 1))) * 100).toFixed(1);
    const brPct = (((qBottomRight / ((w - midX) * (h - midY) || 1))) * 100).toFixed(1);
    const centerPct = (((center / ((w * 0.5) * (h * 0.5) || 1))) * 100).toFixed(1);
    const report = [
        `### Spatial Layout Analysis`,
        `- Image Resolution: ${decoded.width}×${decoded.height} px (Aspect Ratio: ${(decoded.width / decoded.height).toFixed(2)})`,
        `- Contour Map: ${w} cols × ${h} rows (Overall Edge Density: ${overallDensity}%)`,
        '',
        `#### Spatial Density Distribution:`,
        `- Top-Left: ${tlPct}%`,
        `- Top-Right: ${trPct}%`,
        `- Bottom-Left: ${blPct}%`,
        `- Bottom-Right: ${brPct}%`,
        `- Center Density: ${centerPct}%`,
        '',
        `#### Visual Edge Contour Map:`,
        '```text',
        result.ascii,
        '```'
    ];
    return {
        content: [{
                type: 'text',
                text: report.join('\n')
            }]
    };
}
/**
 * Tool Handler: get_presets
 */
async function handleGetPresets() {
    const charsets = Object.entries(CHARSET_PRESETS).map(([name, chars]) => {
        return `- **${name}**: \`${chars}\``;
    }).join('\n');
    const dithering = VALID_DITHERING_MODES.map((mode) => {
        switch (mode) {
            case 'none': return '- **none**: Hard threshold / posterized character selection.';
            case 'atkinson': return '- **atkinson**: Classic 3-row error diffusion with 1/8 error spread; preserves high-frequency contrast.';
            case 'floyd-steinberg': return '- **floyd-steinberg**: Standard 4-way error diffusion; smooth gradients.';
            case 'jjn': return '- **jjn**: Jarvis-Judice-Ninke 12-neighbor diffusion for rich tonal depth.';
            case 'stucki': return '- **stucki**: Clean 12-neighbor diffusion with faster edge decay than JJN.';
        }
    }).join('\n');
    const text = [
        `### HexPic Presets & Dithering Algorithms`,
        '',
        `#### Available Character Sets:`,
        charsets,
        '',
        `#### Available Dithering Algorithms:`,
        dithering,
        '',
        `#### Best Practice Recommendations:`,
        `- **General Photos**: \`dithering: "atkinson"\` + \`charset: "normal"\``,
        `- **Retro / MS-DOS style**: \`charset: "codepage437"\` or \`"blockelement"\``,
        `- **High-density / Text**: \`charset: "braille"\` or \`"extended"\``,
        `- **Line art / Diagrams**: \`useEdgeDetection: true\` + \`dithering: "none"\``
    ].join('\n');
    return {
        content: [{
                type: 'text',
                text
            }]
    };
}

/**
 * Creates and configures the HexPic Model Context Protocol (MCP) server.
 */
function createMcpServer() {
    const server = new mcp_js.McpServer({
        name: 'hexpic',
        version: '0.2.0'
    });
    server.tool('convert_image', 'Converts an image (file path, URL, or base64 data URI) into ASCII art with studio-quality error-diffusion dithering, edge convolution, and color HTML support.', convertImageSchema, async (args) => handleConvertImage(args));
    server.tool('analyze_spatial_layout', 'Analyzes image visual composition, returning an ASCII contour map and spatial density distribution across quadrants to help LLMs understand image structure without high vision token costs.', analyzeSpatialLayoutSchema, async (args) => handleAnalyzeSpatialLayout(args));
    server.tool('get_presets', 'Lists available character sets, dithering algorithms, and use-case recommendations for HexPic.', {}, async () => handleGetPresets());
    return server;
}

async function main() {
    const server = createMcpServer();
    const transport = new stdio_js.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('HexPic MCP server running on stdio\n');
}
main().catch((error) => {
    process.stderr.write(`Fatal error in HexPic MCP server: ${error}\n`);
    process.exit(1);
});
//# sourceMappingURL=hexpic-mcp.js.map
