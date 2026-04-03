import { useState, useRef, useCallback } from 'react';
import { Wllama, ModelManager, WllamaChatMessage } from '@wllama/wllama';
import { WLLAMA_CONFIG_PATHS, MODELS, SYSTEM_PROMPT } from './config';
import ModelLoader from './components/ModelLoader';
import ChatPanel from './components/ChatPanel';
import CanvasPreview from './components/CanvasPreview';
import CodeTabs from './components/CodeTabs';

export type CodeState = { html: string; css: string };

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; status: 'loading' | 'done' | 'error'; raw?: string };

const modelManager = new ModelManager();
const wllama = new Wllama(WLLAMA_CONFIG_PATHS, { preferWebGPU: true });

function extractStringValue(text: string, key: string): string {
  const keyIdx = text.indexOf(`"${key}"`);
  if (keyIdx === -1) return '';
  const colonIdx = text.indexOf(':', keyIdx);
  if (colonIdx === -1) return '';
  const afterColon = text.slice(colonIdx + 1).trimStart();
  if (!afterColon.startsWith('"')) return '';
  let result = '';
  let i = 1;
  while (i < afterColon.length) {
    if (afterColon[i] === '\\' && i + 1 < afterColon.length) {
      const next = afterColon[i + 1];
      if (next === 'n') result += '\n';
      else if (next === '"') result += '"';
      else if (next === '\\') result += '\\';
      else if (next === 't') result += '\t';
      else result += next;
      i += 2;
    } else if (afterColon[i] === '"') {
      break;
    } else {
      result += afterColon[i];
      i++;
    }
  }
  return result;
}

function parseCode(raw: string): CodeState | null {
  // Strip markdown fences
  const stripped = raw.replace(/```[a-z]*\n?/g, '').trim();

  const tryJSON = (s: string) => {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === 'object' && ('html' in obj || 'css' in obj)) {
        return { html: String(obj.html ?? ''), css: String(obj.css ?? '') };
      }
    } catch {}
    return null;
  };

  // 1. Direct JSON parse
  const direct = tryJSON(stripped);
  if (direct) return direct;

  // 2. Extract first {...} block and try parsing
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    const fromBlock = tryJSON(match[0]);
    if (fromBlock) return fromBlock;
  }

  // 3. Fallback: extract string values char-by-char (handles unescaped newlines etc.)
  const target = match ? match[0] : stripped;
  const html = extractStringValue(target, 'html');
  const css = extractStringValue(target, 'css');
  if (html || css) return { html, css };

  return null;
}

export default function App() {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [loadedModelLabel, setLoadedModelLabel] = useState('');
  const [runtimeInfo, setRuntimeInfo] = useState<{ webgpu: boolean; multithread: boolean } | null>(null);

  const [code, setCode] = useState<CodeState>({ html: '', css: '' });
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
  const llmMessages = useRef<WllamaChatMessage[]>([
    { role: 'system', content: SYSTEM_PROMPT },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadModel = useCallback(async () => {
    const model = MODELS[selectedModelIdx];
    setIsLoadingModel(true);
    setLoadProgress(0);
    try {
      const cached = await modelManager.getModels();
      let cachedModel = cached.find((m) => m.url === model.url);
      if (!cachedModel) {
        cachedModel = await modelManager.downloadModel(model.url, {
          progressCallback({ loaded, total }) {
            setLoadProgress(loaded / total);
          },
        });
      }
      await wllama.loadModel(cachedModel, { n_ctx: 4096 });
      setLoadedModelLabel(model.label.split('—')[0].trim());
      setRuntimeInfo({ webgpu: wllama.usingWebGPU(), multithread: wllama.isMultithread() });
      setModelLoaded(true);
    } catch (e) {
      alert(`Failed to load model: ${(e as Error).message ?? 'unknown error'}`);
    }
    setIsLoadingModel(false);
  }, [selectedModelIdx]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (isGenerating || !modelLoaded) return;

      setDisplayMessages((prev) => [
        ...prev,
        { role: 'user', content: prompt },
        { role: 'assistant', status: 'loading' },
      ]);
      llmMessages.current.push({ role: 'user', content: prompt });
      setIsGenerating(true);

      try {
        const result = await wllama.createChatCompletion(
          llmMessages.current,
          {
            nPredict: 2048,
            sampling: { temp: 0.1 },
          }
        );

        llmMessages.current.push({ role: 'assistant', content: result });

        const parsed = parseCode(result);
        setDisplayMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            status: parsed ? 'done' : 'error',
            raw: parsed ? undefined : result,
          };
          return next;
        });
        if (parsed) setCode(parsed);
      } catch {
        setDisplayMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', status: 'error' };
          return next;
        });
      }

      setIsGenerating(false);
    },
    [isGenerating, modelLoaded]
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-base-100 text-base-content overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-base-300 shrink-0">
        <span className="font-mono font-bold tracking-tight text-lg">
          🎨 canvas agent
        </span>
        {modelLoaded && runtimeInfo && (
          <div className="flex items-center gap-2">
            <span className="badge badge-success badge-sm">{loadedModelLabel}</span>
            <span className={`badge badge-sm ${runtimeInfo.webgpu ? 'badge-warning' : 'badge-neutral'}`}>
              {runtimeInfo.webgpu ? '⚡ WebGPU' : runtimeInfo.multithread ? '🧵 MT' : '🐢 WASM'}
            </span>
          </div>
        )}
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: preview + code tabs */}
        <div className="flex flex-col w-[60%] border-r border-base-300 overflow-hidden">
          <CanvasPreview code={code} />
          <CodeTabs code={code} />
        </div>

        {/* Right: model loader or chat */}
        <div className="flex flex-col w-[40%] overflow-hidden">
          {!modelLoaded ? (
            <ModelLoader
              models={MODELS}
              selectedIdx={selectedModelIdx}
              onSelectIdx={setSelectedModelIdx}
              onLoad={loadModel}
              isLoading={isLoadingModel}
              progress={loadProgress}
            />
          ) : (
            <ChatPanel
              messages={displayMessages}
              onSend={sendMessage}
              isGenerating={isGenerating}
            />
          )}
        </div>
      </div>
    </div>
  );
}
