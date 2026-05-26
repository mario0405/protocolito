import { Summary } from '@/types';

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
  autoSendSummary: boolean;
}

export interface IntegrationPayload {
  meetingId: string;
  title: string;
  createdAt: string;
  summaryMarkdown: string;
  source: 'Protocolito';
}

const STORAGE_KEY = 'protocolito.integrations.v1';
const ACTIVE_SEND_PROVIDERS = new Set<IntegrationProvider>(['notion', 'asana']);

export const INTEGRATION_DEFAULTS: IntegrationConfig[] = [
  { provider: 'google-calendar', enabled: false, target: '', autoSendSummary: false },
  { provider: 'notion', enabled: false, token: '', target: '', autoSendSummary: false },
  { provider: 'asana', enabled: false, token: '', target: '', autoSendSummary: false },
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
    return INTEGRATION_DEFAULTS.map((base) => ({
      ...base,
      ...(saved.find((item) => item.provider === base.provider) || {}),
      enabled: base.provider === 'google-calendar' || ACTIVE_SEND_PROVIDERS.has(base.provider)
        ? Boolean((saved.find((item) => item.provider === base.provider) || base).enabled)
        : false,
    }));
  } catch {
    return INTEGRATION_DEFAULTS;
  }
}

export function saveIntegrations(configs: IntegrationConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
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

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ''}`);
  }
}

function authHeader(token: string) {
  const trimmed = token.trim();
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function notionText(content: string) {
  return [{ text: { content } }];
}

function notionBlocks(markdownPackage: string) {
  const chunks: string[] = [];
  let remaining = markdownPackage.trim() || 'Protocol generated by Protocolito.';

  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, 1900));
    remaining = remaining.slice(1900);
  }

  return chunks.map((chunk) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: notionText(chunk) },
  }));
}

function createNotionPagePayload(payload: IntegrationPayload, markdownPackage: string, target: string, parentType: 'database' | 'page') {
  const title = payload.title || 'Protocolito protocol';

  if (parentType === 'page') {
    return {
      parent: { page_id: target },
      properties: {
        title: {
          title: notionText(title),
        },
      },
      children: notionBlocks(markdownPackage),
    };
  }

  return {
    parent: { database_id: target },
    properties: {
      Name: { title: notionText(title) },
    },
    children: notionBlocks(markdownPackage),
  };
}

async function sendToNotion(config: IntegrationConfig, payload: IntegrationPayload, markdownPackage: string) {
  const target = config.target?.trim();
  const token = config.token?.trim();
  if (!target || !token) return false;

  const headers = {
    Authorization: authHeader(token),
    'Notion-Version': '2022-06-28',
  };

  try {
    await postJson(
      'https://api.notion.com/v1/pages',
      createNotionPagePayload(payload, markdownPackage, target, 'database'),
      headers,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/is a page, not a database|database_id .* page/i.test(message)) {
      throw error;
    }
  }

  await postJson(
    'https://api.notion.com/v1/pages',
    createNotionPagePayload(payload, markdownPackage, target, 'page'),
    headers,
  );
  return true;
}

export async function sendSummaryToIntegrations(payload: IntegrationPayload, configs = loadIntegrations()) {
  const enabled = configs.filter((config) => config.enabled && ACTIVE_SEND_PROVIDERS.has(config.provider));
  const results: Array<{ provider: IntegrationProvider; status: 'sent' | 'copied' | 'skipped' | 'error'; message?: string }> = [];
  const markdownPackage = formatIntegrationPackage(payload);

  for (const config of enabled) {
    try {
      if (config.provider === 'notion' && await sendToNotion(config, payload, markdownPackage)) {
        results.push({ provider: config.provider, status: 'sent' });
        continue;
      }

      if (config.provider === 'asana' && config.token?.trim() && config.target?.trim()) {
        await postJson(
          'https://app.asana.com/api/1.0/tasks',
          {
            data: {
              name: payload.title,
              notes: markdownPackage,
              projects: [config.target.trim()],
            },
          },
          { Authorization: `Bearer ${config.token.trim()}` },
        );
        results.push({ provider: config.provider, status: 'sent' });
        continue;
      }

      await navigator.clipboard.writeText(markdownPackage);
      results.push({ provider: config.provider, status: 'copied', message: 'Integration setup pending; Markdown copied for paste/import' });
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
