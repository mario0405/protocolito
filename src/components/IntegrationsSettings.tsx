'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  INTEGRATION_LABELS,
  IntegrationConfig,
  loadIntegrations,
  saveIntegrations,
} from '@/services/integrationService';
import { toast } from 'sonner';

const HELP_TEXT: Record<IntegrationConfig['provider'], string> = {
  notion: 'Notion page or database ID plus an internal integration token. Creates a page for each summary.',
  asana: 'Project GID plus a personal access token. Creates a task with the meeting protocol.',
  'google-docs': 'Copy-ready for now. Use a webhook or automation bridge for direct document creation.',
  obsidian: 'Copy-ready Markdown for vault paste/import.',
  markdown: 'Copy-ready Markdown for any notes folder.',
  webhook: 'POSTs Protocolito JSON to Make, Zapier, n8n, or a custom internal endpoint.',
};

export function IntegrationsSettings() {
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);

  useEffect(() => {
    setConfigs(loadIntegrations());
  }, []);

  const updateConfig = (provider: IntegrationConfig['provider'], patch: Partial<IntegrationConfig>) => {
    setConfigs((prev) => prev.map((config) => (
      config.provider === provider ? { ...config, ...patch } : config
    )));
  };

  const handleSave = () => {
    saveIntegrations(configs);
    toast.success('Integrations saved');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">App integrations</h3>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Send finished protocols into the tools your team already uses. Keep direct tokens local, or route through a Swiss-hosted webhook.
          </p>
        </div>
        <Button onClick={handleSave} className="bg-stone-950 hover:bg-stone-800">
          <Check className="h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="divide-y divide-stone-200 border-y border-stone-200">
        {configs.map((config) => (
          <section key={config.provider} className="grid gap-4 py-5 md:grid-cols-[220px_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => updateConfig(config.provider, { enabled: checked })}
                />
                <h4 className="font-medium text-stone-950">{INTEGRATION_LABELS[config.provider]}</h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">{HELP_TEXT[config.provider]}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(config.provider === 'notion' || config.provider === 'asana') && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">Access token</Label>
                    <Input
                      type="password"
                      value={config.token || ''}
                      onChange={(event) => updateConfig(config.provider, { token: event.target.value })}
                      placeholder={config.provider === 'notion' ? 'secret_...' : 'Asana personal access token'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">
                      {config.provider === 'notion' ? 'Page or database ID' : 'Project GID'}
                    </Label>
                    <Input
                      value={config.target || ''}
                      onChange={(event) => updateConfig(config.provider, { target: event.target.value })}
                      placeholder={config.provider === 'notion' ? 'Notion page or database ID' : 'Asana project GID'}
                    />
                  </div>
                </>
              )}

              {config.provider === 'webhook' && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-stone-600">Webhook URL</Label>
                  <Input
                    type="url"
                    value={config.webhookUrl || ''}
                    onChange={(event) => updateConfig(config.provider, { webhookUrl: event.target.value })}
                    placeholder="https://hook.eu2.make.com/..."
                  />
                </div>
              )}

              {(config.provider === 'google-docs' || config.provider === 'obsidian' || config.provider === 'markdown') && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-stone-600">Destination note</Label>
                  <Input
                    value={config.target || ''}
                    onChange={(event) => updateConfig(config.provider, { target: event.target.value })}
                    placeholder="Optional folder, vault, or document name"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-stone-700 md:col-span-2">
                <Switch
                  checked={config.autoSendSummary}
                  onCheckedChange={(checked) => updateConfig(config.provider, { autoSendSummary: checked })}
                />
                Auto-send when a summary is completed
              </label>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
        For Swiss deployments, the webhook option is the cleanest bridge: run n8n, Make, or a small internal service on Swiss hosting and connect Notion, Asana, Google Docs, Confluence, or your DMS there.
      </div>
    </div>
  );
}
