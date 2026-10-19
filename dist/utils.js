/**
 * Built-in character sets for ASCII art, ordered from darkest to lightest.
 */
export const CHARSET_PRESETS = {
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
export const DEFAULT_CHARSET = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ';
/**
 * Resolves a charset identifier (preset name or custom string) and applies space density padding.
 */
export function resolveCharset(charset, spaceDensity = 1) {
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
export function rgbToGrayscale(r, g, b) {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}
/**
 * Adjusts the contrast of a luminance value around mid-gray (128).
 */
export function adjustContrast(value, contrast) {
    const centered = value - 128;
    const adjusted = centered * contrast + 128;
    return Math.min(255, Math.max(0, adjusted));
}
/**
 * Adjusts the brightness of a luminance value.
 */
export function adjustBrightness(value, brightness) {
    if (brightness > 0) {
        return value + (255 - value) * brightness;
    }
    else if (brightness < 0) {
        return value + value * brightness;
    }
    return value;
}
/**
 * Maps a brightness value [0, 255] to an ASCII character from the resolved charset.
 */
export function getAsciiChar(brightness, charset, gamma = 1.5) {
    const clamped = Math.min(255, Math.max(0, brightness));
    const normalized = clamped / 255;
    const adjusted = gamma === 1 ? normalized : Math.pow(normalized, gamma);
    const index = Math.floor(adjusted * (charset.length - 1));
    return charset[Math.min(Math.max(index, 0), charset.length - 1)];
}
/**
 * Applies a 3x3 Sobel convolution filter to emphasize visual edges and outlines.
 */
export function applyEdgeDetection(ctx, width, height, intensity, invertColors = true) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
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
 * Applies a 3x3 unsharp convolution sharpening kernel to make fine details pop.
 */
export function applySharpen(ctx, width, height, sharpness) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
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
    putImageDataSafe(ctx, output, width, height);
}
/**
 * Applies binary thresholding to image pixel data.
 */
export function applySimpleThresholding(data, width, height, threshold) {
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
export function renderColorHtml(lines, colors, backgroundColor = '#000000') {
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
export function asciiToCanvas(ascii, colors, fontSize = 12, bg = '#000000', fg = '#ffffff') {
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
export function downloadBlob(blob, filename) {
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
export async function copyTextToClipboard(text) {
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
export function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image from URL: ${e}`));
        img.src = url;
    });
}
//# sourceMappingURL=utils.js.map