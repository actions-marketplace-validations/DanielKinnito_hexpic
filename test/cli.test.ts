import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { runCli } from '../bin/hexpic';

describe('HexPic CLI (bin/hexpic.ts)', () => {
  const testDir = path.join(__dirname, 'fixtures-cli');
  const samplePngPath = path.join(testDir, 'sample.png');
  const outputSvgPath = path.join(testDir, 'output.svg');
  const outputTxtPath = path.join(testDir, 'output.txt');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

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

  afterEach(() => {
    if (fs.existsSync(outputSvgPath)) fs.unlinkSync(outputSvgPath);
    if (fs.existsSync(outputTxtPath)) fs.unlinkSync(outputTxtPath);
  });

  it('should display help message on --help or -h', async () => {
    const res = await runCli(['--help']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('hexpic [image] [options]');
    expect(res.stdout).toContain('--output');
    expect(res.stdout).toContain('--format');
  });

  it('should display version on --version or -v', async () => {
    const res = await runCli(['--version']);
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should convert local image to SVG file', async () => {
    const res = await runCli([
      samplePngPath,
      '--output', outputSvgPath,
      '--width', '30',
      '--dithering', 'atkinson'
    ]);

    expect(res.code).toBe(0);
    expect(fs.existsSync(outputSvgPath)).toBe(true);
    const content = fs.readFileSync(outputSvgPath, 'utf8');
    expect(content).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(content).toContain('</svg>');
  });

  it('should convert local image to text file', async () => {
    const res = await runCli([
      samplePngPath,
      '--output', outputTxtPath,
      '--format', 'text',
      '--width', '25'
    ]);

    expect(res.code).toBe(0);
    expect(fs.existsSync(outputTxtPath)).toBe(true);
    const content = fs.readFileSync(outputTxtPath, 'utf8');
    expect(content.split('\n').length).toBeGreaterThan(5);
  });

  it('should output to stdout when no output file is specified', async () => {
    const res = await runCli([
      samplePngPath,
      '--format', 'text',
      '--width', '15'
    ]);

    expect(res.code).toBe(0);
    expect(res.stdout.length).toBeGreaterThan(0);
  });

  it('should fallback to GITHUB_REPOSITORY_OWNER avatar when no image is specified', async () => {
    // Mock fetch for GitHub avatar URL
    const originalFetch = globalThis.fetch;
    const pngBuffer = fs.readFileSync(samplePngPath);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength)
    } as any);

    try {
      const res = await runCli(
        ['--output', outputSvgPath, '--width', '20'],
        { GITHUB_REPOSITORY_OWNER: 'testowner' }
      );
      expect(res.code).toBe(0);
      expect(globalThis.fetch).toHaveBeenCalledWith('https://github.com/testowner.png', expect.anything());
      expect(fs.existsSync(outputSvgPath)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return error when file does not exist', async () => {
    const res = await runCli(['./non-existent-image.png']);
    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain('not found');
  });
});
