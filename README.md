# HexPic

> **Studio-grade image to ASCII conversion plugin** for modern websites, React apps, and Node.js. Powered by error-diffusion dithering, edge detection, and full-color HTML rendering.

HexPic eliminates the need for external tools or clunky server-side uploads. It processes images directly inside the browser using HTML5 Canvas, producing crisp, high-definition ASCII art with the same algorithmic techniques used by professional text-art tools like [asciiart.eu](https://www.asciiart.eu/image-to-ascii).

---

## ✨ Features

- 🎯 **Advanced Dithering Algorithms**: Atkinson (classic Mac stippling), Floyd-Steinberg, JJN, and Stucki error diffusion to eliminate muddy banding.
- 📐 **Sobel Edge Detection & 3×3 Sharpening**: Accentuate facial features, hair, text, and silhouettes with precision convolution kernels.
- 🎨 **Full-Color TrueColor Output**: Render ASCII in monochrome or full-color HTML with styled `<span style="color:rgb(...)">` glyphs.
- 🔠 **Curated Character Presets**: `codepage437` (DOS block `█▓▒░`), `blockelement`, `minimalist` (`#+- .`), `braille`, `extended`, `math`, `alphanumeric`, and `grayscale`.
- 🌌 **Space Density Filter**: Clean negative space that prevents dirty punctuation clutter in image backgrounds.
- 🔌 **Zero-Effort Drop-in Plugin**: Convert existing `<img>` tags simply with `data-hexpic` attributes and `HexPic.init()`.
- ⚛️ **First-Class React Support**: Includes a responsive `useHexPic` hook and `<HexPicImage />` drop-in component.
- 💾 **Export Pipeline**: One-click Copy to Clipboard, Download `.txt`, and Render-to-PNG export.

---

## 🚀 Installation

```bash
npm install hexpic
```

Or drop the UMD bundle directly into HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/hexpic/dist/index.umd.js"></script>
```

---

## 💡 Usage

### 1. Zero-Effort Drop-in HTML Plugin

Tag any `<img>` tag on your website with `data-hexpic` and call `HexPic.init()`:

```html
<!-- Automatically converted on load -->
<img 
  src="portrait.jpg" 
  data-hexpic 
  data-hexpic-width="100" 
  data-hexpic-dithering="atkinson" 
  data-hexpic-charset="blockelement" 
/>

<script src="dist/index.umd.js"></script>
<script>
  HexPic.init();
</script>
```

---

### 2. JavaScript / TypeScript API

```typescript
import HexPic from 'hexpic';

const hexpic = new HexPic({
  width: 100,
  dithering: 'atkinson',      // 'atkinson' | 'floyd-steinberg' | 'jjn' | 'stucki' | 'none'
  charset: 'blockelement',    // or 'normal', 'codepage437', 'braille', 'minimalist', etc.
  spaceDensity: 2,            // Suppresses noise in background whitespace
  useSharpen: true,           // 3x3 unsharp convolution kernel
  useEdgeDetection: true,     // Sobel edge filter
  edgeIntensity: 1.2,
  contrast: 110,
  brightness: 100
});

// Convert from URL, File, or <img> element
const result = await hexpic.fromUrl('avatar.png');

// Plain text ASCII
console.log(result.ascii);

// Colored HTML
document.getElementById('art').innerHTML = result.html;

// Export actions
await result.copyToClipboard();
result.saveAsText('my-art.txt');
result.saveAsPng('my-art.png', 12);
```

---

### 3. React / Next.js

```tsx
import React from 'react';
import { HexPicImage, useHexPic } from 'hexpic';

// Option A: Drop-in Component
export function ProfileBanner() {
  return (
    <HexPicImage
      src="/avatar.jpg"
      alt="User Profile"
      options={{
        width: 120,
        dithering: 'atkinson',
        charset: 'blockelement',
        colorMode: 'color' // Full-color TrueColor HTML rendering
      }}
      style={{ fontSize: '8px', lineHeight: '8px' }}
    />
  );
}

// Option B: Interactive Hook
export function AsciiEditor() {
  const { ascii, html, convert, copyToClipboard, saveAsPng, isLoading } = useHexPic({
    width: 100,
    dithering: 'atkinson',
    charset: 'normal'
  });

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files?.[0] && convert(e.target.files[0])} />
      <button onClick={() => copyToClipboard()}>Copy</button>
      <button onClick={() => saveAsPng('art.png')}>Download PNG</button>
      <pre>{isLoading ? 'Converting...' : ascii}</pre>
    </div>
  );
}
```

---

## ⚙️ Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `80` | Number of character columns in output |
| `height` | `number` | `40` | Height in rows (auto-scaled when aspect ratio is preserved) |
| `dithering` | `'none' \| 'atkinson' \| 'floyd-steinberg' \| 'jjn' \| 'stucki'` | `'none'` | Error-diffusion algorithm for smooth gradient shading |
| `charset` | `CharsetPreset \| string` | `'normal'` | Preset or custom characters ordered darkest to lightest |
| `colorMode` | `'monochrome' \| 'color'` | `'monochrome'` | Plain text or TrueColor HTML `<span>` elements |
| `spaceDensity` | `number` | `1` | Adds padding spaces to light end to eliminate dirty punctuation on backgrounds |
| `useEdgeDetection` | `boolean` | `false` | Sobel 3×3 edge filter to bring out outlines and features |
| `edgeIntensity` | `number` | `1.0` | Multiplier for edge contrast (0.1 to 2.0) |
| `useSharpen` | `boolean` | `false` | 3×3 unsharp convolution kernel |
| `sharpness` | `number` | `9` | Center weight for sharpening kernel (1 to 20) |
| `useThreshold` | `boolean` | `false` | Binary thresholding cutoff |
| `thresholdOffset` | `number` | `128` | Cutoff luminance (0 to 255) |
| `contrast` | `number` | `100` | Contrast percentage (0 to 250%) |
| `brightness` | `number` | `100` | Brightness percentage (0 to 250%) |
| `saturation` | `number` | `100` | Color saturation percentage (0 to 400%) |
| `hue` | `number` | `0` | Hue rotation angle in degrees (0 to 360°) |
| `grayscale` | `number` | `0` | Grayscale filter percentage (0 to 100%) |
| `sepia` | `number` | `0` | Sepia filter percentage (0 to 100%) |
| `invert` | `boolean` | `false` | Invert brightness and character palette |
| `invertEdgeColors` | `boolean` | `true` | Invert edge detection map for dark lines on bright backgrounds |
| `transparentFrame` | `number` | `0` | Border frame padding in characters (0 to 20) |
| `preserveAspectRatio` | `boolean` | `true` | Maintain source aspect ratio automatically |
| `fontAspectRatio` | `number` | `0.55` | Monospace character width-to-height ratio (0.55 prevents tall vertical stretching) |

---

## 🥊 Comparison with Other Solutions

| Feature | **HexPic** | Legacy `image-to-ascii` | `ascii-art` | Generic Canvas/Image Plugins |
|---|:---:|:---:|:---:|:---:|
| **Zero-Server Client Execution** | ✅ Yes (Pure Canvas & DOM) | ❌ Node.js only (canvas/C++ bindings) | ❌ Server / CLI focused | ✅ Client |
| **Drop-in `<img data-hexpic>`** | ✅ Automatic (`HexPic.init()`) | ❌ None | ❌ None | Varies |
| **Spatial Error Dithering** | ✅ Atkinson, Floyd-Steinberg, JJN, Stucki | ❌ None (harsh banding) | ⚠️ Basic dithering | ❌ Not applicable |
| **Sobel Edge Detection** | ✅ Built-in 3×3 convolution | ❌ None | ❌ None | ❌ Extra plugin required |
| **Unsharp Masking Sharpen** | ✅ Built-in 3×3 kernel | ❌ None | ❌ None | ❌ Extra plugin required |
| **Aspect Ratio Compensation** | ✅ Automatic (`0.55` ratio correction) | ❌ Manual math (often stretched) | ⚠️ Inconsistent | ❌ None |
| **Color Modes** | ✅ Monochrome & TrueColor HTML | ⚠️ ANSI terminal strings only | ⚠️ ANSI / rudimentary HTML | ✅ Raster RGB |
| **React Component & Hook** | ✅ `<HexPicImage />` & `useHexPic` | ❌ None | ❌ None | ⚠️ Component only |
| **Export Utilities** | ✅ Clipboard, `.txt`, Canvas PNG | ❌ Manual stream handling | ❌ CLI only | ⚠️ Download canvas only |
| **Interactive Studio GUI** | ✅ Full live web demo with drag resize | ❌ None | ❌ None | ❌ Static |

---

## 📜 License

MIT © [Daniel Kinnito](https://github.com/DanielKinnito)

