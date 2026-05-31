'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { Switch } from './ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { SummaryModelSelector } from '@/components/SummaryModelSelector';

interface SummaryModelSettingsProps {
  refetchTrigger?: number;
}

export function SummaryModelSettings({ refetchTrigger }: SummaryModelSettingsProps) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'builtin-ai',
    model: 'qwen2.5-0.5b-instruct-q4',
    whisperModel: 'large-v3-turbo',
    apiKey: null,
    ollamaEndpoint: null,
  });

  const { isAutoSummary, toggleIsAutoSummary, t } = useConfig();

  const fetchModelConfig = useCallback(async () => {
    try {
      const data = await invoke('api_get_model_config') as ModelConfig;
      if (data && data.provider) {
        setModelConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch model config:', error);
      toast.error(t('summary.loadFailed'));
    }
  }, []);

  useEffect(() => {
    fetchModelConfig();
  }, [fetchModelConfig]);

  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      fetchModelConfig();
    }
  }, [refetchTrigger, fetchModelConfig]);

  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return listen<ModelConfig>('model-config-updated', (event) => {
        setModelConfig(event.payload);
      });
    };

    let cleanup: (() => void) | undefined;
    setupListener().then((fn) => cleanup = fn);

    return () => {
      cleanup?.();
    };
  }, []);

  const handleSaveModelConfig = async (config: ModelConfig) => {
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey,
        ollamaEndpoint: config.ollamaEndpoint,
        productId: config.productId,
      });

      setModelConfig(config);

      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error(t('summary.saveFailed'));
      throw error;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('summary.autoTitle')}</h3>
            <p className="text-sm text-gray-600">{t('summary.autoDescription')}</p>
          </div>
          <Switch checked={isAutoSummary} onCheckedChange={toggleIsAutoSummary} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{t('summary.modelConfiguration')}</h3>
        <SummaryModelSelector
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSave={handleSaveModelConfig}
        />
      </div>
    </div>
  );
}
