import { createContext, useContext, useMemo, useState } from 'react';
import {
  DebugLogger,
  getWebGPUMemoryBudget,
  getDefaultScreen,
  useDidMount,
  WllamaStorage,
} from './utils';
import {
  Model,
  ModelManager,
  Wllama,
  type ResultTimings,
} from '@wllama/wllama/esm/index.js';
import { DEFAULT_INFERENCE_PARAMS, WLLAMA_CONFIG_PATHS } from '../config';
import {
  InferenceParams,
  RuntimeInfo,
  ModelState,
  Screen,
  Message,
} from './types';
import { verifyCustomModel } from './custom-models';
import {
  DisplayedModel,
  getDisplayedModels,
  getUserAddedModels,
  updateUserAddedModels,
} from './displayed-model';

function isQuantizedKvCacheType(type?: InferenceParams['cacheTypeV']) {
  return !!type && !type.startsWith('f');
}

function normalizeCacheType(value: unknown): InferenceParams['cacheTypeK'] {
  return ['f32', 'f16', 'q8_0', 'q5_1', 'q5_0', 'q4_1', 'q4_0'].includes(
    String(value)
  )
    ? (value as InferenceParams['cacheTypeK'])
    : undefined;
}

interface WllamaContextValue {
  // functions for managing models
  models: DisplayedModel[];
  downloadModel(model: DisplayedModel): Promise<void>;
  removeCachedModel(model: DisplayedModel): Promise<void>;
  removeAllCachedModels(): Promise<void>;
  isDownloading: boolean;
  isLoadingModel: boolean;
  currParams: InferenceParams;
  setParams(params: InferenceParams): void;

  // function to load/unload model
  loadedModel?: DisplayedModel;
  currRuntimeInfo?: RuntimeInfo;
  loadModel(model: DisplayedModel): Promise<void>;
  unloadModel(): Promise<void>;

  // function for managing custom user model
  addCustomModel(url: string): Promise<void>;
  removeCustomModel(model: DisplayedModel): Promise<void>;

  // functions for chat completion
  getWllamaInstance(): Wllama;
  createCompletion(
    input: Message[],
    callback: (piece: string) => void
  ): Promise<void>;
  stopCompletion(): void;
  timings?: ResultTimings;
  resetTimings(): void;
  isGenerating: boolean;
  currentConvId: number;

  // nagivation
  navigateTo(screen: Screen, conversationId?: number): void;
  currScreen: Screen;
}

const WllamaContext = createContext<WllamaContextValue>({} as any);

const modelManager = new ModelManager();
const newWllamaInstance = () => {
  const instance = new Wllama(WLLAMA_CONFIG_PATHS, {
    logger: DebugLogger,
    modelManager,
  });
  instance.setCompat('default', 'firefox_safari');
  return instance;
};
const getInitialParams = (): InferenceParams => {
  const stored = WllamaStorage.load('params', DEFAULT_INFERENCE_PARAMS);
  return {
    ...DEFAULT_INFERENCE_PARAMS,
    ...stored,
    // nBatch is not user-configurable in the example UI, so keep it aligned
    // with the current app default instead of reviving stale persisted values.
    nBatch: DEFAULT_INFERENCE_PARAMS.nBatch,
    cacheTypeK: normalizeCacheType(stored.cacheTypeK),
    cacheTypeV: normalizeCacheType(stored.cacheTypeV),
  };
};
let wllamaInstance = newWllamaInstance();
let completionController: AbortController | undefined;
const resetWllamaInstance = () => {
  wllamaInstance = newWllamaInstance();
};

