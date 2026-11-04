import { z } from 'zod';
import { convertImageSchema, handleConvertImage } from '../../src/mcp/tools';
import { EvalResult } from '../eval-runner';

export async function runSelfCorrectionEval(): Promise<EvalResult> {
  const validator = z.object(convertImageSchema);

  // Test 1: Typos in enum (e.g. "atkin" instead of "atkinson")
  const malformedDither = {
    source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    dithering: 'atkin'
  };

  const ditherResult = validator.safeParse(malformedDither);
  const givesActionableDitherHint = !ditherResult.success &&
    ditherResult.error.issues.some(issue =>
      issue.message.includes('Invalid option') ||
      issue.message.includes('Invalid enum value') ||
      issue.code === 'invalid_value' ||
      issue.code === 'invalid_enum_value'
    );

  // Test 2: Local file error message gives full resolved path
  let givesActionablePathHint = false;
  try {
    await handleConvertImage({ source: './missing-file-sample-404.png' });
  } catch (err: any) {
    givesActionablePathHint = err.message.includes('Local image file does not exist') &&
      err.message.includes('resolved to:');
  }

  // Test 3: Out-of-bounds width (width: 500 when max is 300)
  const malformedWidth = {
    source: './test.png',
    width: 500
  };
  const widthResult = validator.safeParse(malformedWidth);
  const givesBoundHint = !widthResult.success &&
    widthResult.error.issues.some(issue =>
      issue.message.includes('300') ||
      issue.code === 'too_big'
    );

  let checks = 0;
  if (givesActionableDitherHint) checks++;
  if (givesActionablePathHint) checks++;
  if (givesBoundHint) checks++;

  const score = checks / 3;

  return {
    name: 'Self-Healing & Error Recovery Guidance',
    passed: score === 1.0,
    score,
    details: `Agent received actionable self-correction feedback on ${checks}/3 failure modes (schema enums, path resolution, value boundaries).`,
    metrics: { actionableChecksPassed: checks, totalChecks: 3 }
  };
}
