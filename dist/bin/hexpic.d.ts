#!/usr/bin/env node
import { ColorMode, DitheringMode } from '../src/types';
export interface CliOptions {
    input?: string;
    output?: string;
    format?: 'svg' | 'text' | 'html';
    width?: number;
    height?: number;
    colorMode?: ColorMode;
    dithering?: DitheringMode;
    charset?: string;
    fontSize?: number;
    bgColor?: string;
    fgColor?: string;
    contrast?: number;
    brightness?: number;
    invert?: boolean;
}
export interface CliResult {
    code: number;
    stdout: string;
    stderr: string;
}
export declare function parseArgs(args: string[]): {
    options: CliOptions;
    showHelp: boolean;
    showVersion: boolean;
};
export declare function runCli(argv: string[], env?: NodeJS.ProcessEnv): Promise<CliResult>;
//# sourceMappingURL=hexpic.d.ts.map