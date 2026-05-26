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
          setInfomaniakModel((current) => current || cloudConfig.summaryModels[0]);
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
      toast.error('Failed to save summary model settings');
    }
  }, [onSave, onSaved]);

  const handleSourceChange = (nextSource: SummarySource) => {
    setSource(nextSource);

    if (nextSource === 'local') {
      const localConfig = asLocalSummaryConfig(modelConfig);
      setModelConfig(localConfig);
      return;
    }

    const selectedModel = infomaniakModel || infomaniakModels[0] || '';
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
    const selectedModel = infomaniakModel.trim() || infomaniakModels[0] || '';
    const config: ModelConfig = {
      ...modelConfig,
      provider: 'infomaniak',
      model: selectedModel,
      productId: null,
      apiKey: null,
      ollamaEndpoint: null,
    };

    await saveConfig(config, 'Infomaniak summary model saved');
  };

  const handleSaveLocalSummary = async (config: ModelConfig) => {
    await saveConfig(config, 'Local summary model saved');
  };

  const handleSetLocalModelConfig = (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => {
    setModelConfig((prev) => asLocalSummaryConfig(typeof config === 'function' ? config(asLocalSummaryConfig(prev)) : config));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Summary source</Label>
        {showDescription && (
          <p className="text-sm text-muted-foreground">
            Choose whether protocols are summarized locally on this laptop or through the company Infomaniak cloud setup.
          </p>
        )}
        <Select value={source} onValueChange={(value) => handleSourceChange(value as SummarySource)}>
          <SelectTrigger>
            <SelectValue placeholder="Select summary source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="infomaniak">Infomaniak cloud</SelectItem>
            <SelectItem value="local">Local open-source model</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {source === 'infomaniak' ? (
        <InfomaniakModelSelector
          title="Infomaniak Summary"
          description="Company credentials stay on the Protocolito server. Users only choose the allowed summary model."
          label="Summary model"
          models={infomaniakModels}
          value={infomaniakModel}
          configured={infomaniakConfigured}
          placeholder="Configured Infomaniak summary model"
          actionLabel="Save Infomaniak summary model"
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
