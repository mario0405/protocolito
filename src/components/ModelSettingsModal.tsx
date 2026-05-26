import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { BuiltInModelManager } from '@/components/BuiltInModelManager';
import { useOllamaDownload } from '@/contexts/OllamaDownloadContext';
import { useSidebar } from './Sidebar/SidebarProvider';
import { useConfig } from '@/contexts/ConfigContext';
import { cn, isOllamaNotInstalledError } from '@/lib/utils';
import type { ModelConfig, OllamaModel } from '@/types/modelConfig';

export type { ModelConfig } from '@/types/modelConfig';

type LocalSummaryProvider = 'builtin-ai' | 'ollama';

interface ModelSettingsModalProps {
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSave: (config: ModelConfig) => void;
  skipInitialFetch?: boolean;
}

function localSummaryConfig(config: ModelConfig): ModelConfig {
  if (config.provider === 'ollama' || config.provider === 'builtin-ai') return config;

  return {
    ...config,
    provider: 'builtin-ai',
    model: 'gemma3:1b',
    apiKey: null,
    ollamaEndpoint: null,
  };
}

function isValidEndpoint(url: string): boolean {
  if (!url.trim()) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ModelSettingsModal({
  modelConfig: propsModelConfig,
  setModelConfig: propsSetModelConfig,
  onSave,
  skipInitialFetch = false,
}: ModelSettingsModalProps) {
  const configContext = useConfig();
  const t = configContext.t;
  const modelConfig = localSummaryConfig(skipInitialFetch ? propsModelConfig : (configContext?.modelConfig || propsModelConfig));
  const setModelConfig = skipInitialFetch ? propsSetModelConfig : (configContext?.setModelConfig || propsSetModelConfig);
  const { serverAddress } = useSidebar();
  const { isDownloading, getProgress } = useOllamaDownload();

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState(modelConfig.ollamaEndpoint || '');
  const [isLoadingOllama, setIsLoadingOllama] = useState(false);
  const [lastFetchedEndpoint, setLastFetchedEndpoint] = useState(modelConfig.ollamaEndpoint || '');
  const [endpointValidationState, setEndpointValidationState] = useState<'valid' | 'invalid' | 'none'>('none');
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEndpointSectionCollapsed, setIsEndpointSectionCollapsed] = useState(true);
  const [ollamaNotInstalled, setOllamaNotInstalled] = useState(false);
  const hasLoadedInitialConfig = useRef(false);
  const modelsCache = useRef<Map<string, OllamaModel[]>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = ollamaEndpoint.trim();
      setEndpointValidationState(!trimmed ? 'none' : isValidEndpoint(trimmed) ? 'valid' : 'invalid');
    }, 300);

    return () => clearTimeout(timer);
  }, [ollamaEndpoint]);

  useEffect(() => {
    const fetchModelConfig = async () => {
      if (skipInitialFetch) {
        hasLoadedInitialConfig.current = true;
        return;
      }

      try {
        const data = localSummaryConfig((await invoke('api_get_model_config')) as ModelConfig);
        setModelConfig(data);
        setOllamaEndpoint(data.ollamaEndpoint || '');
      } catch (error) {
        console.error('Failed to fetch summary model config:', error);
      } finally {
        hasLoadedInitialConfig.current = true;
      }
    };

    fetchModelConfig();
  }, [skipInitialFetch, setModelConfig]);

  useEffect(() => {
    const endpoint = modelConfig.ollamaEndpoint || '';
    if (endpoint !== ollamaEndpoint) setOllamaEndpoint(endpoint);
  }, [modelConfig.ollamaEndpoint]);

  useEffect(() => {
    if (modelConfig.provider !== 'ollama') {
      setHasAutoFetched(false);
      setModels([]);
      setError('');
      setOllamaNotInstalled(false);
    }
  }, [modelConfig.provider]);

  const fetchOllamaModels = async (silent = false) => {
    const trimmedEndpoint = ollamaEndpoint.trim();
    if (!isValidEndpoint(trimmedEndpoint)) {
      const message = 'Invalid Ollama endpoint URL. Use http:// or https://.';
      setError(message);
      if (!silent) toast.error(message);
      return;
    }

    setIsLoadingOllama(true);
    setError('');

    try {
      const endpoint = trimmedEndpoint || null;
      const modelList = (await invoke('get_ollama_models', { endpoint })) as OllamaModel[];
      setModels(modelList);
      setLastFetchedEndpoint(trimmedEndpoint);
      modelsCache.current.set(trimmedEndpoint, modelList);
      setOllamaNotInstalled(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Ollama models';
      setError(message);
      setOllamaNotInstalled(isOllamaNotInstalledError(message));
      if (!silent) toast.error(message);
    } finally {
      setIsLoadingOllama(false);
    }
  };

  useEffect(() => {
    if (modelConfig.provider !== 'ollama') return;
    if (ollamaEndpoint.trim() === lastFetchedEndpoint.trim()) return;

    const cachedModels = modelsCache.current.get(ollamaEndpoint.trim());
    if (cachedModels?.length) {
      setModels(cachedModels);
      setLastFetchedEndpoint(ollamaEndpoint.trim());
      setError('');
    } else {
      setHasAutoFetched(false);
      setModels([]);
      setError('');
    }
  }, [ollamaEndpoint, lastFetchedEndpoint, modelConfig.provider]);

  useEffect(() => {
    if (modelConfig.provider === 'ollama' && !hasAutoFetched) {
      fetchOllamaModels(skipInitialFetch);
      setHasAutoFetched(true);
    }
  }, [modelConfig.provider, hasAutoFetched, skipInitialFetch]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return models;
    return models.filter((model) => model.name.toLowerCase().includes(query));
  }, [models, searchQuery]);

  const ollamaEndpointChanged = modelConfig.provider === 'ollama'
    && ollamaEndpoint.trim() !== lastFetchedEndpoint.trim();

  const isDoneDisabled = modelConfig.provider === 'ollama' && ollamaEndpointChanged;

  const updateProvider = (provider: LocalSummaryProvider) => {
    setModelConfig((prev: ModelConfig) => ({
      ...localSummaryConfig(prev),
      provider,
      model: provider === 'builtin-ai' ? 'gemma3:1b' : models[0]?.name || '',
      apiKey: null,
      ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint.trim() || null : null,
    }));
  };

  const downloadRecommendedModel = async () => {
    try {
      await invoke('pull_ollama_model', { modelName: 'gemma3:1b' });
      await fetchOllamaModels(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download model';
      if (isOllamaNotInstalledError(message)) {
        toast.error('Ollama is not installed', {
          description: 'Install Ollama before downloading local summary models.',
        });
        setOllamaNotInstalled(true);
        return;
      }
      toast.error(message);
    }
  };

  const handleSave = () => {
    onSave({
      ...modelConfig,
      provider: modelConfig.provider,
      model: modelConfig.model,
      apiKey: null,
      ollamaEndpoint: modelConfig.provider === 'ollama' ? ollamaEndpoint.trim() || null : null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t('summary.localEngine')}</Label>
        <p className="text-sm text-muted-foreground">
          {t('summary.localEngineDescription')}
        </p>
        <Select value={modelConfig.provider} onValueChange={(value) => updateProvider(value as LocalSummaryProvider)}>
          <SelectTrigger>
            <SelectValue placeholder={t('summary.selectLocalProvider')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="builtin-ai">{t('summary.builtinLocalModel')}</SelectItem>
            <SelectItem value="ollama">{t('summary.ollamaLocalModels')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {modelConfig.provider === 'builtin-ai' && (
        <BuiltInModelManager
          selectedModel={modelConfig.model}
          onModelSelect={(model) => setModelConfig((prev: ModelConfig) => ({ ...localSummaryConfig(prev), provider: 'builtin-ai', model }))}
        />
      )}

      {modelConfig.provider === 'ollama' && (
        <div className="space-y-5">
          <div>
            <div
              className="flex items-center justify-between cursor-pointer py-2"
              onClick={() => setIsEndpointSectionCollapsed(!isEndpointSectionCollapsed)}
            >
              <Label className="cursor-pointer">{t('summary.ollamaEndpoint')}</Label>
              {isEndpointSectionCollapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {!isEndpointSectionCollapsed && (
              <>
                <p className="text-sm text-muted-foreground mt-1 mb-2">
                  {t('summary.ollamaEndpointDescription')}
                </p>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Input
                      type="url"
                      value={ollamaEndpoint}
                      onChange={(event) => {
                        setOllamaEndpoint(event.target.value);
                        if (event.target.value.trim() !== lastFetchedEndpoint.trim()) {
                          setModels([]);
                          setError('');
                        }
                      }}
                      placeholder="http://localhost:11434"
                      className={cn(endpointValidationState === 'invalid' && 'border-red-500', 'pr-10')}
                    />
                    {endpointValidationState === 'valid' && (
                      <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500" />
                    )}
                    {endpointValidationState === 'invalid' && (
                      <XCircle className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" />
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fetchOllamaModels()}
                    disabled={isLoadingOllama}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    {isLoadingOllama ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {t('summary.fetchingModels')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t('summary.fetchModels')}
                      </>
                    )}
                  </Button>
                </div>
                {ollamaEndpointChanged && !error && (
                  <Alert className="mt-3 border-yellow-500 bg-yellow-50">
                    <AlertDescription className="text-yellow-800">
                      {t('summary.endpointChanged')}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold">{t('summary.availableOllamaModels')}</h4>
              {lastFetchedEndpoint && models.length > 0 && (
                <code className="px-2 py-1 bg-muted rounded text-xs">
                  {lastFetchedEndpoint || serverAddress || 'http://localhost:11434'}
                </code>
              )}
            </div>

            {models.length > 0 && (
              <Input
                placeholder={t('summary.searchModels')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="mb-4 w-full"
              />
            )}

            {isLoadingOllama ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" />
                {t('summary.loadingModels')}
              </div>
            ) : models.length === 0 ? (
              <div className="space-y-3">
                {ollamaNotInstalled ? (
                  <div className="space-y-4">
                    <Alert className="border-orange-500 bg-orange-50">
                      <AlertDescription className="text-orange-800">
                        {t('summary.ollamaNotInstalled')}
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => invoke('open_external_url', { url: 'https://ollama.com/download' })}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t('summary.downloadOllama')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Alert>
                      <AlertDescription>
                        {ollamaEndpointChanged
                          ? 'Endpoint changed. Fetch models from the new endpoint.'
                          : 'No Ollama models found. Download a recommended model or fetch models again.'}
                      </AlertDescription>
                    </Alert>
                    {!ollamaEndpointChanged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadRecommendedModel}
                        disabled={isDownloading('gemma3:1b')}
                        className="w-full"
                      >
                        {isDownloading('gemma3:1b') ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Downloading gemma3:1b...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download gemma3:1b
                          </>
                        )}
                      </Button>
                    )}
                    {isDownloading('gemma3:1b') && getProgress('gemma3:1b') !== undefined && (
                      <div className="bg-white rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-600">Downloading gemma3:1b</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {Math.round(getProgress('gemma3:1b') || 0)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${getProgress('gemma3:1b') || 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : !ollamaEndpointChanged && (
              <ScrollArea className="max-h-[calc(100vh-450px)] overflow-y-auto pr-4">
                {filteredModels.length === 0 ? (
                  <Alert>
                    <AlertDescription>No models found matching "{searchQuery}".</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-3">
                    {filteredModels.map((model) => {
                      const selected = modelConfig.model === model.name;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          className={cn(
                            'rounded-md border bg-white p-3 text-left transition-colors',
                            selected ? 'ring-1 ring-blue-500 border-blue-500' : 'hover:bg-muted/50'
                          )}
                          onClick={() => setModelConfig((prev: ModelConfig) => ({ ...localSummaryConfig(prev), provider: 'ollama', model: model.name }))}
                        >
                          <b className="font-bold">{model.name}</b>
                          <span className="ml-2 text-sm text-muted-foreground">{model.size}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          className={cn('px-4 text-sm font-medium text-white rounded-md', isDoneDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700')}
          onClick={handleSave}
          disabled={isDoneDisabled}
        >
          Save local summary model
        </Button>
      </div>
    </div>
  );
}
