import fs from 'fs';
import path from 'path';
import { runToolCallingEval } from './cases/toolCalling.eval';
import { runSelfCorrectionEval } from './cases/selfCorrection.eval';
import { runSpatialFidelityEval } from './cases/spatialFidelity.eval';
import { runTokenEfficiencyEval } from './cases/tokenEfficiency.eval';

export interface EvalResult {
  name: string;
  passed: boolean;
  score: number; // 0.0 to 1.0
  details: string;
  metrics?: Record<string, number | string>;
}

async function main() {
  console.log('='.repeat(70));
  console.log('HexPic Agent Evaluation Suite (Model Context Protocol & Evals)');
  console.log('='.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Environment: Node.js ${process.version}\n`);

  const results: EvalResult[] = [];

  try {
    console.log('[1/4] Running Tool-Calling Schema Adherence Eval...');
    results.push(await runToolCallingEval());

    console.log('[2/4] Running Self-Healing & Error Recovery Eval...');
    results.push(await runSelfCorrectionEval());

    console.log('[3/4] Running Spatial Layout & Contour Fidelity Eval...');
    results.push(await runSpatialFidelityEval());

    console.log('[4/4] Running Token Economy & Density Efficiency Eval...');
    results.push(await runTokenEfficiencyEval());
  } catch (err: any) {
    console.error('Fatal error during eval execution:', err);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('EVALUATION SCORECARD');
  console.log('='.repeat(70));

  let totalScore = 0;
  let allPassed = true;

  for (const res of results) {
    const status = res.passed ? 'PASS' : 'FAIL';
    const scorePct = (res.score * 100).toFixed(1);
    console.log(`[${status}] ${res.name.padEnd(45)} Score: ${scorePct.padStart(5)}%`);
    console.log(`       Details: ${res.details}`);
    if (res.metrics) {
      console.log(`       Metrics: ${JSON.stringify(res.metrics)}`);
    }
    totalScore += res.score;
    if (!res.passed) allPassed = false;
  }

  const overallScore = ((totalScore / results.length) * 100).toFixed(1);
  console.log('-'.repeat(70));
  console.log(`Overall Agent Readiness Benchmark: ${overallScore}% (${results.filter(r => r.passed).length}/${results.length} passed)`);
  console.log('='.repeat(70));

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

