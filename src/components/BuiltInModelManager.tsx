'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion } from 'framer-motion';
import { AlertCircle, Brain, Check, Download, Flame, RefreshCw, Sparkles, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfig } from '@/contexts/ConfigContext';

interface ModelInfo {
  name: string;
  display_name: string;
  status: {
    type: 'not_downloaded' | 'downloading' | 'available' | 'corrupted' | 'error';
    progress?: number;
  };
  size_mb: number;
  context_size: number;
  description: string;
  gguf_file: string;
}

interface DownloadProgressInfo {
  downloadedMb: number;
  totalMb: number;
  speedMbps: number;
}

interface BuiltInModelManagerProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
}

function formatSize(sizeMb: number) {
  return sizeMb >= 1024 ? `${(sizeMb / 1024).toFixed(1)} GB` : `${Math.round(sizeMb)} MB`;
}

function getModelPresentation(modelName: string) {
  if (modelName.includes('3b')) {
    return {
      icon: Brain,
      accent: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      tagline: 'Best quality',
      accuracy: 'Best accuracy',
      speed: 'Slower CPU',
      bestFor: 'Long meetings',
    };
  }

  if (modelName.includes('1.5b')) {
    return {
      icon: Flame,
      accent: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      tagline: 'Balanced',
      accuracy: 'High quality',
      speed: 'Medium CPU',
      bestFor: 'Pilot balanced',
    };
  }

  return {
    icon: Zap,
    accent: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    tagline: 'Fast local',
    accuracy: 'Good quality',
    speed: 'Fast CPU',
    bestFor: 'Pilot default',
  };
}

const SOON_MODELS = [
  {
    name: 'llama-3.2-3b-instruct-q4',
    display_name: 'Llama 3.2 3B',
    size_mb: 1900,
    tagline: 'Reasoning',
    description: 'Strong local reasoning model. Planned after pilot stability testing.',
  },
  {
    name: 'phi-3.5-mini-instruct-q4',
    display_name: 'Phi-3.5 Mini',
    size_mb: 2200,
    tagline: 'Compact',
    description: 'Small Microsoft model option for concise local summaries.',
  },
  {
    name: 'gemma-2-2b-it-q4',
    display_name: 'Gemma 2 2B',
    size_mb: 1600,
    tagline: 'General',
    description: 'Good general-purpose local summary model.',
  },
  {
    name: 'mistral-7b-instruct-q4',
    display_name: 'Mistral 7B',
    size_mb: 4100,
    tagline: 'Heavy',
    description: 'Higher-quality option for stronger laptops. Large download.',
  },
];

