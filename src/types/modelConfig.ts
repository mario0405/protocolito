export type SummaryProvider =
  | 'ollama'
  | 'builtin-ai'
  | 'infomaniak';

export interface ModelConfig {
  provider: SummaryProvider;
  model: string;
  whisperModel: string;
  apiKey?: string | null;
  ollamaEndpoint?: string | null;
  productId?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
}

export interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}
