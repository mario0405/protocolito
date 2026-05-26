import { invoke } from '@tauri-apps/api/core';

export interface InfomaniakCloudConfig {
  configured: boolean;
  mode?: 'protocolito-cloud' | 'owner-local' | string | null;
  baseUrl?: string | null;
  companyId?: string | null;
  transcriptionModels: string[];
  summaryModels: string[];
}

export async function getInfomaniakCloudConfig(): Promise<InfomaniakCloudConfig> {
  const config = await invoke('api_get_infomaniak_cloud_config') as Partial<InfomaniakCloudConfig> | null;

  return {
    configured: Boolean(config?.configured),
    mode: config?.mode ?? null,
    baseUrl: config?.baseUrl ?? null,
    companyId: config?.companyId ?? null,
    transcriptionModels: Array.isArray(config?.transcriptionModels) ? config.transcriptionModels : [],
    summaryModels: Array.isArray(config?.summaryModels) ? config.summaryModels : [],
  };
}
