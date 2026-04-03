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
  | { role: 'assistant'; status: 'loading' | 'done' | 'error' };

const modelManager = new ModelManager();
const wllama = new Wllama(WLLAMA_CONFIG_PATHS);

function parseCode(raw: string): CodeState | null {
  const attempt = (s: string) => {
    try {
      const obj = JSON.parse(s);
      if (typeof obj === 'object' && obj !== null) return obj as CodeState;
    } catch {}
    return null;
  };
  // Direct parse
  const direct = attempt(raw.trim());
  if (direct) return direct;
  // Extract first {...} block
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) return attempt(match[0]);
  return null;
}

export default function App() {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [loadedModelLabel, setLoadedModelLabel] = useState('');

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
        {modelLoaded && (
          <span className="badge badge-success badge-sm gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-content inline-block" />
            {loadedModelLabel}
          </span>
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
