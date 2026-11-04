#!/usr/bin/env node

'use strict';

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
    const safeBg = escapeHtml$1(backgroundColor);
    let html = `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${safeBg}; margin: 0; padding: 0;">`;
    for (let y = 0; y < lines.length; y++) {
        const lineChars = lines[y];
        const rowColors = colors[y] || [];
        let currentColor = '';
        let buffer = '';
        for (let x = 0; x < lineChars.length; x++) {
            const char = lineChars[x];
            const color = rowColors[x] ? `rgb(${rowColors[x].r},${rowColors[x].g},${rowColors[x].b})` : 'inherit';
            const escapedChar = escapeHtml$1(char);
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
 * Escapes characters for safe inclusion in XML/SVG documents.
 */
function escapeXml(str) {
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case '\'': return '&apos;';
            default: return m;
        }
    });
}
/**
 * Escapes characters for safe inclusion in HTML documents and attributes.
 */
function escapeHtml$1(str) {
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case '\'': return '&#39;';
            default: return m;
        }
    });
}
/**
 * Converts ASCII text (and optional character colors) into a scalable, responsive SVG string.
 */
function asciiToSvg(ascii, colors, fontSize = 12, bg = '#000000', fg = '#ffffff') {
    const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12;
    const safeBg = escapeXml(bg);
    const safeFg = escapeXml(fg);
    const lines = ascii.split('\n');
    const maxLineLength = Math.max(...lines.map((l) => l.length), 1);
    const charWidth = safeFontSize * 0.6;
    const lineHeight = safeFontSize;
    const svgWidth = Math.ceil(maxLineLength * charWidth);
    const svgHeight = Math.ceil(lines.length * lineHeight);
    const textLines = [];
    for (let y = 0; y < lines.length; y++) {
        const line = lines[y];
        const yPos = (y + 0.85) * lineHeight;
        if (!colors || !colors[y]) {
            // Monochrome line
            textLines.push(`    <text x="0" y="${yPos.toFixed(2)}" fill="${safeFg}" xml:space="preserve">${escapeXml(line)}</text>`);
        }
        else {
            // Color mode line with consecutive color grouping
            const rowColors = colors[y];
            let tspanBuffer = '';
            let currentColor = '';
            let currentText = '';
            for (let x = 0; x < line.length; x++) {
                const char = line[x];
                const color = rowColors[x] || { r: 255, g: 255, b: 255 };
                const colorStr = `rgb(${color.r},${color.g},${color.b})`;
                if (colorStr === currentColor) {
                    currentText += char;
                }
                else {
                    if (currentText.length > 0) {
                        tspanBuffer += `<tspan fill="${currentColor}">${escapeXml(currentText)}</tspan>`;
                    }
                    currentColor = colorStr;
                    currentText = char;
                }
            }
            if (currentText.length > 0) {
                tspanBuffer += `<tspan fill="${currentColor}">${escapeXml(currentText)}</tspan>`;
            }
            textLines.push(`    <text x="0" y="${yPos.toFixed(2)}" xml:space="preserve">${tspanBuffer}</text>`);
        }
    }
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`,
        `  <rect width="100%" height="100%" fill="${safeBg}"/>`,
        `  <g font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" font-size="${safeFontSize}px" letter-spacing="0">`,
        textLines.join('\n'),
        `  </g>`,
        `</svg>`
    ].join('\n');
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
        const safeTargetWidth = Math.max(1, Math.min(2000, Math.floor(Number.isFinite(targetWidth) ? targetWidth : 80)));
        const safeTargetHeight = Math.max(1, Math.min(2000, Math.floor(Number.isFinite(targetHeight) ? targetHeight : 40)));
        const isExplicitHeight = (options === null || options === void 0 ? void 0 : options.height) !== undefined && options.height > 0;
        let width = safeTargetWidth;
        let height = isExplicitHeight ? safeTargetHeight : 0;
        if (!preserveAspectRatio && isExplicitHeight) {
            width = safeTargetWidth;
            height = safeTargetHeight;
        }
        else {
            const imageAspect = (sourceWidth || 1) / (sourceHeight || 1);
            const correctedAspect = imageAspect / fontAspectRatio;
            if (isExplicitHeight && preserveAspectRatio) {
                if (safeTargetWidth / safeTargetHeight > correctedAspect) {
                    width = Math.max(1, Math.floor(safeTargetHeight * correctedAspect));
                    height = safeTargetHeight;
                }
                else {
                    width = safeTargetWidth;
                    height = Math.max(1, Math.floor(safeTargetWidth / correctedAspect));
                }
            }
            else {
                width = safeTargetWidth;
                height = Math.max(1, Math.floor(safeTargetWidth / correctedAspect));
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
        const safeBg = escapeHtml(backgroundColor);
        const safeFg = escapeHtml(textColor);
        const html = isColor
            ? renderColorHtml(lines, colors, safeBg)
            : `<pre style="font-family: monospace; white-space: pre; line-height: 1em; background-color: ${safeBg}; color: ${safeFg}; margin: 0; padding: 0;">${escapeHtml(ascii)}</pre>`;
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
            },
            toSvg(fontSize = 12, bg = backgroundColor, fg = textColor) {
                return asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
            },
            saveAsSvg(filename = 'ascii-art.svg', fontSize = 12, bg = backgroundColor, fg = textColor) {
                const svgString = asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
                if (typeof Blob === 'undefined') {
                    throw new Error('saveAsSvg requires a browser environment. Use result.toSvg() in Node.js.');
                }
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                downloadBlob(blob, filename);
            },
            toSvgBlob(fontSize = 12, bg = backgroundColor, fg = textColor) {
                const svgString = asciiToSvg(ascii, isColor ? colors : undefined, fontSize, bg, fg);
                if (typeof Blob === 'undefined') {
                    return Promise.reject(new Error('toSvgBlob requires a browser environment. Use result.toSvg() in Node.js.'));
                }
                return Promise.resolve(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
            }
        };
    }
}

