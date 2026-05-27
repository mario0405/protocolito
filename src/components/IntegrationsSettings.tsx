'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clock3, RefreshCw } from 'lucide-react';
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
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  GoogleCalendarStatus,
  saveGoogleCalendarConfig,
  startGoogleCalendarWatch,
  syncGoogleCalendar,
} from '@/services/calendarService';
import { useConfig } from '@/contexts/ConfigContext';

const HELP_KEYS: Record<IntegrationConfig['provider'], string> = {
  'google-calendar': 'integrations.googleHelp',
  notion: 'integrations.notionHelp',
  asana: 'integrations.asanaHelp',
  'google-docs': 'integrations.googleDocsHelp',
  slack: 'integrations.slackHelp',
  teams: 'integrations.teamsHelp',
  trello: 'integrations.trelloHelp',
  jira: 'integrations.jiraHelp',
  monday: 'integrations.mondayHelp',
  hubspot: 'integrations.crmHelp',
  salesforce: 'integrations.crmHelp',
};

const ICON_URLS: Record<IntegrationConfig['provider'], string> = {
  'google-calendar': 'https://cdn.simpleicons.org/googlecalendar/4285F4',
  notion: 'https://cdn.simpleicons.org/notion/111111',
  asana: 'https://cdn.simpleicons.org/asana/F06A6A',
  'google-docs': 'https://cdn.simpleicons.org/googledocs/4285F4',
  slack: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
  teams: 'https://teams.microsoft.com/favicon.ico',
  trello: 'https://cdn.simpleicons.org/trello/0052CC',
  jira: 'https://cdn.simpleicons.org/jira/0052CC',
  monday: 'https://monday.com/favicon.ico',
  hubspot: 'https://cdn.simpleicons.org/hubspot/FF7A59',
  salesforce: 'https://www.salesforce.com/favicon.ico',
};

const ACTIVE_SEND_PROVIDERS = new Set<IntegrationConfig['provider']>(['notion', 'asana']);

