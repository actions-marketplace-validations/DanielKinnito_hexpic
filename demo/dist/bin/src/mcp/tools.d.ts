import { z } from 'zod';
import { DitheringMode, ColorMode } from '../types';
export declare const VALID_DITHERING_MODES: readonly ["none", "floyd-steinberg", "atkinson", "jjn", "stucki"];
export declare const VALID_COLOR_MODES: readonly ["monochrome", "color"];
export declare const convertImageSchema: {
    source: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    dithering: z.ZodOptional<z.ZodEnum<{
        none: "none";
        "floyd-steinberg": "floyd-steinberg";
        atkinson: "atkinson";
        jjn: "jjn";
        stucki: "stucki";
    }>>;
    charset: z.ZodOptional<z.ZodString>;
    colorMode: z.ZodOptional<z.ZodEnum<{
        monochrome: "monochrome";
        color: "color";
    }>>;
    useEdgeDetection: z.ZodOptional<z.ZodBoolean>;
    edgeIntensity: z.ZodOptional<z.ZodNumber>;
    useSharpen: z.ZodOptional<z.ZodBoolean>;
    sharpness: z.ZodOptional<z.ZodNumber>;
    contrast: z.ZodOptional<z.ZodNumber>;
    brightness: z.ZodOptional<z.ZodNumber>;
    invert: z.ZodOptional<z.ZodBoolean>;
    format: z.ZodOptional<z.ZodEnum<{
        html: "html";
        svg: "svg";
        text: "text";
    }>>;
};
export declare const analyzeSpatialLayoutSchema: {
    source: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    edgeIntensity: z.ZodOptional<z.ZodNumber>;
};
export interface ConvertImageArgs {
    source: string;
    width?: number;
    height?: number;
    dithering?: DitheringMode;
    charset?: string;
    colorMode?: ColorMode;
    useEdgeDetection?: boolean;
    edgeIntensity?: number;
    useSharpen?: boolean;
    sharpness?: number;
    contrast?: number;
    brightness?: number;
    invert?: boolean;
    format?: 'text' | 'html' | 'svg';
}
export interface AnalyzeSpatialLayoutArgs {
    source: string;
    width?: number;
    edgeIntensity?: number;
}
export interface McpToolResponse {
    [x: string]: unknown;
    content: Array<{
        type: 'text';
        text: string;
    }>;
}
/**
 * Tool Handler: convert_image
 */
export declare function handleConvertImage(args: ConvertImageArgs): Promise<McpToolResponse>;
/**
 * Tool Handler: analyze_spatial_layout
 */
export declare function handleAnalyzeSpatialLayout(args: AnalyzeSpatialLayoutArgs): Promise<McpToolResponse>;
/**
 * Tool Handler: get_presets
 */
export declare function handleGetPresets(): Promise<McpToolResponse>;
//# sourceMappingURL=tools.d.ts.map