const MAX_IMAGE_BUFFER_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_IMAGE_PIXELS = 25000000; // 25 megapixels (e.g. 5000x5000)
const DEFAULT_FETCH_TIMEOUT_MS = 15000; // 15 seconds
function validateImageDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error(`Invalid image dimensions: ${width}x${height}`);
    }
    if (width * height > MAX_IMAGE_PIXELS) {
        throw new Error(`Image dimensions (${width}x${height} = ${width * height} pixels) exceed safety limit of ${MAX_IMAGE_PIXELS} pixels to prevent memory exhaustion.`);
    }
}
/**
 * Decodes an image Buffer (PNG or JPEG) into raw RGBA pixel data.
 */
function decodeImageBuffer(buffer) {
    if (buffer.length > MAX_IMAGE_BUFFER_BYTES) {
        throw new Error(`Image buffer (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 25MB.`);
    }
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47) {
        try {
            const png = pngjs.PNG.sync.read(buffer);
            validateImageDimensions(png.width, png.height);
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
            validateImageDimensions(decoded.width, decoded.height);
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
        validateImageDimensions(png.width, png.height);
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
            validateImageDimensions(decoded.width, decoded.height);
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
    var _a;
    const trimmed = source.trim();
    // 1. Data URI
    if (trimmed.startsWith('data:')) {
        const matches = trimmed.match(/^data:image\/[a-zA-Z+.-]+;base64,(.+)$/);
        if (!matches || !matches[1]) {
            throw new Error('Invalid data URI format. Expected "data:image/<type>;base64,<data>".');
        }
        if (matches[1].length > MAX_IMAGE_BUFFER_BYTES * 1.4) {
            throw new Error('Data URI payload exceeds maximum allowed size of 25MB.');
        }
        return Buffer.from(matches[1], 'base64');
    }
    // 2. HTTP(S) URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(trimmed, { signal: controller.signal });
            if (!res.ok) {
                throw new Error(`Failed to fetch image from URL: ${res.status} ${res.statusText}`);
            }
            const contentLength = ((_a = res.headers) === null || _a === void 0 ? void 0 : _a.get) ? res.headers.get('content-length') : null;
            if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BUFFER_BYTES) {
                throw new Error(`Remote image (${contentLength} bytes) exceeds maximum allowed size of 25MB.`);
            }
            const arrayBuf = await res.arrayBuffer();
            if (arrayBuf.byteLength > MAX_IMAGE_BUFFER_BYTES) {
                throw new Error(`Remote image (${arrayBuf.byteLength} bytes) exceeds maximum allowed size of 25MB.`);
            }
            return Buffer.from(arrayBuf);
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Image fetch request timed out after ${DEFAULT_FETCH_TIMEOUT_MS / 1000} seconds.`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
    }
    // 3. Local file path
    const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Local image file does not exist (not found) at path: "${trimmed}" (resolved to: "${resolvedPath}")`);
    }
    const stat = await fs.promises.stat(resolvedPath);
    if (stat.size > MAX_IMAGE_BUFFER_BYTES) {
        throw new Error(`Local image file (${(stat.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 25MB.`);
    }
    return fs.promises.readFile(resolvedPath);
}

