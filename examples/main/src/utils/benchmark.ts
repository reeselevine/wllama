import type { Wllama } from '@reeselevine/wllama-webgpu';
import type { InferenceParams } from './types';

const WIKITEXT_URL =
  'https://raw.githubusercontent.com/wangfin/QAsystem/refs/heads/master/QAManagement/language_model/data/wikitext-2/valid.txt';

function clampSamples(
  value: number,
  nContext: number,
  fallback: number = 1
): number {
  return Math.max(fallback, Math.min(Math.floor(value), Math.floor(nContext)));
}

function toMarkdownTable(rows: any[][]) {
  return rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
}

const BENCH_WARMUP_RUNS = 1;
const BENCH_MEASURED_RUNS = 3;

export async function benchmark(
  wllama: Wllama,
  modelLabel: string,
  params: InferenceParams
) {
  const loadedContextInfo = wllama.getLoadedContextInfo();
  const ppSamples = clampSamples(512, loadedContextInfo.n_batch);
  const tgSamples = clampSamples(64, loadedContextInfo.n_ctx);
  const output: any[][] = [
    ['model', 'backend', 'threads', 'test', 't/s'],
    ['---', '---', '---', '---', '---'],
  ];

  for (const [type, nSamples] of [
    ['pp', ppSamples],
    ['tg', tgSamples],
  ] as const) {
    const results: number[] = [];
    const totalRuns = BENCH_WARMUP_RUNS + BENCH_MEASURED_RUNS;

    for (let runIndex = 0; runIndex < totalRuns; runIndex++) {
      console.log('Running benchmark', {
        modelLabel,
        type,
        n_samples: nSamples,
        run: runIndex + 1,
        warmup: runIndex < BENCH_WARMUP_RUNS,
      });
      const result = (await wllama._testBenchmark(type, nSamples)) as {
        success?: boolean;
        message?: string;
        t_ms: number;
      };
      if (!result.success) {
        throw new Error(result.message || `Benchmark failed for ${type}`);
      }
      if (runIndex >= BENCH_WARMUP_RUNS) {
        results.push(nSamples / (result.t_ms / 1000));
      }
    }

    const tAvg =
      results.reduce((sum, value) => sum + value, 0) / results.length;
    const tPlusMinus = Math.abs(Math.max(...results) - Math.min(...results));
    output.push([
      modelLabel,
      params.backend,
      wllama.getNumThreads(),
      `${type} ${nSamples}`,
      `${tAvg.toFixed(2)} ± ${tPlusMinus.toFixed(2)}`,
    ]);
  }

  console.table(output);
  const markdown = toMarkdownTable(output);
  console.log(markdown);
  return { output, markdown };
}

export async function perplexity(
  wllama: Wllama,
  modelLabel: string,
  params: InferenceParams
) {
  const limitTokens = clampSamples(params.nContext, 2048);
  const output: any[][] = [
    ['model', 'backend', 'PPL', 'n_tokens'],
    ['---', '---', '---', '---'],
  ];

  const wikitext = await fetch(WIKITEXT_URL).then((res) => res.text());
  let tokens = await wllama.tokenize(wikitext.substring(0, limitTokens * 16));
  tokens = tokens.slice(0, limitTokens);

  console.log('Running perplexity', {
    modelLabel,
    n_tokens: tokens.length,
  });
  const result = (await wllama._testPerplexity(tokens)) as {
    success?: boolean;
    message?: string;
    ppl: number;
  };
  if (!result.success) {
    throw new Error(result.message || 'Perplexity failed');
  }
  output.push([modelLabel, params.backend, result.ppl, tokens.length]);

  console.table(output);
  const markdown = toMarkdownTable(output);
  console.log(markdown);
  return { output, markdown };
}
