import type { Wllama } from '@wllama/wllama/esm/index.js';
import type { InferenceParams } from './types';

export async function benchmark(
  wllama: Wllama,
  modelLabel: string,
  params: InferenceParams
) {
  const samples: { prompt: number; decode: number }[] = [];
  const maxTokens = Math.min(
    64,
    Math.floor(wllama.getLoadedContextInfo().n_ctx / 2)
  );
  for (let run = 0; run < 4; run++) {
    // Vary the prefix so repeated runs do not just measure cached prefill.
    const result = await wllama.createCompletion({
      prompt: `${Date.now()}-${run}: Write a detailed explanation of how rain forms.`,
      max_tokens: maxTokens,
      temperature: 0,
      seed: 42,
      ignore_eos: true,
    });
    if (!result.timings)
      throw new Error('Upstream did not return benchmark timings');
    if (run > 0) {
      samples.push({
        prompt: result.timings.prompt_per_second,
        decode: result.timings.predicted_per_second,
      });
    }
  }
  const output: string[][] = [
    ['model', 'requested backend', 'threads', 'test', 't/s'],
    ['---', '---', '---', '---', '---'],
  ];
  for (const test of ['prompt', 'decode'] as const) {
    const values = samples.map((sample) => sample[test]);
    const average =
      values.reduce((sum, value) => sum + value, 0) / values.length;
    output.push([
      modelLabel,
      params.backend,
      String(wllama.getNumThreads()),
      test,
      `${average.toFixed(2)} (range ${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)})`,
    ]);
  }
  return {
    output,
    markdown: output.map((row) => `| ${row.join(' | ')} |`).join('\n'),
  };
}