const HELP_TEXT = `
HexPic - Terminal & Headless ASCII/SVG Art Generator

Usage:
  hexpic [image] [options]
  npx hexpic [image] [options]

Arguments:
  [image]                     Local path or remote URL (http/https).
                              Defaults to https://github.com/<owner>.png if
                              GITHUB_REPOSITORY_OWNER environment variable exists.

Options:
  -o, --output <file>         Destination file path (e.g. ./assets/banner.svg).
                              If omitted, prints output to stdout.
  -f, --format <format>       Output format: svg | text | html.
                              Defaults to svg when output file ends in .svg or is specified;
                              defaults to text when printing to stdout.
  -w, --width <cols>          Character columns width (default: 70).
      --height <rows>         Character rows height (default: auto aspect ratio).
  -c, --color-mode <mode>     Color mode: color | monochrome (default: color).
  -d, --dithering <type>      Dithering algorithm: atkinson | floyd-steinberg |
                              bayer | halftone | random | none (default: atkinson).
      --charset <preset>      Charset preset: normal | minimalist | alphabetic |
                              numerical | extended | math | braille | <custom> (default: normal).
      --font-size <px>        Font size in pixels for SVG (default: 12).
      --bg <color>            Background color for SVG (default: #000000).
      --fg <color>            Foreground text color for monochrome SVG (default: #ffffff).
      --contrast <pct>        Contrast adjustment percentage (default: 100).
      --brightness <pct>      Brightness adjustment percentage (default: 100).
      --invert                Invert image brightness.
  -h, --help                  Show this help text.
  -v, --version               Show version number.

Examples:
  # Convert local avatar to SVG for GitHub profile
  npx hexpic ./profile.png -o ./assets/banner.svg -w 70

  # Fetch remote image and generate colored SVG
  npx hexpic https://github.com/octocat.png -o banner.svg --dithering atkinson

  # Print monochrome ASCII text to terminal
  npx hexpic ./avatar.png -f text -w 40 -c monochrome
`;
function parseArgs(args) {
    var _a, _b, _c;
    const options = {};
    let showHelp = false;
    let showVersion = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-h' || arg === '--help') {
            showHelp = true;
        }
        else if (arg === '-v' || arg === '--version') {
            showVersion = true;
        }
        else if (arg === '-o' || arg === '--output') {
            options.output = args[++i];
        }
        else if (arg === '-f' || arg === '--format') {
            const fmt = (_a = args[++i]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
            if (fmt === 'svg' || fmt === 'text' || fmt === 'html') {
                options.format = fmt;
            }
        }
        else if (arg === '-w' || arg === '--width') {
            options.width = parseInt(args[++i], 10);
        }
        else if (arg === '--height') {
            options.height = parseInt(args[++i], 10);
        }
        else if (arg === '-c' || arg === '--color-mode') {
            const mode = (_b = args[++i]) === null || _b === void 0 ? void 0 : _b.toLowerCase();
            if (mode === 'color' || mode === 'monochrome') {
                options.colorMode = mode;
            }
        }
        else if (arg === '-d' || arg === '--dithering') {
            options.dithering = (_c = args[++i]) === null || _c === void 0 ? void 0 : _c.toLowerCase();
        }
        else if (arg === '--charset') {
            options.charset = args[++i];
        }
        else if (arg === '--font-size') {
            options.fontSize = parseFloat(args[++i]);
        }
        else if (arg === '--bg') {
            options.bgColor = args[++i];
        }
        else if (arg === '--fg') {
            options.fgColor = args[++i];
        }
        else if (arg === '--contrast') {
            options.contrast = parseFloat(args[++i]);
        }
        else if (arg === '--brightness') {
            options.brightness = parseFloat(args[++i]);
        }
        else if (arg === '--invert') {
            options.invert = true;
        }
        else if (!arg.startsWith('-') && !options.input) {
            options.input = arg;
        }
    }
    return { options, showHelp, showVersion };
}
async function runCli(argv, env = process.env) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { options, showHelp, showVersion } = parseArgs(argv);
    if (showHelp) {
        return { code: 0, stdout: HELP_TEXT.trim(), stderr: '' };
    }
    if (showVersion) {
        let version = '0.3.0';
        try {
            const pkgPath = path.resolve(__dirname, '../package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                version = pkg.version || version;
            }
        }
        catch (_j) { }
        return { code: 0, stdout: version, stderr: '' };
    }
    // Determine image source
    let inputSource = options.input;
    if (!inputSource && env.GITHUB_REPOSITORY_OWNER) {
        inputSource = `https://github.com/${env.GITHUB_REPOSITORY_OWNER}.png`;
    }
    if (!inputSource) {
        return {
            code: 1,
            stdout: '',
            stderr: 'Error: No image source provided. Specify a local file path, image URL, or set GITHUB_REPOSITORY_OWNER.'
        };
    }
    // Load image buffer
    let buffer;
    try {
        buffer = await resolveImageSource(inputSource);
    }
    catch (err) {
        return {
            code: 1,
            stdout: '',
            stderr: `Error reading image: ${(err === null || err === void 0 ? void 0 : err.message) || err}`
        };
    }
    // Decode and process
    try {
        const decoded = decodeImageBuffer(buffer);
        const hexpic = new HexPic();
        const result = hexpic.fromPixels(decoded.data, decoded.width, decoded.height, {
            width: (_a = options.width) !== null && _a !== void 0 ? _a : 70,
            height: options.height,
            colorMode: (_b = options.colorMode) !== null && _b !== void 0 ? _b : 'color',
            dithering: (_c = options.dithering) !== null && _c !== void 0 ? _c : 'atkinson',
            charset: (_d = options.charset) !== null && _d !== void 0 ? _d : 'normal',
            contrast: (_e = options.contrast) !== null && _e !== void 0 ? _e : 100,
            brightness: (_f = options.brightness) !== null && _f !== void 0 ? _f : 100,
            invert: (_g = options.invert) !== null && _g !== void 0 ? _g : false
        });
        // Determine output format
        let format = options.format;
        if (!format) {
            if (options.output) {
                const lowerOut = options.output.toLowerCase();
                if (lowerOut.endsWith('.html') || lowerOut.endsWith('.htm')) {
                    format = 'html';
                }
                else if (lowerOut.endsWith('.txt')) {
                    format = 'text';
                }
                else {
                    format = 'svg';
                }
            }
            else {
                format = 'text';
            }
        }
        let outputContent;
        if (format === 'svg') {
            outputContent = result.toSvg((_h = options.fontSize) !== null && _h !== void 0 ? _h : 12, options.bgColor, options.fgColor);
        }
        else if (format === 'html') {
            outputContent = result.html;
        }
        else {
            outputContent = result.ascii;
        }
        if (options.output) {
            const destPath = path.resolve(process.cwd(), options.output);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.writeFileSync(destPath, outputContent, 'utf8');
            return {
                code: 0,
                stdout: `Generated ${format.toUpperCase()} (${result.width}×${result.height}) -> ${options.output}`,
                stderr: ''
            };
        }
        else {
            return {
                code: 0,
                stdout: outputContent,
                stderr: ''
            };
        }
    }
    catch (err) {
        return {
            code: 1,
            stdout: '',
            stderr: `Error generating ASCII art: ${(err === null || err === void 0 ? void 0 : err.message) || err}`
        };
    }
}
// Direct invocation handler
if (require.main === module) {
    runCli(process.argv.slice(2)).then(res => {
        if (res.stdout)
            process.stdout.write(res.stdout + (res.stdout.endsWith('\n') ? '' : '\n'));
        if (res.stderr)
            process.stderr.write(res.stderr + (res.stderr.endsWith('\n') ? '' : '\n'));
        process.exit(res.code);
    });
}

exports.parseArgs = parseArgs;
exports.runCli = runCli;
//# sourceMappingURL=hexpic.js.map
