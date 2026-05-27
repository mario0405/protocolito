import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { ModelManager } from './WhisperModelManager';
import { ParakeetModelManager } from './ParakeetModelManager';
import { InfomaniakModelSelector } from '@/components/settings/InfomaniakModelSelector';
import { getInfomaniakCloudConfig } from '@/services/infomaniakCloudService';
import type { TranscriptModelProps, TranscriptProvider } from '@/types/transcriptConfig';
import { DEFAULT_PARAKEET_MODEL, DEFAULT_WHISPER_MODEL } from '@/constants/modelDefaults';
import { MODEL_CONFIGS } from '@/lib/whisper';
import { PARAKEET_MODEL_CONFIGS } from '@/lib/parakeet';
import { modelHint } from '@/lib/modelHints';
import { useConfig } from '@/contexts/ConfigContext';

export type { TranscriptModelProps } from '@/types/transcriptConfig';

type TranscriptionSource = 'local' | 'infomaniak';

interface LocalTranscriptionOption {
  provider: Exclude<TranscriptProvider, 'infomaniak'>;
  model: string;
  label: string;
}

export interface TranscriptSettingsProps {
  transcriptModelConfig: TranscriptModelProps;
  setTranscriptModelConfig: (config: TranscriptModelProps) => void;
  onModelSelect?: () => void;
}

const LOCAL_TRANSCRIPTION_MODELS: LocalTranscriptionOption[] = [
  ...Object.keys(MODEL_CONFIGS).map((model) => ({
    provider: 'localWhisper' as const,
    model,
    label: `Whisper ${model}`,
  })),
  ...Object.keys(PARAKEET_MODEL_CONFIGS).map((model) => ({
    provider: 'parakeet' as const,
    model,
    label: `Parakeet ${model}`,
  })),
];

function isLocalProvider(provider: TranscriptProvider) {
  return provider === 'localWhisper' || provider === 'parakeet';
}

function localKey(provider: Exclude<TranscriptProvider, 'infomaniak'>, model: string) {
  return `${provider}:${model}`;
}

function parseLocalKey(value: string): Pick<LocalTranscriptionOption, 'provider' | 'model'> {
  const [provider, ...modelParts] = value.split(':');
  const model = modelParts.join(':');

  return {
    provider: provider === 'parakeet' ? 'parakeet' : 'localWhisper',
    model: model || (provider === 'parakeet' ? DEFAULT_PARAKEET_MODEL : DEFAULT_WHISPER_MODEL),
  };
}