export function IntegrationsSettings() {
  const { t } = useConfig();
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleWebhookUrl, setGoogleWebhookUrl] = useState('');
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);
  const [showGoogleAdvanced, setShowGoogleAdvanced] = useState(false);

  useEffect(() => {
    setConfigs(loadIntegrations());
    refreshGoogleStatus();
  }, []);

  const refreshGoogleStatus = async () => {
    const status = await getGoogleCalendarStatus();
    setGoogleStatus(status);
    setGoogleWebhookUrl(status.realtimeWebhookUrl || '');
  };

  const updateConfig = (provider: IntegrationConfig['provider'], patch: Partial<IntegrationConfig>) => {
    setConfigs((prev) => prev.map((config) => (
      config.provider === provider ? { ...config, ...patch } : config
    )));
  };

  const handleSave = () => {
    saveIntegrations(configs);
    toast.success(t('integrations.saved'));
  };

  const handleSaveGoogle = async () => {
    setIsGoogleBusy(true);
    try {
      await saveGoogleCalendarConfig({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        realtimeWebhookUrl: googleWebhookUrl,
      });
      await refreshGoogleStatus();
      toast.success(t('integrations.googleSaved'));
    } catch (error) {
      toast.error(t('integrations.googleSaveFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsGoogleBusy(true);
    try {
      await connectGoogleCalendar();
      await refreshGoogleStatus();
      updateConfig('google-calendar', { enabled: true });
      toast.success(t('integrations.googleConnected'));
    } catch (error) {
      toast.error(t('integrations.googleConnectionFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleSyncGoogle = async () => {
    setIsGoogleBusy(true);
    try {
      const result = await syncGoogleCalendar();
      await refreshGoogleStatus();
      toast.success(t('integrations.googleSynced').replace('{count}', String(result.count)));
    } catch (error) {
      toast.error(t('integrations.googleSyncFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleWatchGoogle = async () => {
    setIsGoogleBusy(true);
    try {
      await startGoogleCalendarWatch();
      toast.success(t('integrations.watchStarted'));
    } catch (error) {
      toast.error(t('integrations.watchFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setIsGoogleBusy(true);
    try {
      await disconnectGoogleCalendar();
      await refreshGoogleStatus();
      updateConfig('google-calendar', { enabled: false });
      toast.success(t('integrations.googleDisconnected'));
    } catch (error) {
      toast.error(t('integrations.googleDisconnectFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGoogleBusy(false);
    }
  };

  const googleConfig = configs.find((config) => config.provider === 'google-calendar');
  const otherConfigs = configs.filter((config) => config.provider !== 'google-calendar');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-950">{t('integrations.title')}</h3>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            {t('integrations.description')}
          </p>
        </div>
        <Button onClick={handleSave} className="bg-stone-950 hover:bg-stone-800">
          <Check className="h-4 w-4" />
          {t('common.save')}
        </Button>
      </div>

      <section className="pt-panel rounded-2xl p-5">
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={ICON_URLS['google-calendar']} alt="" className="h-8 w-8 object-contain" />
              <div>
                <h4 className="font-semibold text-[var(--pt-text-primary)]">Google Calendar</h4>
                <p className="text-xs text-stone-600 dark:text-stone-300">{googleStatus?.connected ? t('integrations.connected') : t('integrations.notConnected')}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
              {t('integrations.googleDescription')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Switch
                checked={Boolean(googleConfig?.enabled || googleStatus?.connected)}
                onCheckedChange={(checked) => updateConfig('google-calendar', { enabled: checked })}
              />
              <Button type="button" disabled={isGoogleBusy || !googleStatus?.clientIdConfigured} onClick={handleConnectGoogle} className="bg-stone-950 hover:bg-stone-800">
                <CalendarDays className="h-4 w-4" />
                {googleStatus?.connected ? t('integrations.reconnectGoogle') : t('integrations.connectGoogle')}
              </Button>
              <Button type="button" variant="outline" disabled={isGoogleBusy || !googleStatus?.connected} onClick={handleSyncGoogle}>
                <RefreshCw className="h-4 w-4" />
                {t('integrations.syncNow')}
              </Button>
              <Button type="button" variant="outline" disabled={isGoogleBusy || !googleStatus?.connected} onClick={handleWatchGoogle}>
                {t('integrations.realtimeWatch')}
              </Button>
              <Button type="button" variant="outline" disabled={isGoogleBusy || !googleStatus?.connected} onClick={handleDisconnectGoogle}>
                {t('integrations.disconnect')}
              </Button>
            </div>

            <div className="text-xs text-stone-600 dark:text-stone-300">
              {googleStatus?.lastSyncedAt ? `${t('integrations.lastSync').replace('{time}', new Date(googleStatus.lastSyncedAt).toLocaleString())} · ` : ''}
              {googleStatus?.eventCount ? t('integrations.eventsSynced').replace('{count}', String(googleStatus.eventCount)) : t('integrations.noEventsSynced')}
            </div>

            {!googleStatus?.clientIdConfigured && (
              <div className="rounded-xl border border-[var(--pt-border)] bg-[var(--pt-brand-soft)] px-3 py-2 text-sm text-[var(--pt-text-primary)]">
                {t('integrations.googleOauthMissing')}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGoogleAdvanced((value) => !value)}
              className="flex items-center gap-2 text-xs font-medium text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showGoogleAdvanced ? 'rotate-180' : ''}`} />
              {t('integrations.advancedGoogle')}
            </button>

            {showGoogleAdvanced && (
              <div className="grid gap-3 rounded-xl border border-[var(--pt-border)] bg-[var(--pt-bg-secondary)] p-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-600">{t('integrations.oauthClientId')}</Label>
                  <Input
                    value={googleClientId}
                    onChange={(event) => setGoogleClientId(event.target.value)}
                    placeholder={googleStatus?.clientIdConfigured ? t('integrations.configured') : t('integrations.googleClientIdPlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-600">{t('integrations.oauthClientSecret')}</Label>
                  <Input
                    type="password"
                    value={googleClientSecret}
                    onChange={(event) => setGoogleClientSecret(event.target.value)}
                    placeholder={t('integrations.optionalPkce')}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-stone-600">{t('integrations.realtimeWebhookUrl')}</Label>
                  <Input
                    type="url"
                    value={googleWebhookUrl}
                    onChange={(event) => setGoogleWebhookUrl(event.target.value)}
                    placeholder="https://your-company-domain.com/google/calendar/webhook"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="button" variant="outline" disabled={isGoogleBusy} onClick={handleSaveGoogle}>
                    <Check className="h-4 w-4" />
                    {t('integrations.saveAdvanced')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {otherConfigs.map((config) => {
          const isConfigurable = ACTIVE_SEND_PROVIDERS.has(config.provider);

          return (
          <section key={config.provider} className="pt-panel rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={ICON_URLS[config.provider]}
                  alt=""
                  className={`h-8 w-8 object-contain ${config.provider === 'notion' ? 'dark:invert' : ''}`}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-medium text-stone-950 dark:text-white">{INTEGRATION_LABELS[config.provider]}</h4>
                    {!isConfigurable && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        <Clock3 className="h-3 w-3" />
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{t(HELP_KEYS[config.provider])}</p>
                </div>
              </div>
              <Switch
                checked={isConfigurable && config.enabled}
                disabled={!isConfigurable}
                onCheckedChange={(checked) => updateConfig(config.provider, { enabled: checked })}
              />
            </div>

            {isConfigurable ? (
            <div className="mt-4 grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">{t('integrations.accessToken')}</Label>
                <Input
                  type="password"
                  value={config.token || ''}
                  onChange={(event) => updateConfig(config.provider, { token: event.target.value })}
                  placeholder={t('integrations.tokenPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-600">{t('integrations.destination')}</Label>
                <Input
                  value={config.target || ''}
                  onChange={(event) => updateConfig(config.provider, { target: event.target.value })}
                  placeholder={t('integrations.destinationPlaceholder')}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <Switch
                  checked={config.autoSendSummary}
                  onCheckedChange={(checked) => updateConfig(config.provider, { autoSendSummary: checked })}
                />
                {t('integrations.autoSendSummaries')}
              </label>
            </div>
            ) : (
              <div className="mt-4 rounded-xl border border-[var(--pt-border)] bg-[var(--pt-bg-secondary)] px-3 py-2 text-xs text-[var(--pt-text-secondary)]">
                Visible for roadmap clarity. Full OAuth/API setup will be added before this connector is enabled.
              </div>
            )}
          </section>
          );
        })}
      </div>
    </div>
  );
}
