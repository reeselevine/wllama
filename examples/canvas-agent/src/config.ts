import wllamaSingle from '@wllama/wllama/src/single-thread/wllama.wasm?url';
import wllamaMulti from '@wllama/wllama/src/multi-thread/wllama.wasm?url';

export const WLLAMA_CONFIG_PATHS = {
  'single-thread/wllama.wasm': wllamaSingle,
  'multi-thread/wllama.wasm': wllamaMulti,
};

export const MODELS = [
  {
    label: 'Qwen3 0.6B — fastest (~640MB)',
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf',
    size: 639447744,
  },
  {
    label: 'Qwen2.5 0.5B — fast (~676MB)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf',
    size: 675710816,
  },
  {
    label: 'Qwen3 1.7B — balanced (~1.1GB)',
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
    size: 1107409472,
  },
  {
    label: 'Llama 3.2 1B — (~808MB)',
    url: 'https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-1b-instruct-q4_k_m.gguf',
    size: 807690656,
  },
];

export const SYSTEM_PROMPT = `You are a creative web coding agent. The user describes what they want rendered in a browser preview.

Respond ONLY with a single JSON object — no markdown, no explanation, no text before or after:
{"html":"...","css":"...","js":"..."}

Rules:
- html: elements inside <body> only (no html/head/body tags). You may include <script src="..."> tags for CDN libraries.
- css: all CSS styles for the page
- js: JavaScript that runs after DOM loads (do NOT wrap in DOMContentLoaded)
- The viewport is full width and height. Fill the space.
- For 3D graphics, load Three.js via CDN in html: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
- Prefer canvas API, CSS animations, or SVG for 2D
- Keep code self-contained and working
- When the user asks to modify, update ALL three fields with the complete new code`;
