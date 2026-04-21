import type { Options } from 'tsup';

const baseConfig: Options = {
  entry: {
    index: './index.ts',
    'wasm-from-cdn': './src/wasm-from-cdn.ts',
  },
  format: ['cjs', 'esm'],
  outDir: 'esm',
  clean: true,
};

// const nodeConfig: Options = {
//   ...baseConfig,
//   platform: "node",
// };

const browserConfig: Options = {
  ...baseConfig,
  platform: 'browser',
  target: 'es2020',
  splitting: false,
  outDir: 'esm',
};

export default [browserConfig];
