import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accessService, AccessConfig } from '@/services/accessService';
import { useConfig } from '@/contexts/ConfigContext';

export function ProtocolitoAccessSettings() {
  const { t } = useConfig();
  const [accessConfig, setAccessConfig] = useState<AccessConfig>({
    baseUrl: '',
    accessKey: '',
    company: null,
    lastCheckedAt: null,
    lastStatus: null,
  });
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessChecking, setAccessChecking] = useState(false);

  useEffect(() => {
    accessService.getConfig()
      .then(setAccessConfig)
      .catch((error) => {
        console.error('Failed to load access config:', error);
      });
  }, []);

  const handleSaveAccess = async () => {
    setAccessSaving(true);
    try {
      const saved = await accessService.saveConfig({
        baseUrl: accessConfig.baseUrl,
        accessKey: accessConfig.accessKey,
      });
      setAccessConfig(saved);
      toast.success(t('access.saved'));
    } catch (error) {
      console.error('Failed to save access settings:', error);
      toast.error(t('access.saveFailed'));
    } finally {
      setAccessSaving(false);
    }
  };

  const handleCheckAccess = async () => {
    setAccessChecking(true);
    try {
      await handleSaveAccess();
      const result = await accessService.check('settings_check');
      const latest = await accessService.getConfig();
      setAccessConfig(latest);

      if (result.ok) {
        toast.success(t('access.active'), {
          description: result.company?.name || result.company?.id || undefined,
        });
      } else {
        toast.error(t('access.checkFailed'), {
          description: result.message || t('access.keyNotAccepted'),
        });
      }
    } catch (error) {
      console.error('Failed to check access:', error);
      toast.error(t('access.checkFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAccessChecking(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-orange-500" />
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('access.title')}</h3>
            <p className="text-sm text-gray-600">
              {t('access.description')}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">{t('access.backendUrl')}</label>
              <Input
                value={accessConfig.baseUrl}
                onChange={(event) => setAccessConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://protocolito.example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">{t('access.licenseKey')}</label>
              <Input
                type="password"
                value={accessConfig.accessKey}
                onChange={(event) => setAccessConfig((prev) => ({ ...prev, accessKey: event.target.value }))}
                placeholder={t('access.pasteCustomerKey')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleSaveAccess}
              variant="outline"
              disabled={accessSaving || accessChecking}
            >
              {accessSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('common.save')}
            </Button>
            <Button
              type="button"
              onClick={handleCheckAccess}
              disabled={accessSaving || accessChecking}
              className="bg-stone-950 hover:bg-stone-800"
            >
              {accessChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('access.check')}
            </Button>
            {accessConfig.lastStatus === 'active' ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {accessConfig.company?.name ? t('access.activeFor').replace('{company}', accessConfig.company.name) : t('access.active')}
              </span>
            ) : accessConfig.lastStatus ? (
              <span className="inline-flex items-center gap-1 text-sm text-red-700">
                <XCircle className="h-4 w-4" />
                {t('access.notActive')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
