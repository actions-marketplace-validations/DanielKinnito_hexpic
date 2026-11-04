#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { HexPic } from '../src/HexPic';
import { decodeImageBuffer, resolveImageSource } from '../src/node/imageDecoder';
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

export function parseArgs(args: string[]): { options: CliOptions; showHelp: boolean; showVersion: boolean } {
  const options: CliOptions = {};
  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      showHelp = true;
    } else if (arg === '-v' || arg === '--version') {
      showVersion = true;
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg === '-f' || arg === '--format') {
      const fmt = args[++i]?.toLowerCase();
      if (fmt === 'svg' || fmt === 'text' || fmt === 'html') {
        options.format = fmt;
      }
    } else if (arg === '-w' || arg === '--width') {
      options.width = parseInt(args[++i], 10);
    } else if (arg === '--height') {
      options.height = parseInt(args[++i], 10);
    } else if (arg === '-c' || arg === '--color-mode') {
      const mode = args[++i]?.toLowerCase();
      if (mode === 'color' || mode === 'monochrome') {
        options.colorMode = mode;
      }
    } else if (arg === '-d' || arg === '--dithering') {
      options.dithering = args[++i]?.toLowerCase() as DitheringMode;
    } else if (arg === '--charset') {
      options.charset = args[++i];
    } else if (arg === '--font-size') {
      options.fontSize = parseFloat(args[++i]);
    } else if (arg === '--bg') {
      options.bgColor = args[++i];
    } else if (arg === '--fg') {
      options.fgColor = args[++i];
    } else if (arg === '--contrast') {
      options.contrast = parseFloat(args[++i]);
    } else if (arg === '--brightness') {
      options.brightness = parseFloat(args[++i]);
    } else if (arg === '--invert') {
      options.invert = true;
    } else if (!arg.startsWith('-') && !options.input) {
      options.input = arg;
    }
  }

  return { options, showHelp, showVersion };
}

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<CliResult> {
  const { options, showHelp, showVersion } = parseArgs(argv);

  if (showHelp) {
    return { code: 0, stdout: HELP_TEXT.trim(), stderr: '' };
  }

  if (showVersion) {
    let version = '0.3.1';
    try {
      const pkgPath = path.resolve(__dirname, '../package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        version = pkg.version || version;
      }
    } catch {}
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
  let buffer: Buffer;
  try {
    buffer = await resolveImageSource(inputSource);
  } catch (err: any) {
    return {
      code: 1,
      stdout: '',
      stderr: `Error reading image: ${err?.message || err}`
    };
  }

  // Decode and process
  try {
    const decoded = decodeImageBuffer(buffer);
    const hexpic = new HexPic();
    const result = hexpic.fromPixels(decoded.data, decoded.width, decoded.height, {
      width: options.width ?? 70,
      height: options.height,
      colorMode: options.colorMode ?? 'color',
      dithering: options.dithering ?? 'atkinson',
      charset: options.charset ?? 'normal',
      contrast: options.contrast ?? 100,
      brightness: options.brightness ?? 100,
      invert: options.invert ?? false
    });

    // Determine output format
    let format = options.format;
    if (!format) {
      if (options.output) {
        const lowerOut = options.output.toLowerCase();
        if (lowerOut.endsWith('.html') || lowerOut.endsWith('.htm')) {
          format = 'html';
        } else if (lowerOut.endsWith('.txt')) {
          format = 'text';
        } else {
          format = 'svg';
        }
      } else {
        format = 'text';
      }
    }

    let outputContent: string;
    if (format === 'svg') {
      outputContent = result.toSvg(options.fontSize ?? 12, options.bgColor, options.fgColor);
    } else if (format === 'html') {
      outputContent = result.html;
    } else {
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
    } else {
      return {
        code: 0,
        stdout: outputContent,
        stderr: ''
      };
    }
  } catch (err: any) {
    return {
      code: 1,
      stdout: '',
      stderr: `Error generating ASCII art: ${err?.message || err}`
    };
  }
}

// Direct invocation handler
if (require.main === module) {
  runCli(process.argv.slice(2)).then(res => {
    if (res.stdout) process.stdout.write(res.stdout + (res.stdout.endsWith('\n') ? '' : '\n'));
    if (res.stderr) process.stderr.write(res.stderr + (res.stderr.endsWith('\n') ? '' : '\n'));
    process.exit(res.code);
  });
}
