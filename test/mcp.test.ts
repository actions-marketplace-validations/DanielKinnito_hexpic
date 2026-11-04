import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { handleConvertImage, handleAnalyzeSpatialLayout, handleGetPresets } from '../src/mcp/tools';

describe('MCP Tools', () => {
  const testDir = path.join(__dirname, 'fixtures-mcp');
  const samplePngPath = path.join(testDir, 'box.png');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a 20x20 image with a white box in the center on a black background
    const png = new PNG({ width: 20, height: 20 });
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = (y * 20 + x) * 4;
        const isBox = x >= 5 && x <= 15 && y >= 5 && y <= 15;
        const val = isBox ? 255 : 0;
        png.data[idx] = val;
        png.data[idx + 1] = val;
        png.data[idx + 2] = val;
        png.data[idx + 3] = 255;
      }
    }
    fs.writeFileSync(samplePngPath, PNG.sync.write(png));
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('handleConvertImage', () => {
    it('should convert local file to ASCII with default options', async () => {
      const result = await handleConvertImage({
        source: samplePngPath,
        width: 20
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('```');
      expect(result.content[0].text).toContain('Dimensions: 20 cols');
    });

    it('should support dithering and charset options', async () => {
      const result = await handleConvertImage({
        source: samplePngPath,
        width: 20,
        dithering: 'atkinson',
        charset: 'blockelement'
      });

      expect(result.content[0].text).toBeDefined();
    });

    it('should return helpful self-healing error message if file does not exist', async () => {
      await expect(handleConvertImage({ source: './missing.png' })).rejects.toThrow(
        /Local image file does not exist/
      );
    });
  });

  describe('handleAnalyzeSpatialLayout', () => {
    it('should return ASCII contour map and spatial density analysis', async () => {
      const result = await handleAnalyzeSpatialLayout({
        source: samplePngPath,
        width: 20,
        edgeIntensity: 1.0
      });

      expect(result).toHaveProperty('content');
      const text = result.content[0].text;
      expect(text).toContain('Contour Map');
      expect(text).toContain('Spatial Density Distribution');
      expect(text).toContain('Center Density');
    });
  });

  describe('handleGetPresets', () => {
    it('should return full list of charsets and dithering algorithms', async () => {
      const result = await handleGetPresets();
      const text = result.content[0].text;
      expect(text).toContain('normal');
      expect(text).toContain('blockelement');
      expect(text).toContain('atkinson');
      expect(text).toContain('floyd-steinberg');
    });
  });
});
