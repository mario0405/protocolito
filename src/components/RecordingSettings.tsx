import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, FolderOpen, KeyRound, Loader2, XCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceSelection, SelectedDevices } from '@/components/DeviceSelection';
import Analytics from '@/lib/analytics';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { accessService, AccessConfig } from '@/services/accessService';

export interface RecordingPreferences {
  save_folder: string;
  auto_save: boolean;
  file_format: string;
  preferred_mic_device: string | null;
  preferred_system_device: string | null;
}

interface RecordingSettingsProps {
  onSave?: (preferences: RecordingPreferences) => void;
}

export function RecordingSettings({ onSave }: RecordingSettingsProps) {
  const { t } = useConfig();
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    save_folder: '',
    auto_save: true,
    file_format: 'mp4',
    preferred_mic_device: null,
    preferred_system_device: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRecordingNotification, setShowRecordingNotification] = useState(true);
  const [accessConfig, setAccessConfig] = useState<AccessConfig>({
    baseUrl: '',
    accessKey: '',
    company: null,
    lastCheckedAt: null,
    lastStatus: null,
  });
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessChecking, setAccessChecking] = useState(false);

  // Load recording preferences on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await invoke<RecordingPreferences>('get_recording_preferences');
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load recording preferences:', error);
        // If loading fails, get default folder path
        try {
          const defaultPath = await invoke<string>('get_default_recordings_folder_path');
          setPreferences(prev => ({ ...prev, save_folder: defaultPath }));
        } catch (defaultError) {
          console.error('Failed to get default folder path:', defaultError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    accessService.getConfig()
      .then(setAccessConfig)
      .catch((error) => {
        console.error('Failed to load access config:', error);
      });
  }, []);

  // Load recording notification preference
  useEffect(() => {
    const loadNotificationPref = async () => {
      try {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = await Store.load('preferences.json');
        const show = await store.get<boolean>('show_recording_notification') ?? true;
        setShowRecordingNotification(show);
      } catch (error) {
        console.error('Failed to load notification preference:', error);
      }
    };
    loadNotificationPref();
  }, []);

  const handleAutoSaveToggle = async (enabled: boolean) => {
    const newPreferences = { ...preferences, auto_save: enabled };
    setPreferences(newPreferences);
    await savePreferences(newPreferences);

    // Track auto-save setting change
    await Analytics.track('auto_save_recording_toggled', {
      enabled: enabled.toString()
    });
  };

  const handleDeviceChange = async (devices: SelectedDevices) => {
    const newPreferences = {
      ...preferences,
      preferred_mic_device: devices.micDevice,
      preferred_system_device: devices.systemDevice
    };
    setPreferences(newPreferences);
    await savePreferences(newPreferences);

    // Track default device preference changes
    // Note: Individual device selection analytics are tracked in DeviceSelection component
    await Analytics.track('default_devices_changed', {
      has_preferred_microphone: (!!devices.micDevice).toString(),
      has_preferred_system_audio: (!!devices.systemDevice).toString()
    });
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_recordings_folder');
    } catch (error) {
      console.error('Failed to open recordings folder:', error);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      setShowRecordingNotification(enabled);
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('preferences.json');
      await store.set('show_recording_notification', enabled);
      await store.save();
      toast.success('Preference saved');
      await Analytics.track('recording_notification_preference_changed', {
        enabled: enabled.toString()
      });
    } catch (error) {
      console.error('Failed to save notification preference:', error);
      toast.error('Failed to save preference');
    }
  };

  const handleSaveAccess = async () => {
    setAccessSaving(true);
    try {
      const saved = await accessService.saveConfig({
        baseUrl: accessConfig.baseUrl,
        accessKey: accessConfig.accessKey,
      });
      setAccessConfig(saved);
      toast.success('Access settings saved');
    } catch (error) {
      console.error('Failed to save access settings:', error);
      toast.error('Failed to save access settings');
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
        toast.success('Access key is active', {
          description: result.company?.name || result.company?.id || undefined,
        });
      } else {
        toast.error('Access check failed', {
          description: result.message || 'The key was not accepted.',
        });
      }
    } catch (error) {
      console.error('Failed to check access:', error);
      toast.error('Access check failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAccessChecking(false);
    }
  };

  const savePreferences = async (prefs: RecordingPreferences) => {
    setSaving(true);
    try {
      await invoke('set_recording_preferences', { preferences: prefs });
      onSave?.(prefs);

      // Show success toast with device details
      const micDevice = prefs.preferred_mic_device || 'Default';
      const systemDevice = prefs.preferred_system_device || 'Default';
      toast.success("Device preferences saved", {
        description: `Microphone: ${micDevice}, System Audio: ${systemDevice}`
      });
    } catch (error) {
      console.error('Failed to save recording preferences:', error);
      toast.error("Failed to save device preferences", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('recording.title')}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('recording.description')}
        </p>
      </div>

      <div className="p-4 border rounded-lg bg-white">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 text-gray-500" />
          <div className="flex-1 space-y-4">
            <div>
              <div className="font-medium">Protocolito access</div>
              <div className="text-sm text-gray-600">
                Enter the backend URL and customer license key used before recording or importing audio.
              </div>
            </div>

            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Backend URL</label>
                <Input
                  value={accessConfig.baseUrl}
                  onChange={(event) => setAccessConfig((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  placeholder="https://protocolito.example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">License key</label>
                <Input
                  type="password"
                  value={accessConfig.accessKey}
                  onChange={(event) => setAccessConfig((prev) => ({ ...prev, accessKey: event.target.value }))}
                  placeholder="Paste customer key"
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
                Save
              </Button>
              <Button
                type="button"
                onClick={handleCheckAccess}
                disabled={accessSaving || accessChecking}
              >
                {accessChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Check access
              </Button>
              {accessConfig.lastStatus === 'active' ? (
                <span className="inline-flex items-center gap-1 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Active{accessConfig.company?.name ? ` for ${accessConfig.company.name}` : ''}
                </span>
              ) : accessConfig.lastStatus ? (
                <span className="inline-flex items-center gap-1 text-sm text-red-700">
                  <XCircle className="h-4 w-4" />
                  Not active
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Auto Save Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">{t('recording.saveAudio')}</div>
          <div className="text-sm text-gray-600">
            {t('recording.saveAudioDescription')}
          </div>
        </div>
        <Switch
          checked={preferences.auto_save}
          onCheckedChange={handleAutoSaveToggle}
          disabled={saving}
        />
      </div>

      {/* Folder Location - Only shown when auto_save is enabled */}
      {preferences.auto_save && (
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">{t('recording.saveLocation')}</div>
            <div className="text-sm text-gray-600 mb-3 break-all">
              {preferences.save_folder || t('recording.defaultFolder')}
            </div>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              {t('preferences.openFolder')}
            </button>
          </div>

          <div className="p-4 border rounded-lg bg-blue-50">
            <div className="text-sm text-blue-800">
              <strong>{t('recording.fileFormat')}:</strong> {preferences.file_format.toUpperCase()} files
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {t('recording.fileFormatDescription')}: recording_YYYYMMDD_HHMMSS.{preferences.file_format}
            </div>
          </div>
        </div>
      )}

      {/* Info when auto_save is disabled */}
      {!preferences.auto_save && (
        <div className="p-4 border rounded-lg bg-yellow-50">
          <div className="text-sm text-yellow-800">
            {t('recording.disabledDescription')}
          </div>
        </div>
      )}

      {/* Recording Notification Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">{t('recording.notification')}</div>
          <div className="text-sm text-gray-600">
            {t('recording.notificationDescription')}
          </div>
        </div>
        <Switch
          checked={showRecordingNotification}
          onCheckedChange={handleNotificationToggle}
        />
      </div>

      {/* Device Preferences */}
      <div className="space-y-4">
        <div className="border-t pt-6">
          <h4 className="text-base font-medium text-gray-900 mb-4">{t('recording.defaultDevices')}</h4>
          <p className="text-sm text-gray-600 mb-4">
            {t('recording.defaultDevicesDescription')}
          </p>

          <div className="border rounded-lg p-4 bg-gray-50">
            <DeviceSelection
              selectedDevices={{
                micDevice: preferences.preferred_mic_device,
                systemDevice: preferences.preferred_system_device
              }}
              onDeviceChange={handleDeviceChange}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
