# hexpic

Browser and Node.js image-to-ASCII converter with error-diffusion dithering, edge convolution, and color HTML output.

[Live Demo](https://danielkinnito.github.io/hexpic/)

Processes images directly on the client using the HTML5 Canvas API without external servers or native binary dependencies.

---

## Features

- **Dithering algorithms**: Atkinson, Floyd-Steinberg, Jarvis-Judice-Ninke (JJN), and Stucki error-diffusion routines to prevent posterization and tonal banding.
- **Spatial convolution**: 3x3 Sobel edge detection and unsharp masking sharpen kernels to preserve outlines, contours, and facial features.
- **TrueColor HTML rendering**: Generates both plaintext character grids and styled HTML `<span>` elements preserving source 24-bit RGB values.
- **Character palettes**: Built-in presets for standard ASCII, Code Page 437 (`█▓▒░`), Block Elements (`█▀▄▌▐░▒▓`), Braille (`⣿⣶⣤⣀`), minimalist, numeric, math symbols, and custom strings.
- **Negative space padding**: Configurable whitespace density to suppress stray punctuation marks on light or uniform backgrounds.
- **Aspect ratio correction**: Built-in `0.55` font aspect ratio scaler to counter vertical stretching inherent to monospace typefaces.
- **Framework and runtime support**: Native ES modules (Vite, Next.js, Remix, Astro), CommonJS, UMD script tag, and React components (`<HexPicImage />`, `useHexPic`).
- **Model Context Protocol (MCP) Server**: Built-in stdio server (`hexpic-mcp`) allowing AI agents (Claude Desktop, Cursor, Antigravity) to drive image conversion and spatial composition analysis.
- **Headless Node engine**: Pure JavaScript image decoders for PNG and JPEG without native build dependencies or DOM requirements.
- **Export helpers**: Utilities for clipboard copying, `.txt` file generation, and raster PNG rendering via offscreen canvas.

---

## Installation

```bash
npm install hexpic
```

For browser environments without a build step:

```html
<script src="https://cdn.jsdelivr.net/npm/hexpic/dist/index.umd.js"></script>
```

---

## Usage

### Declarative HTML Plugin

Add `data-hexpic` to any `<img>` element and call `HexPic.init()`:

```html
<img 
  src="/images/profile.jpg" 
  data-hexpic 
  data-hexpic-width="100" 
  data-hexpic-dithering="atkinson" 
  data-hexpic-charset="blockelement" 
  data-hexpic-color-mode="color"
/>

<script src="https://cdn.jsdelivr.net/npm/hexpic/dist/index.umd.js"></script>
<script>
  HexPic.init();
</script>
```

### TypeScript / JavaScript API

```typescript
import HexPic from 'hexpic';

const converter = new HexPic({
  width: 100,
  dithering: 'atkinson',
  charset: 'blockelement',
  colorMode: 'color',
  useSharpen: true,
  useEdgeDetection: true,
  edgeIntensity: 1.0,
  spaceDensity: 1,
  contrast: 105,
  brightness: 100
});

// Accepts URL string, File object, or HTMLImageElement
const result = await converter.fromUrl('/avatar.png');

// Plaintext output
console.log(result.ascii);

// Colored HTML output
document.getElementById('output').innerHTML = result.html;

// Export methods
await result.copyToClipboard();
result.saveAsText('output.txt');
result.saveAsPng('output.png', 12);
result.saveAsSvg('output.svg', 12); // Scalable SVG for Markdown
const svgString = result.toSvg(12);
```

### GitHub Action (Automated Profile READMEs)

Generate and update crisp vector ASCII art SVGs directly in your GitHub profile repository or docs using GitHub's free runners. No server hosting, no manual file copying.

Create `.github/workflows/hexpic.yml` in your profile repository:

```yaml
name: Generate HexPic ASCII Banner

on:
  schedule:
    - cron: '0 0 * * 1' # Runs every Monday at midnight
  workflow_dispatch:    # Allows manual trigger with 1 click
  push:
    branches: [main]

jobs:
  ascii-art:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate ASCII Art SVG
        uses: DanielKinnito/hexpic@main
        with:
          # image defaults automatically to https://github.com/<owner>.png
          output: './assets/hexpic.svg'
          width: '70'
          color-mode: 'color'
          dithering: 'atkinson'

      - name: Commit and Push SVG
        uses: EndBug/add-and-commit@v9
        with:
          message: 'chore: update ascii banner'
          add: './assets/hexpic.svg'
```

#### Markdown Layout & Aesthetics

Because HexPic generates standard vector SVGs with tight bounding boxes (`viewBox`), you have full control over alignment and sizing in your `README.md`:

**1. Centered Header Banner**
```html
<div align="center">
  <img src="./assets/hexpic.svg" alt="ASCII Banner" width="600" />
</div>
```

**2. Side-by-Side Avatar and Bio**
```markdown
| <img src="./assets/hexpic.svg" width="280" alt="Avatar" /> | ### Hi, I'm Alex<br>Full-stack developer building open-source tools.<br><br>• Working on LLM agents<br>• Open to collaborations |
| :--- | :--- |
```

**3. Automatic Dark & Light Mode Switching**
```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hexpic-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/hexpic-light.svg">
  <img alt="HexPic ASCII Art" src="./assets/hexpic-dark.svg" width="500">
</picture>
```

---

### Command-Line Interface (CLI)

Run HexPic directly from your terminal or build scripts without a browser:

```bash
# Convert local image to SVG for your profile
npx hexpic ./profile.png -o ./assets/banner.svg -w 70

# Convert remote avatar using Atkinson dithering
npx hexpic https://github.com/octocat.png -o octocat.svg -d atkinson

# Print colored or monochrome ASCII to stdout
npx hexpic ./logo.png -f text -w 40 -c monochrome
```

#### CLI Options

| Flag | Argument | Description | Default |
|---|---|---|---|
| `-o`, `--output` | `<file>` | Output destination path (`.svg`, `.txt`, `.html`) | stdout |
| `-f`, `--format` | `svg \| text \| html` | Output format | `svg` (file) / `text` (stdout) |
| `-w`, `--width` | `<cols>` | Number of character columns | `70` |
| `--height` | `<rows>` | Number of rows (aspect ratio preserved if omitted) | auto |
| `-c`, `--color-mode` | `color \| monochrome` | Color mode | `color` |
| `-d`, `--dithering` | `<algorithm>` | `atkinson`, `floyd-steinberg`, `bayer`, `none` | `atkinson` |
| `--charset` | `<preset>` | `normal`, `minimalist`, `alphabetic`, `math`, `braille` | `normal` |
| `--font-size` | `<px>` | Monospace font size for SVG rendering | `12` |
| `--bg` | `<hex>` | Background color for SVG canvas | `#000000` |
| `--fg` | `<hex>` | Text color for monochrome SVG canvas | `#ffffff` |
| `--contrast` | `<pct>` | Contrast adjustment percentage | `100` |
| `--brightness` | `<pct>` | Brightness adjustment percentage | `100` |
| `--invert` | none | Invert image brightness | `false` |

### React / Next.js

HexPic components are SSR-safe and execute canvas routines after client mount:

```tsx
'use client';

import React from 'react';
import { HexPicImage, useHexPic } from 'hexpic';

// Component
export function Avatar() {
  return (
    <HexPicImage
      src="/user.jpg"
      alt="User Avatar"
      options={{
        width: 80,
        dithering: 'atkinson',
        charset: 'codepage437',
        colorMode: 'color'
      }}
      style={{ fontSize: '7px', lineHeight: '7px' }}
    />
  );
}

// Hook
export function Editor() {
  const { ascii, convert, copyToClipboard, saveAsPng, isLoading } = useHexPic({
    width: 90,
    dithering: 'floyd-steinberg',
    charset: 'normal'
  });

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && convert(e.target.files[0])} 
      />
      <button onClick={() => copyToClipboard()}>Copy</button>
      <button onClick={() => saveAsPng('art.png')}>Save PNG</button>
      <pre>{isLoading ? 'Processing...' : ascii}</pre>
    </div>
  );
}
```

### Model Context Protocol (MCP) Server

HexPic provides an official MCP server enabling AI agents (Claude Desktop, Cursor, Antigravity) to convert images and inspect spatial composition via stdio.

Add to your MCP client configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hexpic": {
      "command": "npx",
      "args": ["-y", "hexpic-mcp"]
    }
  }
}
```

#### Available MCP Tools:
- `convert_image`: Convert any image file, URL, or base64 data URI to ASCII with dithering and edge options.
- `analyze_spatial_layout`: Extract visual edge contours and quadrant density percentages for token-efficient vision understanding.
- `get_presets`: Retrieve all available character palettes and dithering algorithms.

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `80` | Number of horizontal character columns |
| `height` | `number` | `40` | Number of vertical rows (calculated automatically if `preserveAspectRatio` is true) |
| `dithering` | `'none' \| 'atkinson' \| 'floyd-steinberg' \| 'jjn' \| 'stucki'` | `'none'` | Error-diffusion dithering algorithm |
| `charset` | `CharsetPreset \| string` | `'normal'` | Built-in preset name or custom character palette ordered darkest to lightest |
| `colorMode` | `'monochrome' \| 'color'` | `'monochrome'` | Plain text monospace or 24-bit color HTML `<span>` output |
| `spaceDensity` | `number` | `1` | Padding spaces appended to character palette to suppress background noise |
| `useEdgeDetection` | `boolean` | `false` | Apply 3x3 Sobel convolution edge detection |
| `edgeIntensity` | `number` | `1.0` | Sobel gradient magnitude multiplier (0.1 to 2.0) |
| `invertEdgeColors` | `boolean` | `true` | Invert edge detection map for dark lines on bright backgrounds |
| `useSharpen` | `boolean` | `false` | Apply 3x3 unsharp masking convolution kernel |
| `sharpness` | `number` | `9` | Center weight for sharpening kernel (1 to 20) |
| `useThreshold` | `boolean` | `false` | Binary luminance thresholding |
| `thresholdOffset` | `number` | `128` | Threshold luminance cutoff point (0 to 255) |
| `contrast` | `number` | `100` | Contrast percentage adjustment (0 to 250) |
| `brightness` | `number` | `100` | Brightness percentage adjustment (0 to 250) |
| `saturation` | `number` | `100` | Color saturation percentage adjustment (0 to 400) |
| `hue` | `number` | `0` | Color hue rotation in degrees (0 to 360) |
| `grayscale` | `number` | `0` | Grayscale filter intensity (0 to 100) |
| `sepia` | `number` | `0` | Sepia filter intensity (0 to 100) |
| `invert` | `boolean` | `false` | Invert luminance map |
| `transparentFrame` | `number` | `0` | Outer border frame padding in character units (0 to 20) |
| `preserveAspectRatio` | `boolean` | `true` | Compute output height from input image aspect ratio |
| `fontAspectRatio` | `number` | `0.55` | Monospace character width-to-height ratio used for height correction |

---

## Comparison

| Capability | hexpic | image-to-ascii | ascii-art | Generic Canvas Filters |
|---|:---:|:---:|:---:|:---:|
| Client-side execution | Yes (browser Canvas) | No (Node.js runtime required) | No (CLI / server focused) | Yes |
| Declarative `<img data-hexpic>` | Yes | No | No | Varies |
| Error-diffusion dithering | Atkinson, Floyd-Steinberg, JJN, Stucki | No | Basic | N/A |
| Edge detection & sharpening | Built-in 3x3 convolution | No | No | Requires extra libraries |
| Monospace aspect correction | Automatic (`fontAspectRatio: 0.55`) | Manual calculation | Inconsistent | N/A |
| Color output | TrueColor 24-bit HTML | ANSI terminal codes | ANSI / HTML strings | Raster RGB |
| React component & hook | Yes (`<HexPicImage />`, `useHexPic`) | No | No | Component only |
| Export utilities | Clipboard, `.txt`, Canvas PNG | Stream pipe | Console output | Canvas download |

---

## License

MIT