export function TranscriptSettings({ transcriptModelConfig, setTranscriptModelConfig, onModelSelect }: TranscriptSettingsProps) {
  const { t } = useConfig();
  const [source, setSource] = useState<TranscriptionSource>(transcriptModelConfig.provider === 'infomaniak' ? 'infomaniak' : 'local');
  const [infomaniakModelName, setInfomaniakModelName] = useState(transcriptModelConfig.modelName || transcriptModelConfig.model || 'whisper-large-v3');
  const [infomaniakModels, setInfomaniakModels] = useState<string[]>([]);
  const [infomaniakConfigured, setInfomaniakConfigured] = useState(false);

  const selectedLocalKey = useMemo(() => {
    if (isLocalProvider(transcriptModelConfig.provider)) {
      return localKey(transcriptModelConfig.provider, transcriptModelConfig.model);
    }

    return localKey('localWhisper', DEFAULT_WHISPER_MODEL);
  }, [transcriptModelConfig.provider, transcriptModelConfig.model]);

  useEffect(() => {
    setSource(transcriptModelConfig.provider === 'infomaniak' ? 'infomaniak' : 'local');
    if (transcriptModelConfig.provider === 'infomaniak') {
      setInfomaniakModelName(transcriptModelConfig.modelName || transcriptModelConfig.model || 'whisper-large-v3');
    }
  }, [transcriptModelConfig]);

  useEffect(() => {
    const loadInfomaniakCloudConfig = async () => {
      try {
        const cloudConfig = await getInfomaniakCloudConfig();
        setInfomaniakModels(cloudConfig.transcriptionModels);
        setInfomaniakConfigured(cloudConfig.configured);
        if (cloudConfig.transcriptionModels.length > 0) {
          setInfomaniakModelName((current) => (
            current && cloudConfig.transcriptionModels.includes(current) ? current : cloudConfig.transcriptionModels[0]
          ));
        }
      } catch (error) {
        console.error('Failed to load Infomaniak cloud config:', error);
      }
    };

    loadInfomaniakCloudConfig();
  }, []);

  const saveTranscriptConfig = async (nextConfig: TranscriptModelProps, successMessage?: string) => {
    try {
      setTranscriptModelConfig(nextConfig);
      await invoke('api_save_transcript_config', {
        provider: nextConfig.provider,
        model: nextConfig.model,
        productId: nextConfig.productId,
        modelName: nextConfig.modelName,
        apiKey: nextConfig.apiKey,
      });
      if (successMessage) toast.success(successMessage);
      onModelSelect?.();
    } catch (error) {
      console.error('Failed to save transcription settings:', error);
      toast.error(t('transcription.saveFailed'));
    }
  };

  const saveLocalModel = async (provider: Exclude<TranscriptProvider, 'infomaniak'>, model: string) => {
    await saveTranscriptConfig({
      ...transcriptModelConfig,
      provider,
      model,
      productId: null,
      modelName: null,
      apiKey: null,
    }, t('transcription.savedLocal'));
  };

  const handleSourceChange = async (nextSource: TranscriptionSource) => {
    setSource(nextSource);

    if (nextSource === 'local') {
      const selected = isLocalProvider(transcriptModelConfig.provider)
        ? { provider: transcriptModelConfig.provider, model: transcriptModelConfig.model }
        : { provider: 'localWhisper' as const, model: DEFAULT_WHISPER_MODEL };
      await saveLocalModel(selected.provider, selected.model);
      return;
    }

    const current = infomaniakModelName.trim();
    const selectedModel = current && (!infomaniakModels.length || infomaniakModels.includes(current))
      ? current
      : (infomaniakModels[0] || current || 'whisper-large-v3');
    setInfomaniakModelName(selectedModel);
    setTranscriptModelConfig({
      ...transcriptModelConfig,
      provider: 'infomaniak',
      productId: null,
      model: selectedModel,
      modelName: selectedModel,
      apiKey: null,
    });
  };

  const handleSaveInfomaniakTranscriptConfig = async () => {
    const current = infomaniakModelName.trim();
    const selectedModel = current && (!infomaniakModels.length || infomaniakModels.includes(current))
      ? current
      : (infomaniakModels[0] || current || 'whisper-large-v3');
    await saveTranscriptConfig({
      ...transcriptModelConfig,
      provider: 'infomaniak',
      productId: null,
      model: selectedModel,
      modelName: selectedModel,
      apiKey: null,
    }, t('transcription.savedInfomaniak'));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('transcription.title')}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('transcription.description')}
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transcription.source')}</Label>
            <Select value={source} onValueChange={(value) => handleSourceChange(value as TranscriptionSource)}>
              <SelectTrigger>
                <SelectValue placeholder={t('transcription.sourcePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="infomaniak">{t('transcription.infomaniakCloud')}</SelectItem>
                <SelectItem value="local">{t('transcription.localModelSource')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source === 'local' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>{t('transcription.localModel')}</Label>
                <Select
                  value={selectedLocalKey}
                  onValueChange={(value) => {
                    const selected = parseLocalKey(value);
                    saveLocalModel(selected.provider, selected.model);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('transcription.localModelPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCAL_TRANSCRIPTION_MODELS.map((option) => (
                      <SelectItem key={localKey(option.provider, option.model)} value={localKey(option.provider, option.model)}>
                        {option.label} - {modelHint(option.model, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {transcriptModelConfig.provider === 'parakeet' ? (
                <div>
                  <p className="mb-3 text-xs text-amber-700">
                    {t('transcription.parakeetWarning')}
                  </p>
                  <ParakeetModelManager
                    selectedModel={transcriptModelConfig.model}
                    onModelSelect={(model) => saveLocalModel('parakeet', model)}
                    autoSave={true}
                  />
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-xs text-stone-600">
                    {t('transcription.whisperRecommendation')}
                  </p>
                  <ModelManager
                    selectedModel={transcriptModelConfig.model}
                    onModelSelect={(model) => saveLocalModel('localWhisper', model)}
                    autoSave={true}
                  />
                </div>
              )}
            </div>
          )}

          {source === 'infomaniak' && (
            <InfomaniakModelSelector
              description={t('transcription.cloudDescription')}
              label={t('transcription.model')}
              models={infomaniakModels}
              value={infomaniakModelName}
              configured={infomaniakConfigured}
              placeholder={t('transcription.modelPlaceholder')}
              actionLabel={t('transcription.saveInfomaniak')}
              onChange={(model) => {
                setInfomaniakModelName(model);
                setTranscriptModelConfig({
                  ...transcriptModelConfig,
                  provider: 'infomaniak',
                  productId: null,
                  model,
                  modelName: model,
                  apiKey: null,
                });
              }}
              onSave={handleSaveInfomaniakTranscriptConfig}
            />
          )}
        </div>
      </div>
    </div>
  );
}
