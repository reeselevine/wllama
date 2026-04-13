// See: https://vitejs.dev/guide/assets#explicit-url-imports
import wllamaJspiSingle from '@wllama/wllama/src/jspi-single-thread/wllama.wasm?url';
import wllamaJspiMulti from '@wllama/wllama/src/jspi-multi-thread/wllama.wasm?url';
import wllamaAsyncifySingle from '@wllama/wllama/src/asyncify-single-thread/wllama.wasm?url';
import wllamaAsyncifyMulti from '@wllama/wllama/src/asyncify-multi-thread/wllama.wasm?url';
import wllamaPackageJson from '@wllama/wllama/package.json';
import { InferenceParams } from './utils/types';

export const WLLAMA_VERSION = wllamaPackageJson.version;

export const WLLAMA_CONFIG_PATHS = {
  'jspi/single-thread/wllama.wasm': wllamaJspiSingle,
  'jspi/multi-thread/wllama.wasm': wllamaJspiMulti,
  'asyncify/single-thread/wllama.wasm': wllamaAsyncifySingle,
  'asyncify/multi-thread/wllama.wasm': wllamaAsyncifyMulti,
};

export const MAX_GGUF_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export const LIST_MODELS = [
  {
    url: 'https://huggingface.co/QuantFactory/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct.Q4_0.gguf',
    size: 240123904,
  },
  {
    url: 'https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/main/gemma-3-270m-it-Q4_0.gguf',
    size: 241574944,
  },
  {
    url: 'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q4_0.gguf',
    size: 269484032,
  },
  {
    url: 'https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/main/gemma-3-270m-it-F16.gguf',
    size: 542835488,
  },
  {
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf',
    size: 639447744,
  },
  {
    url: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/main/LFM2.5-1.2B-Instruct-Q4_0.gguf',
    size: 695751488,
  },
  {
    url: 'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_0.gguf',
    size: 721918496,
  },
  {
    url: 'https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_0.gguf',
    size: 773025824,
  },
  {
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_0.gguf',
    size: 1214873856,
  },
  {
    url: 'https://huggingface.co/unsloth/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q2_K.gguf',
    size: 1682635744,
  },
  {
    url: 'https://huggingface.co/unsloth/Ministral-3-3B-Instruct-2512-GGUF/resolve/main/Ministral-3-3B-Instruct-2512-Q3_K_M.gguf',
    size: 1795552544,
  },
  {
    url: 'https://huggingface.co/unsloth/SmolLM3-3B-128K-GGUF/resolve/main/SmolLM3-3B-128K-Q4_0.gguf',
    size: 1811456608,
  },
  {
    url: 'https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_0.gguf',
    size: 1921909184,
  },
  {
    url: 'https://huggingface.co/reeselevine/wllama-split-models/resolve/main/gemma-4-E2B-it-Q4_0-00001-of-00005.gguf',
    size: 3041372064,
  },
];

export const DEFAULT_INFERENCE_PARAMS: InferenceParams = {
  nThreads: -1, // auto
  nContext: 4096,
  nPredict: 4096,
  nBatch: 128,
  temperature: 0.2,
  preferWebGPU: true,
};

export const DEFAULT_CHAT_TEMPLATE =
  "{% for message in messages %}{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}";
