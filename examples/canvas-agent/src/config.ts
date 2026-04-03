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

Respond ONLY with a JSON object, no markdown, no explanation:
{"html":"...","css":"..."}

- html: only elements inside <body>. No html/head/body tags. No scripts. No external libraries.
- css: all styles, including @keyframes animations.
- When modifying, output BOTH fields with the full updated code.
- Pure HTML and CSS only. No JavaScript whatsoever.

Use CSS animations for everything: spinning shapes, color effects, gradients, starfields, particles.

Example — spinning 3D cube:
html: <div class="scene"><div class="cube"><div class="face f"></div><div class="face b"></div><div class="face l"></div><div class="face r"></div><div class="face t"></div><div class="face bt"></div></div></div>
css: body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;} .scene{perspective:400px;} .cube{width:100px;height:100px;position:relative;transform-style:preserve-3d;animation:spin 4s linear infinite;} @keyframes spin{to{transform:rotateX(360deg) rotateY(360deg);}} .face{position:absolute;width:100px;height:100px;border:2px solid #0ff;background:rgba(0,255,255,0.1);} .f{transform:translateZ(50px);} .b{transform:rotateY(180deg) translateZ(50px);} .l{transform:rotateY(-90deg) translateZ(50px);} .r{transform:rotateY(90deg) translateZ(50px);} .t{transform:rotateX(90deg) translateZ(50px);} .bt{transform:rotateX(-90deg) translateZ(50px);}

Example — starfield using box-shadow:
html: <div class="stars"></div>
css: body{margin:0;background:#000;height:100vh;overflow:hidden;} .stars{position:fixed;top:0;left:0;width:2px;height:2px;background:transparent;box-shadow:100px 200px #fff,300px 50px #fff,500px 350px #fff,150px 450px #fff,700px 100px #fff,250px 300px #fff,800px 500px #fff,50px 550px #fff,600px 250px #fff,400px 150px #fff,900px 400px #fff,350px 600px #fff,750px 350px #fff,200px 500px #fff,650px 450px #fff,450px 50px #fff,550px 600px #fff,120px 350px #fff,820px 200px #fff,680px 550px #fff;animation:move 20s linear infinite;} @keyframes move{from{transform:translateY(0)}to{transform:translateY(100vh)}}

ALWAYS produce visible, colorful output.`;
