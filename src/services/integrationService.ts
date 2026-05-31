import { Summary } from '@/types';
import { invoke } from '@tauri-apps/api/core';

export type IntegrationProvider =
  | 'notion'
  | 'asana'
  | 'google-calendar'
  | 'google-docs'
  | 'slack'
  | 'teams'
  | 'trello'
  | 'jira'
  | 'monday'
  | 'hubspot'
  | 'salesforce';

export interface IntegrationConfig {
  provider: IntegrationProvider;
  enabled: boolean;
  token?: string;
  target?: string;
  webhookUrl?: string;
  connectedAccountId?: string;
  autoSendSummary: boolean;
}

export interface IntegrationPayload {
  meetingId: string;
  title: string;
  createdAt: string;
  summaryMarkdown: string;
  source: 'Protocolito';
}

export interface IntegrationCatalogProvider {
  provider: IntegrationProvider;
  label: string;
  toolkit: string;
  connectable: boolean;
  sendable: boolean;
}

export interface IntegrationCatalog {
  configured: boolean;
  providers: IntegrationCatalogProvider[];
}

export interface IntegrationConnectResult {
  status: 'started';
  provider: IntegrationProvider;
  connectedAccountId: string | null;
  redirectUrl: string | null;
}

const STORAGE_KEY = 'protocolito.integrations.v1';
const ACTIVE_SEND_PROVIDERS = new Set<IntegrationProvider>([
  'asana',
  'google-docs',
  'slack',
  'teams',
]);

export const INTEGRATION_DEFAULTS: IntegrationConfig[] = [
  { provider: 'google-calendar', enabled: false, target: '', autoSendSummary: false },
  { provider: 'notion', enabled: false, target: '', connectedAccountId: '', autoSendSummary: false },
  { provider: 'asana', enabled: false, target: '', connectedAccountId: '', autoSendSummary: false },
  { provider: 'google-docs', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'slack', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'teams', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'trello', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'jira', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'monday', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'hubspot', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'salesforce', enabled: false, token: '', target: '', autoSendSummary: false },
];

export const INTEGRATION_LABELS: Record<IntegrationProvider, string> = {
  'google-calendar': 'Google Calendar',
  notion: 'Notion',
  asana: 'Asana',
  'google-docs': 'Google Docs',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  trello: 'Trello',
  jira: 'Jira',
  monday: 'Monday.com',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
};

export function loadIntegrations(): IntegrationConfig[] {
  if (typeof window === 'undefined') return INTEGRATION_DEFAULTS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) as IntegrationConfig[] : [];
    return INTEGRATION_DEFAULTS.map((base) => {
      const savedItem = saved.find((item) => item.provider === base.provider);
      return {
        ...base,
        ...(savedItem || {}),
        connectedAccountId: savedItem?.connectedAccountId || (savedItem as any)?.composioConnectedAccountId || base.connectedAccountId || '',
        enabled: base.provider === 'google-calendar' || ACTIVE_SEND_PROVIDERS.has(base.provider)
          ? Boolean((savedItem || base).enabled)
          : false,
      };
    });
  } catch {
    return INTEGRATION_DEFAULTS;
  }
}

export function saveIntegrations(configs: IntegrationConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getIntegrationCatalog() {
  return invoke<IntegrationCatalog>('api_integrations_get_catalog');
}

export function connectIntegration(config: IntegrationConfig) {
  return invoke<IntegrationConnectResult>('api_integrations_connect', {
    provider: config.provider,
  });
}

export function summaryToMarkdown(summary: Summary | null): string {
  if (!summary) return '';

  if ('markdown' in summary && typeof (summary as any).markdown === 'string') {
    return (summary as any).markdown;
  }

  return Object.entries(summary)
    .filter(([key]) => !['markdown', 'summary_json', '_section_order', 'MeetingName'].includes(key))
    .map(([, section]) => {
      if (!section || typeof section !== 'object' || !('title' in section) || !('blocks' in section)) {
        return '';
      }

      const title = `## ${(section as any).title}`;
      const blocks = ((section as any).blocks || [])
        .map((block: any) => `- ${block.content}`)
        .join('\n');

      return `${title}\n\n${blocks}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function buildIntegrationPayload(args: {
  meetingId: string;
  title: string;
  createdAt: string;
  summaryMarkdown: string;
}): IntegrationPayload {
  return {
    meetingId: args.meetingId,
    title: args.title,
    createdAt: args.createdAt,
    summaryMarkdown: args.summaryMarkdown,
    source: 'Protocolito',
  };
}

export function formatIntegrationPackage(payload: IntegrationPayload): string {
  return [
    `# ${payload.title}`,
    '',
    `Source: ${payload.source}`,
    `Meeting ID: ${payload.meetingId}`,
    `Created: ${new Date(payload.createdAt).toLocaleString()}`,
    '',
    '---',
    '',
    payload.summaryMarkdown,
  ].join('\n');
}

export async function sendSummaryToIntegrations(payload: IntegrationPayload, configs = loadIntegrations()) {
  const enabled = configs.filter((config) => config.enabled && ACTIVE_SEND_PROVIDERS.has(config.provider));
  const results: Array<{ provider: IntegrationProvider; status: 'sent' | 'copied' | 'skipped' | 'error'; message?: string }> = [];
  const markdownPackage = formatIntegrationPackage(payload);

  for (const config of enabled) {
    try {
      await invoke('api_integrations_send_summary', {
        config: {
          provider: config.provider,
          connectedAccountId: config.connectedAccountId || (config as any).composioConnectedAccountId || '',
          target: config.target || '',
        },
        payload: {
          ...payload,
          markdownPackage,
        },
      });
      results.push({ provider: config.provider, status: 'sent' });
    } catch (error) {
      results.push({
        provider: config.provider,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (enabled.length === 0) {
    await navigator.clipboard.writeText(markdownPackage);
    results.push({ provider: 'google-docs', status: 'copied', message: 'No integration enabled; Markdown copied' });
  }

  return results;
}
