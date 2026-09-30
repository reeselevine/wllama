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
hosting.

## GitHub Pages

The `Deploy wllama app to GitHub Pages` workflow builds only this app and publishes `dist/` to the root of the `gh-pages` branch. Run it manually from the Actions tab with `master` selected after pushing changes. It serves the app at `https://reeselevine.github.io/wllama/`; do not add another `wllama` directory to the deployment output.

The repository's Pages settings should use `Deploy from a branch`, branch `gh-pages`, folder `/(root)`. The upstream docs deployment is restricted to `ngxson/wllama` so it cannot replace this app's deployment. These settings are configured on GitHub, not by the workflow.

## Changes from the fork

- CPU selects `n_gpu_layers: 0`; WebGPU requests all layers. The GPU indicator
  describes the requested backend, not verified layer placement.
- Chat templates and streaming are handled by upstream's chat completion API.
  Stop cancels the request. Prefill/decode speeds show the latest response timings;
  Reset clears the displayed timings.
- Chat has saved toggles for reasoning and the weather tool, both off by default. Reasoning uses the model's `enable_thinking` template option and appears in a collapsible section. Models must support the selected features; the toggles apply to the next message without reloading the model.
- The weather tool requests current conditions and a 7-day forecast directly from Open-Meteo, with no key for noncommercial use. Include a state or country, for example "Santa Cruz, CA". Tool results are saved with the conversation and reused for follow-up questions. Stop cancels both generation and weather requests.
- Context, threads, temperature, supported KV cache types, and Flash Attention
  controls remain. Saved `bf16` and `iq4_nl` cache selections fall back to Auto
  because upstream's API does not support those values.
- The completion benchmark runs one warmup and three measured completions,
  reporting prompt/decode speeds. It is not comparable to the fork's synthetic
  pp512/tg64 tests. The perplexity control was removed because upstream removed that API.

The library sources outside this app follow upstream; the app uses the published package instead. To update the app's library, install a new explicit package version,
review its API changes, and rebuild the app.

Run the chat and weather regression checks from the repository root with `npx playwright test examples/main/tests/chat-completion.spec.ts --workers=1` after installing the root development dependencies.
