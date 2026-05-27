import { invoke } from '@tauri-apps/api/core';
import { accessService } from '@/services/accessService';

export interface InfomaniakCloudConfig {
  configured: boolean;
  mode?: 'protocolito-cloud' | 'owner-local' | string | null;
  baseUrl?: string | null;
  companyId?: string | null;
  transcriptionModels: string[];
  summaryModels: string[];
}

export async function getInfomaniakCloudConfig(): Promise<InfomaniakCloudConfig> {
  let config: Partial<InfomaniakCloudConfig> | null = null;

  try {
    config = await invoke('api_get_infomaniak_cloud_config') as Partial<InfomaniakCloudConfig> | null;
  } catch (error) {
    console.warn('Live Infomaniak cloud config failed; using saved access company models if available.', error);
  }

  if (!config?.configured) {
    const access = await accessService.getConfig().catch(() => null);
    if (access?.company?.summaryModels?.length || access?.company?.transcriptionModels?.length) {
      config = {
        configured: access.lastStatus === 'active',
        mode: 'protocolito-cloud-cached',
        baseUrl: access.baseUrl,
        companyId: access.company.id,
        summaryModels: access.company.summaryModels || [],
        transcriptionModels: access.company.transcriptionModels || [],
      };
    }
  }

  return {
    configured: Boolean(config?.configured),
    mode: config?.mode ?? null,
    baseUrl: config?.baseUrl ?? null,
    companyId: config?.companyId ?? null,
    transcriptionModels: Array.isArray(config?.transcriptionModels) ? config.transcriptionModels : [],
    summaryModels: Array.isArray(config?.summaryModels) ? config.summaryModels : [],
  };
}
