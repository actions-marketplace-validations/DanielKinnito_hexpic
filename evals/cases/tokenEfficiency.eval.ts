import { PNG } from 'pngjs';
import { handleConvertImage } from '../../src/mcp/tools';
import { EvalResult } from '../eval-runner';

export async function runTokenEfficiencyEval(): Promise<EvalResult> {
  const width = 64;
  const height = 64;
  const png = new PNG({ width, height });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = (i % 256);
    png.data[i + 1] = ((i * 2) % 256);
    png.data[i + 2] = ((i * 3) % 256);
    png.data[i + 3] = 255;
  }

  const base64Uri = `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;

  const result = await handleConvertImage({
    source: base64Uri,
    width: 40,
    dithering: 'atkinson'
  });

  const text = result.content[0].text;
  // Estimate tokens (~4 characters per token in English / code)
  const estimatedTextTokens = Math.ceil(text.length / 4);

  // Standard vision token cost for a high-res image tile in OpenAI/Claude vision APIs
  const standardVisionTileTokens = 1600;

  const tokenSavingsPercent = (((standardVisionTileTokens - estimatedTextTokens) / standardVisionTileTokens) * 100).toFixed(1);

  const passed = estimatedTextTokens < standardVisionTileTokens;

  return {
    name: 'Token Economy & Density Efficiency',
    passed,
    score: passed ? 1.0 : 0.0,
    details: `HexPic ASCII output consumed ~${estimatedTextTokens} text tokens vs ${standardVisionTileTokens} standard vision tokens (${tokenSavingsPercent}% token reduction).`,
    metrics: { estimatedTokens: estimatedTextTokens, visionBaseline: standardVisionTileTokens, savingsPct: `${tokenSavingsPercent}%` }
  };
}

