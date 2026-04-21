import wllamaJspiSingle from './jspi-single-thread/wllama.wasm?url';
import wllamaJspiMulti from './jspi-multi-thread/wllama.wasm?url';
import wllamaAsyncifySingle from './asyncify-single-thread/wllama.wasm?url';
import wllamaAsyncifyMulti from './asyncify-multi-thread/wllama.wasm?url';

const WasmFromPackage = {
  'jspi/single-thread/wllama.wasm': wllamaJspiSingle,
  'jspi/multi-thread/wllama.wasm': wllamaJspiMulti,
  'asyncify/single-thread/wllama.wasm': wllamaAsyncifySingle,
  'asyncify/multi-thread/wllama.wasm': wllamaAsyncifyMulti,
};

export default WasmFromPackage;
