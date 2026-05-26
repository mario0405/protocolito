export type TranscriptProvider =
  | 'localWhisper'
  | 'parakeet'
  | 'infomaniak';

export interface TranscriptModelProps {
  provider: TranscriptProvider;
  model: string;
  productId?: string | null;
  modelName?: string | null;
  apiKey?: string | null;
}