export const WllamaProvider = ({ children }: any) => {
  const [timings, setTimings] = useState<ResultTimings>();
  const [isGenerating, setGenerating] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(-1);
  const [currScreen, setScreen] = useState<Screen>(getDefaultScreen());
  const [cachedModels, setCachedModels] = useState<Model[]>([]);
  const [isBusy, setBusy] = useState(false);
  const [currRuntimeInfo, setCurrRuntimeInfo] = useState<RuntimeInfo>();
  const [currParams, setCurrParams] =
    useState<InferenceParams>(getInitialParams);
  const [downloadingProgress, setDownloadingProgress] = useState<
    Record<DisplayedModel['url'], number>
  >({});
  const [loadedModel, setLoadedModel] = useState<DisplayedModel>();

  const refreshCachedModels = async () => {
    setCachedModels(await modelManager.getModels());
  };
  useDidMount(refreshCachedModels);

  // computed variables
  const models = useMemo(() => {
    const list = getDisplayedModels(cachedModels);
    for (const model of list) {
      model.downloadPercent = downloadingProgress[model.url] ?? -1;
      if (model.downloadPercent >= 0) {
        model.state = ModelState.DOWNLOADING;
      }
      if (loadedModel?.url === model.url) {
        model.state = loadedModel.state;
      }
    }
    return list;
  }, [cachedModels, downloadingProgress, loadedModel]);
  const isDownloading = useMemo(
    () => models.some((m) => m.state === ModelState.DOWNLOADING),
    [models]
  );
  const isLoadingModel = useMemo(
    () => isBusy || loadedModel?.state === ModelState.LOADING,
    [loadedModel, isBusy]
  );

  // utils
  const updateModelDownloadState = (
    url: string,
    downloadPercent: number = -1
  ) => {
    if (downloadPercent < 0) {
      setDownloadingProgress((p) => {
        const newProgress = { ...p };
        delete newProgress[url];
        return newProgress;
      });
    } else {
      setDownloadingProgress((p) => ({ ...p, [url]: downloadPercent }));
    }
  };

  const downloadModel = async (model: DisplayedModel) => {
    if (isDownloading || loadedModel || isLoadingModel) return;
    updateModelDownloadState(model.url, 0);
    try {
      await modelManager.downloadModel(model.url, {
        progressCallback(opts) {
          updateModelDownloadState(model.url, opts.loaded / opts.total);
        },
      });
      updateModelDownloadState(model.url, -1);
      await refreshCachedModels();
    } catch (e) {
      alert((e as any)?.message || 'unknown error while downloading model');
    }
  };

  const removeCachedModel = async (model: DisplayedModel) => {
    if (isDownloading || loadedModel || isLoadingModel) return;
    if (model.cachedModel) {
      await model.cachedModel.remove();
      await refreshCachedModels();
    }
  };

  const removeAllCachedModels = async () => {
    if (isDownloading || loadedModel || isLoadingModel) return;
    await modelManager.clear();
    await refreshCachedModels();
  };

  const loadModel = async (model: DisplayedModel) => {
    if (isDownloading || loadedModel || isLoadingModel) return;
    // make sure the model is cached
    if (!model.cachedModel) {
      throw new Error('Model is not in cache');
    }
    if (
      isQuantizedKvCacheType(currParams.cacheTypeV) &&
      currParams.flashAttn === false
    ) {
      throw new Error(
        'Quantized V cache requires Flash Attention. Set Flash Attention to Auto before loading the model.'
      );
    }
    setTimings(undefined);
    setLoadedModel(model.clone({ state: ModelState.LOADING }));
    try {
      if (currParams.backend === 'webgpu' && !(await getWebGPUMemoryBudget())) {
        throw new Error(
          'WebGPU backend requested, but WebGPU is not supported'
        );
      }
      await wllamaInstance.loadModel(model.cachedModel, {
        n_threads: currParams.nThreads > 0 ? currParams.nThreads : undefined,
        n_ctx: currParams.nContext,
        n_gpu_layers: currParams.backend === 'cpu' ? 0 : 99999,
        n_parallel: 1,
        n_batch: currParams.nBatch,
        cache_type_k: currParams.cacheTypeK,
        cache_type_v: currParams.cacheTypeV,
        flash_attn: currParams.flashAttn,
      });
      setLoadedModel(model.clone({ state: ModelState.LOADED }));
      setCurrRuntimeInfo({
        isMultithread: wllamaInstance.isMultithread(),
        usingWebGPU:
          currParams.backend === 'webgpu' && wllamaInstance.isSupportWebGPU(),
        hasChatTemplate: !!wllamaInstance.getChatTemplate(),
      });
    } catch (e) {
      await wllamaInstance.exit().catch(DebugLogger.error);
      resetWllamaInstance();
      alert(`Failed to load model: ${(e as any).message ?? 'Unknown error'}`);
      setLoadedModel(undefined);
    }
  };

  const unloadModel = async () => {
    if (!loadedModel) return;
    await wllamaInstance.exit();
    resetWllamaInstance();
    setLoadedModel(undefined);
    setCurrRuntimeInfo(undefined);
    setTimings(undefined);
  };

  const createCompletion = async (
    input: Message[],
    callback: (currentText: string) => void
  ) => {
    if (isGenerating || isDownloading || !loadedModel || isLoadingModel) return;
    setGenerating(true);
    setTimings(undefined);
    completionController = new AbortController();
    let text = '';
    try {
      await wllamaInstance.createChatCompletion({
        messages: input.map(({ role, content }) => ({ role, content })),
        max_tokens: currParams.nPredict,
        temperature: currParams.temperature,
        stream: true,
        abortSignal: completionController.signal,
        onData(chunk) {
          const delta = chunk.choices[0]?.delta;
          text += delta?.content ?? '';
          callback(text);
          if (chunk.timings) setTimings(chunk.timings);
        },
      });
    } catch (error) {
      if (!completionController.signal.aborted) throw error;
    } finally {
      completionController = undefined;
      setGenerating(false);
    }
  };

  const stopCompletion = () => completionController?.abort();

  const navigateTo = (screen: Screen, conversationId?: number) => {
    setScreen(screen);
    setCurrentConvId(conversationId ?? -1);
    if (screen === Screen.MODEL) {
      WllamaStorage.save('welcome', false);
    }
  };

  // proxy function for saving to localStorage
  const setParams = (val: InferenceParams) => {
    const next = { ...DEFAULT_INFERENCE_PARAMS, ...val };
    const backendChanged = currParams.backend !== next.backend;
    if (backendChanged && !loadedModel) {
      resetWllamaInstance();
    }
    WllamaStorage.save('params', next);
    setCurrParams(next);
  };

  // function for managing custom user model
  const addCustomModel = async (url: string) => {
    setBusy(true);
    try {
      const custom = await verifyCustomModel(url, currParams.backend);
      if (models.some((m) => m.url === custom.url)) {
        throw new Error('Model with the same URL already exist');
      }
      const userAddedModels = getUserAddedModels(cachedModels);
      updateUserAddedModels([
        ...userAddedModels,
        new DisplayedModel(custom.url, custom.size, true, undefined),
      ]);
      await refreshCachedModels();
    } catch (e) {
      setBusy(false);
      throw e; // re-throw
    }
    setBusy(false);
  };

  const removeCustomModel = async (model: DisplayedModel) => {
    setBusy(true);
    if (model.isUserAdded) {
      const userAddedModels = getUserAddedModels(cachedModels);
      const newList = userAddedModels.filter((m) => m.url !== model.url);
      updateUserAddedModels(newList);
      await refreshCachedModels();
    } else {
      throw new Error('Cannot remove non-user-added model');
    }
    setBusy(false);
  };

  return (
    <WllamaContext.Provider
      value={{
        models,
        isDownloading,
        isLoadingModel,
        downloadModel,
        removeCachedModel,
        removeAllCachedModels,
        loadedModel,
        loadModel,
        unloadModel,
        currParams,
        setParams,
        createCompletion,
        stopCompletion,
        timings,
        resetTimings: () => setTimings(undefined),
        isGenerating,
        currentConvId,
        navigateTo,
        currScreen,
        getWllamaInstance: () => wllamaInstance,
        addCustomModel,
        removeCustomModel,
        currRuntimeInfo,
      }}
    >
      {children}
    </WllamaContext.Provider>
  );
};

export const useWllama = () => useContext(WllamaContext);
