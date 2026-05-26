import { invoke } from '@tauri-apps/api/core';

export interface AccessCompany {
  id: string;
  name: string;
  plan: string;
  enabled: boolean;
}

export interface AccessConfig {
  baseUrl: string;
  accessKey: string;
  company: AccessCompany | null;
  lastCheckedAt: string | null;
  lastStatus: string | null;
}

export interface AccessCheckResult {
  ok: boolean;
  status: 'active' | 'missing' | 'denied' | 'error' | string;
  message?: string;
  company?: AccessCompany | null;
}

export class AccessService {
  async getConfig(): Promise<AccessConfig> {
    return invoke<AccessConfig>('api_get_access_config');
  }

  async saveConfig(config: Pick<AccessConfig, 'baseUrl' | 'accessKey'>): Promise<AccessConfig> {
    const result = await invoke<{ status: string; config: AccessConfig }>('api_save_access_config', config);
    return result.config;
  }

  async check(action: string): Promise<AccessCheckResult> {
    return invoke<AccessCheckResult>('api_check_access', { action });
  }

  async ensure(action: string): Promise<void> {
    const result = await this.check(action);
    if (!result.ok) {
      throw new Error(result.message || 'Protocolito access is not active.');
    }
  }
}

export const accessService = new AccessService();