export function BuiltInModelManager({ selectedModel, onModelSelect }: BuiltInModelManagerProps) {
  const { t } = useConfig();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadProgressInfo, setDownloadProgressInfo] = useState<Record<string, DownloadProgressInfo>>({});
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());

  const fetchModels = async () => {
    try {
      setIsLoading(true);
      const data = (await invoke('builtin_ai_list_models')) as ModelInfo[];
      setModels(data);

      if (data.length > 0 && !selectedModel) {
        const firstAvailable = data.find((model) => model.status.type === 'available');
        if (firstAvailable) onModelSelect(firstAvailable.name);
      }
    } catch (error) {
      console.error('Failed to fetch built-in AI models:', error);
      toast.error(t('model.failedLoad'));
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen('builtin-ai-download-progress', (event: any) => {
        const { model, progress, downloaded_mb, total_mb, speed_mbps, status } = event.payload;

        setDownloadProgress((prev) => ({ ...prev, [model]: progress }));
        setDownloadProgressInfo((prev) => ({
          ...prev,
          [model]: {
            downloadedMb: downloaded_mb ?? 0,
            totalMb: total_mb ?? 0,
            speedMbps: speed_mbps ?? 0,
          },
        }));

        if (status === 'downloading') {
          setDownloadingModels((prev) => new Set([...prev, model]));
        }

        if (status === 'completed') {
          setDownloadingModels((prev) => {
            const next = new Set(prev);
            next.delete(model);
            return next;
          });
          setDownloadProgress((prev) => {
            const { [model]: _, ...rest } = prev;
            return rest;
          });
          setDownloadProgressInfo((prev) => {
            const { [model]: _, ...rest } = prev;
            return rest;
          });
          onModelSelect(model);
          fetchModels();
          toast.success(t('model.downloadedSuccessfully').replace('{model}', model));
        }

        if (status === 'cancelled' || status === 'error') {
          setDownloadingModels((prev) => {
            const next = new Set(prev);
            next.delete(model);
            return next;
          });
          if (status === 'error') {
            setModels((prevModels) =>
              prevModels.map((item) =>
                item.name === model
                  ? { ...item, status: { type: 'error', progress: 0 } }
                  : item
              )
            );
          } else {
            fetchModels();
          }
        }
      });
    };

    setupListener();
    return () => unlisten?.();
  }, [onModelSelect]);

  const downloadModel = async (modelName: string) => {
    try {
      setDownloadingModels((prev) => new Set([...prev, modelName]));
      toast.info('Setting up local summary model', {
        description: 'Protocolito downloads llama.cpp and the selected GGUF model automatically.',
      });
      await invoke('builtin_ai_download_model', { modelName });
    } catch (error) {
      console.error('Failed to download model:', error);
      toast.error(t('model.downloadFailed').replace('{model}', modelName));
      setDownloadingModels((prev) => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
      fetchModels();
    }
  };

  const cancelDownload = async (modelName: string) => {
    try {
      await invoke('builtin_ai_cancel_download', { modelName });
      toast.info(t('model.downloadCancelled').replace('{model}', modelName));
      setDownloadingModels((prev) => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    } catch (error) {
      console.error('Failed to cancel download:', error);
    }
  };

  const deleteModel = async (modelName: string) => {
    try {
      await invoke('builtin_ai_delete_model', { modelName });
      toast.success(t('model.deleted').replace('{model}', modelName));
      fetchModels();
    } catch (error) {
      console.error('Failed to delete model:', error);
      toast.error(t('model.deleteFailed').replace('{model}', modelName));
    }
  };

  if (isLoading && downloadingModels.size === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-muted-foreground">
        <RefreshCw className="mx-auto mb-2 h-7 w-7 animate-spin" />
        {t('common.loadingModels')}
      </div>
    );
  }

  if (hasFetched && models.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        No local summary models are configured in this build.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {models.map((model, index) => {
          const progress = downloadProgress[model.name];
          const progressInfo = downloadProgressInfo[model.name];
          const modelIsDownloading = downloadingModels.has(model.name);
          const isAvailable = model.status.type === 'available';
          const isNotDownloaded = model.status.type === 'not_downloaded';
          const isError = model.status.type === 'error' || model.status.type === 'corrupted';
          const selected = selectedModel === model.name;
          const presentation = getModelPresentation(model.name);
          const Icon = presentation.icon;
          const phaseLabel = (progress ?? 0) < 10 ? t('model.installingLocalEngine') : t('model.downloading');

          return (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              className={cn(
                'rounded-lg border-2 bg-white p-5 transition-all dark:bg-neutral-950',
                isAvailable ? 'cursor-pointer hover:border-gray-300 dark:hover:border-neutral-600' : 'cursor-default',
                selected && isAvailable ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/20' : 'border-gray-200 dark:border-neutral-800',
                isError && 'border-red-200 bg-red-50 dark:bg-red-950/20'
              )}
              onClick={() => {
                if (isAvailable && !modelIsDownloading) onModelSelect(model.name);
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md p-2', presentation.bg, presentation.accent)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-950 dark:text-neutral-50">{model.display_name || model.name}</h3>
                        <span className="text-sm text-gray-500 dark:text-neutral-500">•</span>
                        <span className="text-sm text-gray-500 dark:text-neutral-400">{presentation.tagline}</span>
                        {selected && isAvailable && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                            <Check className="h-3 w-3" />
                            {t('model.selected')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-11 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-neutral-400">
                    <span>📦 {formatSize(model.size_mb)}</span>
                    <span>🎯 {presentation.accuracy}</span>
                    <span>⚡ {presentation.speed}</span>
                    <span>{presentation.bestFor}</span>
                  </div>

                  <p className="ml-11 mt-2 text-sm text-gray-600 dark:text-neutral-400">{model.description}</p>

                  {isError && (
                    <div className="ml-11 mt-3 flex items-center gap-2 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      {t('model.localSetupFailed')}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isAvailable && !modelIsDownloading && (
                    <>
                      <span className="hidden items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 sm:inline-flex">
                        <span className="h-2 w-2 rounded-full bg-green-600" />
                        {t('model.ready')}
                      </span>
                      {!selected && (
                        <button
                          type="button"
                          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-neutral-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteModel(model.name);
                          }}
                          title={t('model.deleteTitle')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}

                  {isNotDownloaded && !modelIsDownloading && (
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-[116px] bg-blue-600 text-white hover:bg-blue-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadModel(model.name);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {t('model.download')}
                    </Button>
                  )}

                  {modelIsDownloading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-[100px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        cancelDownload(model.name);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  )}

                  {isError && !modelIsDownloading && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-[100px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadModel(model.name);
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('common.retry')}
                    </Button>
                  )}
                </div>
              </div>

              {modelIsDownloading && progress !== undefined && (
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">{phaseLabel}</p>
                      <p className="text-xs text-gray-500">
                        {progressInfo?.totalMb > 0
                          ? `${progressInfo.downloadedMb.toFixed(1)} MB / ${progressInfo.totalMb.toFixed(1)} MB`
                          : `${formatSize(model.size_mb)} model package`}
                        {progressInfo?.speedMbps > 0 ? ` • ${progressInfo.speedMbps.toFixed(1)} MB/s` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-950">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-3 pt-1">
        {SOON_MODELS.map((model, index) => (
          <motion.div
            key={model.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: (models.length + index) * 0.03 }}
            className="rounded-lg border-2 border-gray-200 bg-gray-50/80 p-5 opacity-80 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-gray-100 p-2 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-gray-700 dark:text-neutral-200">{model.display_name}</h3>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500 dark:text-neutral-400">{model.tagline}</span>
                </div>
                <div className="ml-11 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-neutral-500">
                  <span>📦 {formatSize(model.size_mb)}</span>
                <span>{t('model.notDownloaded')}</span>
                </div>
                <p className="ml-11 mt-2 text-sm text-gray-500 dark:text-neutral-500">{model.description}</p>
              </div>

              <Button type="button" size="sm" variant="outline" disabled className="min-w-[96px]">
                {t('common.soon')}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
