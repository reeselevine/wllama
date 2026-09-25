# Local wllama app

This app uses the published upstream `@wllama/wllama` 3.6.1 package, while
retaining this fork's UI and model list. It does not require building the library
at the repository root or compiling llama.cpp.

```sh
cd examples/main
npm ci
npm run dev
```

For deployment, run `npm run build` and serve the contents of `dist/` at the
same origin (scheme, hostname, and port) as the existing app. Conversations,
custom model URLs, and settings retain their localStorage keys. Upstream uses
the same OPFS `cache` directory and URL-based filenames for cached models;
keep the browser's site data to reuse downloads.

The default WASM binary is bundled in `dist/assets/`. Browsers needing upstream's
compatibility mode (including Safari and Firefox without JSPI) also download
version-matched worker/WASM assets from jsDelivr, so those browsers require
network access. Compatibility mode can be slower.

Use HTTPS or localhost. Configure the production server to send:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Development and `npm run preview` set these headers automatically. Serve `.wasm`
files with `application/wasm`. The app uses relative asset paths for subdirectory
hosting. The examples/main deployment workflow now builds only this app.

## Changes from the fork

- CPU selects `n_gpu_layers: 0`; WebGPU requests all layers. The GPU indicator
  describes the requested backend, not verified layer placement.
- Chat templates and streaming are handled by upstream's chat completion API.
  Stop cancels the request. Prefill/decode speeds show the latest response timings;
  Reset clears the displayed timings.
- Context, threads, temperature, supported KV cache types, and Flash Attention
  controls remain. Saved `bf16` and `iq4_nl` cache selections fall back to Auto
  because upstream's API does not support those values.
- The completion benchmark runs one warmup and three measured completions,
  reporting prompt/decode speeds. It is not comparable to the fork's synthetic
  pp512/tg64 tests. The perplexity control was removed because upstream removed that API.

The old library sources remain in the repository for reference; the app no
longer links to them. To update upstream, install a new explicit package version,
review its API changes, and rebuild the app.
