import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { decodeImageBuffer, resolveImageSource } from '../src/node/imageDecoder';

describe('imageDecoder (Node headless)', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const pngPath = path.join(testDir, 'test-sample.png');
  const jpegPath = path.join(testDir, 'test-sample.jpg');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Generate a valid 4x4 PNG fixture
    const png = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 255;   // R
      png.data[i + 1] = 0; // G
      png.data[i + 2] = 0; // B
      png.data[i + 3] = 255; // A
    }
    fs.writeFileSync(pngPath, PNG.sync.write(png));

    // Generate a valid 4x4 JPEG fixture
    const jpegBuffer = jpeg.encode({
      data: Buffer.from(png.data),
      width: 4,
      height: 4
    }, 90);
    fs.writeFileSync(jpegPath, jpegBuffer.data);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('decodeImageBuffer', () => {
    it('should decode a valid PNG buffer into RGBA pixels and dimensions', () => {
      const buffer = fs.readFileSync(pngPath);
      const decoded = decodeImageBuffer(buffer);

      expect(decoded.width).toBe(4);
      expect(decoded.height).toBe(4);
      expect(decoded.data.length).toBe(4 * 4 * 4);
      // Red channel of first pixel should be 255
      expect(decoded.data[0]).toBe(255);
    });

    it('should decode a valid JPEG buffer into RGBA pixels and dimensions', () => {
      const buffer = fs.readFileSync(jpegPath);
      const decoded = decodeImageBuffer(buffer);

      expect(decoded.width).toBe(4);
      expect(decoded.height).toBe(4);
      expect(decoded.data.length).toBe(4 * 4 * 4);
      // Compression might slightly shift 255, but red should dominate
      expect(decoded.data[0]).toBeGreaterThan(200);
    });

    it('should throw an informative error on invalid buffer', () => {
      const corrupt = Buffer.from('not an image data string');
      expect(() => decodeImageBuffer(corrupt)).toThrow(/Unsupported or corrupted image format/);
    });
  });

  describe('resolveImageSource', () => {
    it('should resolve a base64 data URI', async () => {
      const buffer = fs.readFileSync(pngPath);
      const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
      const resolved = await resolveImageSource(dataUri);

      expect(Buffer.isBuffer(resolved)).toBe(true);
      expect(resolved.length).toBe(buffer.length);
    });

    it('should resolve a valid local file path', async () => {
      const resolved = await resolveImageSource(pngPath);
      expect(Buffer.isBuffer(resolved)).toBe(true);
      expect(resolved.length).toBeGreaterThan(0);
    });

    it('should throw an actionable error if local file does not exist', async () => {
      await expect(resolveImageSource('./nonexistent-image-file.png')).rejects.toThrow(
        /Local image file does not exist/
      );
    });
  });
});

