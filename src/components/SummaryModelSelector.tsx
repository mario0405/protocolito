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
import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';
import { InfomaniakModelSelector } from '@/components/settings/InfomaniakModelSelector';
import { getInfomaniakCloudConfig } from '@/services/infomaniakCloudService';
import { useConfig } from '@/contexts/ConfigContext';

type SummarySource = 'local' | 'infomaniak';

interface SummaryModelSelectorProps {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSave: (config: ModelConfig) => void | Promise<void>;
  onSaved?: () => void;
  showDescription?: boolean;
}

function isLocalSummaryProvider(provider: ModelConfig['provider']) {
  return provider === 'ollama' || provider === 'builtin-ai';
}

function asLocalSummaryConfig(config: ModelConfig): ModelConfig {
  if (isLocalSummaryProvider(config.provider)) return config;

  return {
    ...config,
    provider: 'builtin-ai',
    model: 'gemma3:1b',
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

  const handleSourceChange = (nextSource: SummarySource) => {
    setSource(nextSource);

    if (nextSource === 'local') {
      const localConfig = asLocalSummaryConfig(modelConfig);
      setModelConfig(localConfig);
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

  const handleSetLocalModelConfig = (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => {
    setModelConfig((prev) => asLocalSummaryConfig(typeof config === 'function' ? config(asLocalSummaryConfig(prev)) : config));
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
        <ModelSettingsModal
          modelConfig={localModelConfig}
          setModelConfig={handleSetLocalModelConfig}
          onSave={handleSaveLocalSummary}
          skipInitialFetch={true}
        />
      )}
    </div>
  );
}
