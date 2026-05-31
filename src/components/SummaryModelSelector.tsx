'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { BuiltInModelManager } from '@/components/BuiltInModelManager';
import { InfomaniakModelSelector } from '@/components/settings/InfomaniakModelSelector';
import { getInfomaniakCloudConfig } from '@/services/infomaniakCloudService';
import { useConfig } from '@/contexts/ConfigContext';
import { cn } from '@/lib/utils';

type SummarySource = 'local' | 'infomaniak';

const LOCAL_SUMMARY_MODELS = [
  {
    value: 'qwen2.5-0.5b-instruct-q4',
    label: 'Qwen 2.5 0.5B - Schnell',
  },
  {
    value: 'qwen2.5-1.5b-instruct-q4',
    label: 'Qwen 2.5 1.5B - Balanced',
  },
  {
    value: 'qwen2.5-3b-instruct-q4',
    label: 'Qwen 2.5 3B - Beste Qualität',
  },
];

const SOON_SUMMARY_MODELS = [
  'Llama 3.2 3B - Soon',
  'Phi-3.5 Mini - Soon',
  'Gemma 2 2B - Soon',
  'Mistral 7B - Soon',
];

interface SummaryModelSelectorProps {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSave: (config: ModelConfig) => void | Promise<void>;
  onSaved?: () => void;
  showDescription?: boolean;
}

function isLocalSummaryProvider(provider: ModelConfig['provider']) {
  return provider === 'builtin-ai';
}

function asLocalSummaryConfig(config: ModelConfig): ModelConfig {
  if (isLocalSummaryProvider(config.provider)) {
    return {
      ...config,
      provider: 'builtin-ai',
      model: config.model || LOCAL_SUMMARY_MODELS[0].value,
      apiKey: null,
      ollamaEndpoint: null,
    };
  }

  return {
    ...config,
    provider: 'builtin-ai',
    model: LOCAL_SUMMARY_MODELS[0].value,
    apiKey: null,
    ollamaEndpoint: null,
  };
}

export function SummaryModelSelector({
  modelConfig,
  setModelConfig,
  onSave,
  onSaved,
  showDescription = true,
}: SummaryModelSelectorProps) {
  const { t } = useConfig();
  const [source, setSource] = useState<SummarySource>(modelConfig.provider === 'infomaniak' ? 'infomaniak' : 'local');
  const [infomaniakModel, setInfomaniakModel] = useState(modelConfig.provider === 'infomaniak' ? modelConfig.model : '');
  const [infomaniakModels, setInfomaniakModels] = useState<string[]>([]);
  const [infomaniakConfigured, setInfomaniakConfigured] = useState(false);

  useEffect(() => {
    setSource(modelConfig.provider === 'infomaniak' ? 'infomaniak' : 'local');
    if (modelConfig.provider === 'infomaniak') {
      setInfomaniakModel(modelConfig.model || '');
    }
  }, [modelConfig.provider, modelConfig.model]);

  useEffect(() => {
    const loadInfomaniakCloudConfig = async () => {
      try {
        const cloudConfig = await getInfomaniakCloudConfig();
        setInfomaniakModels(cloudConfig.summaryModels);
        setInfomaniakConfigured(cloudConfig.configured);
        if (cloudConfig.summaryModels.length > 0) {
          setInfomaniakModel((current) => (
            current && cloudConfig.summaryModels.includes(current) ? current : cloudConfig.summaryModels[0]
          ));
        }
      } catch (error) {
        console.error('Failed to load Infomaniak cloud config:', error);
      }
    };

    loadInfomaniakCloudConfig();
  }, []);

  const localModelConfig = useMemo(() => asLocalSummaryConfig(modelConfig), [modelConfig]);

  const saveConfig = useCallback(async (config: ModelConfig, successMessage: string) => {
    try {
      await onSave(config);
      onSaved?.();
      toast.success(successMessage);
    } catch (error) {
      console.error('Failed to save summary model settings:', error);
      toast.error(t('summary.saveFailed'));
    }
  }, [onSave, onSaved]);

  const handleSourceChange = async (nextSource: SummarySource) => {
    setSource(nextSource);

    if (nextSource === 'local') {
      const localConfig = asLocalSummaryConfig(modelConfig);
      setModelConfig(localConfig);
      await saveConfig(localConfig, t('summary.savedLocal'));
      return;
    }

    const selectedModel = infomaniakModels.includes(infomaniakModel) ? infomaniakModel : (infomaniakModels[0] || infomaniakModel || '');
    const cloudConfig: ModelConfig = {
      ...modelConfig,
      provider: 'infomaniak',
      model: selectedModel,
      productId: null,
      apiKey: null,
      ollamaEndpoint: null,
    };
    setInfomaniakModel(selectedModel);
    setModelConfig(cloudConfig);
  };

  const handleSaveInfomaniakSummary = async () => {
    const current = infomaniakModel.trim();
    const selectedModel = current && (!infomaniakModels.length || infomaniakModels.includes(current))
      ? current
      : (infomaniakModels[0] || current);
    const config: ModelConfig = {
      ...modelConfig,
      provider: 'infomaniak',
      model: selectedModel,
      productId: null,
      apiKey: null,
      ollamaEndpoint: null,
    };

    await saveConfig(config, t('summary.savedInfomaniak'));
  };

  const handleSaveLocalSummary = async (config: ModelConfig) => {
    await saveConfig(config, t('summary.savedLocal'));
  };

  const handleLocalModelSelect = async (model: string) => {
    const nextConfig = asLocalSummaryConfig({
      ...modelConfig,
      provider: 'builtin-ai',
      model,
      apiKey: null,
      ollamaEndpoint: null,
    });
    setModelConfig(nextConfig);
    await handleSaveLocalSummary(nextConfig);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t('summary.source')}</Label>
        {showDescription && (
          <p className="text-sm text-muted-foreground">
            {t('summary.sourceDescription')}
          </p>
        )}
        <Select value={source} onValueChange={(value) => handleSourceChange(value as SummarySource)}>
          <SelectTrigger>
            <SelectValue placeholder={t('summary.sourcePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="infomaniak">{t('summary.infomaniakCloud')}</SelectItem>
            <SelectItem value="local">{t('summary.localModelSource')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {source === 'infomaniak' ? (
        <InfomaniakModelSelector
          title={t('summary.infomaniakTitle')}
          description={t('summary.cloudDescription')}
          label={t('summary.model')}
          models={infomaniakModels}
          value={infomaniakModel}
          configured={infomaniakConfigured}
          placeholder={t('summary.modelPlaceholder')}
          actionLabel={t('summary.saveInfomaniak')}
          onChange={(model) => {
            setInfomaniakModel(model);
            setModelConfig({
              ...modelConfig,
              provider: 'infomaniak',
              model,
              productId: null,
              apiKey: null,
              ollamaEndpoint: null,
            });
          }}
          onSave={handleSaveInfomaniakSummary}
        />
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t('summary.localModel')}</Label>
            <Select
              value={localModelConfig.model || LOCAL_SUMMARY_MODELS[0].value}
              onValueChange={handleLocalModelSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('summary.localModelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {LOCAL_SUMMARY_MODELS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                {SOON_SUMMARY_MODELS.map((label) => (
                  <SelectItem key={label} value={label} disabled>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-300">
            {t('summary.localRecommendation')}
          </p>

          <div className={cn('space-y-3')}>
            <BuiltInModelManager
              selectedModel={localModelConfig.model || LOCAL_SUMMARY_MODELS[0].value}
              onModelSelect={handleLocalModelSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
