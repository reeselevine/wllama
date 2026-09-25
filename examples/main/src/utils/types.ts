export enum Screen {
  GUIDE,
  CHAT,
  MODEL,
  LOG,
}

export enum ModelState {
  NOT_DOWNLOADED,
  DOWNLOADING,
  READY,
  LOADING,
  LOADED,
}

export interface RuntimeInfo {
  isMultithread: boolean;
  usingWebGPU: boolean;
  hasChatTemplate: boolean;
}

export type KvCacheQuantizationType =
  | 'f32'
  | 'f16'
  | 'q8_0'
  | 'q5_1'
  | 'q5_0'
  | 'q4_1'
  | 'q4_0';

export interface InferenceParams {
  nThreads: number;
  nContext: number;
  nBatch: number;
  temperature: number;
  nPredict: number;
  backend: 'cpu' | 'webgpu';
  cacheTypeK?: KvCacheQuantizationType;
  cacheTypeV?: KvCacheQuantizationType;
  flashAttn?: boolean;
}

export interface Message {
  id: number;
  content: string;
  role: 'system' | 'user' | 'assistant';
}

export interface Conversation {
  id: number;
  messages: Message[];
}
