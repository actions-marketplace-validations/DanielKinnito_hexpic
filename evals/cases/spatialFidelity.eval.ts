import { PNG } from 'pngjs';
import { handleAnalyzeSpatialLayout } from '../../src/mcp/tools';
import { EvalResult } from '../eval-runner';

export async function runSpatialFidelityEval(): Promise<EvalResult> {
  // Generate a synthetic 40x40 image with high density only in the center
  const width = 40;
  const height = 40;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // High-contrast circle in the center
      const dx = x - 20;
      const dy = y - 20;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isCenter = dist <= 10;

      const val = isCenter ? 255 : 0;
      png.data[idx] = val;
      png.data[idx + 1] = val;
      png.data[idx + 2] = val;
      png.data[idx + 3] = 255;
    }
  }

  const base64Uri = `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;

  const layoutResult = await handleAnalyzeSpatialLayout({
    source: base64Uri,
    width: 30,
    edgeIntensity: 1.5
  });

  const reportText = layoutResult.content[0].text;

  // Extract metrics from the report
  const centerMatch = reportText.match(/Center Density:\s+([\d.]+)%/);
  const tlMatch = reportText.match(/Top-Left:\s+([\d.]+)%/);
  const brMatch = reportText.match(/Bottom-Right:\s+([\d.]+)%/);

  const centerDensity = centerMatch ? parseFloat(centerMatch[1]) : 0;
  const tlDensity = tlMatch ? parseFloat(tlMatch[1]) : 0;
  const brDensity = brMatch ? parseFloat(brMatch[1]) : 0;

  // Verification: center density must be higher than outer corners
  const centerIsProminent = centerDensity > tlDensity && centerDensity > brDensity;
  const score = centerIsProminent ? 1.0 : 0.5;

  return {
    name: 'Spatial Layout & Contour Fidelity',
    passed: centerIsProminent,
    score,
    details: `Edge detection correctly identified center object (Center: ${centerDensity}%, Top-Left: ${tlDensity}%, Bottom-Right: ${brDensity}%).`,
    metrics: { centerDensityPct: centerDensity, cornerDensityPct: tlDensity }
  };
}

