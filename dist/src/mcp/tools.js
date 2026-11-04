import { z } from 'zod';
import { HexPic } from '../HexPic';
import { decodeImageBuffer, resolveImageSource } from '../node/imageDecoder';
import { CHARSET_PRESETS } from '../utils';
export const VALID_DITHERING_MODES = ['none', 'floyd-steinberg', 'atkinson', 'jjn', 'stucki'];
export const VALID_COLOR_MODES = ['monochrome', 'color'];
export const convertImageSchema = {
    source: z.string().describe('File path (e.g. "./image.png"), remote HTTP/HTTPS URL, or base64 data URI.'),
    width: z.number().int().min(10).max(300).optional().describe('Output width in characters. Default: 80.'),
    height: z.number().int().min(5).max(300).optional().describe('Output height in characters (auto-calculated if omitted).'),
    dithering: z.enum(VALID_DITHERING_MODES).optional().describe('Error diffusion dithering algorithm ("none", "atkinson", "floyd-steinberg", "jjn", "stucki"). Default: "none".'),
    charset: z.string().optional().describe('Preset name ("normal", "blockelement", "codepage437", "braille", "minimalist", "math", "extended") or custom character sequence from darkest to lightest. Default: "normal".'),
    colorMode: z.enum(VALID_COLOR_MODES).optional().describe('"monochrome" (plain ASCII) or "color" (HTML spans). Default: "monochrome".'),
    useEdgeDetection: z.boolean().optional().describe('Whether to apply Sobel convolution edge detection. Default: false.'),
    edgeIntensity: z.number().min(0.1).max(3.0).optional().describe('Sobel edge intensity multiplier. Default: 1.0.'),
    useSharpen: z.boolean().optional().describe('Whether to apply unsharp mask sharpening. Default: false.'),
    sharpness: z.number().min(1).max(20).optional().describe('Sharpening weight (1-20). Default: 9.'),
    contrast: z.number().min(0).max(300).optional().describe('Contrast percentage (100 is normal). Default: 100.'),
    brightness: z.number().min(0).max(300).optional().describe('Brightness percentage (100 is normal). Default: 100.'),
    invert: z.boolean().optional().describe('Invert brightness. Default: false.')
};
export const analyzeSpatialLayoutSchema = {
    source: z.string().describe('File path, remote URL, or base64 data URI of the image to analyze.'),
    width: z.number().int().min(10).max(120).optional().describe('Width of the structural ASCII contour map. Default: 60.'),
    edgeIntensity: z.number().min(0.1).max(3.0).optional().describe('Edge detection sensitivity. Default: 1.2.')
};
/**
 * Tool Handler: convert_image
 */
export async function handleConvertImage(args) {
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
export async function handleAnalyzeSpatialLayout(args) {
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
export async function handleGetPresets() {
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
//# sourceMappingURL=tools.js.map