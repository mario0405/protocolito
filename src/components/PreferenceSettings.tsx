"use client"

import { useEffect, useState, useRef } from "react"
import { Switch } from "./ui/switch"
import { Bell, FolderOpen, HardDrive, Languages, MessageSquareText, Moon, Sun } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import Analytics from "@/lib/analytics"
import { useConfig, NotificationSettings } from "@/contexts/ConfigContext"
import { LANGUAGES } from "@/constants/languages"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import type { AppLanguage } from "@/lib/i18n"
import { ProtocolitoAccessSettings } from "@/components/ProtocolitoAccessSettings"
import { OfflineQueueSettings } from "@/components/OfflineQueueSettings"

export function PreferenceSettings() {
  const {
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings,
    selectedLanguage,
    setSelectedLanguage,
    appLanguage,
    setAppLanguage,
    t
  } = useConfig();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousNotificationsEnabled, setPreviousNotificationsEnabled] = useState<boolean | null>(null);
  const [languageSwitchProgress, setLanguageSwitchProgress] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('protocolito.theme') === 'dark');
  const hasTrackedViewRef = useRef(false);

  // Lazy load preferences on mount (only loads if not already cached)
  useEffect(() => {
    loadPreferences();
    // Reset tracking ref on mount (every tab visit)
    hasTrackedViewRef.current = false;
  }, [loadPreferences]);

  // Track preferences viewed analytics on every tab visit (once per mount)
  useEffect(() => {
    if (hasTrackedViewRef.current) return;

    const trackPreferencesViewed = async () => {
      // Wait for notification settings to be available (either from cache or after loading)
      if (notificationSettings) {
        await Analytics.track('preferences_viewed', {
          notifications_enabled: notificationSettings.notification_preferences.show_recording_started ? 'true' : 'false'
        });
        hasTrackedViewRef.current = true;
      } else if (!isLoadingPreferences) {
        // If not loading and no settings available, track with default value
        await Analytics.track('preferences_viewed', {
          notifications_enabled: 'false'
        });
        hasTrackedViewRef.current = true;
      }
    };

    trackPreferencesViewed();
  }, [notificationSettings, isLoadingPreferences]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('protocolito.theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Update notificationsEnabled when notificationSettings are loaded from global state
  useEffect(() => {
    if (notificationSettings) {
      // Notification enabled means both started and stopped notifications are enabled
      const enabled =
        notificationSettings.notification_preferences.show_recording_started &&
        notificationSettings.notification_preferences.show_recording_stopped;
      setNotificationsEnabled(enabled);
      if (isInitialLoad) {
        setPreviousNotificationsEnabled(enabled);
        setIsInitialLoad(false);
      }
    } else if (!isLoadingPreferences) {
      // If not loading and no settings, use default
      setNotificationsEnabled(true);
      if (isInitialLoad) {
        setPreviousNotificationsEnabled(true);
        setIsInitialLoad(false);
      }
    }
  }, [notificationSettings, isLoadingPreferences, isInitialLoad])

  useEffect(() => {
    // Skip update on initial load or if value hasn't actually changed
    if (isInitialLoad || notificationsEnabled === null || notificationsEnabled === previousNotificationsEnabled) return;
    if (!notificationSettings) return;

    const handleUpdateNotificationSettings = async () => {
      console.log("Updating notification settings to:", notificationsEnabled);

      try {
        // Update the notification preferences
        const updatedSettings: NotificationSettings = {
          ...notificationSettings,
          notification_preferences: {
            ...notificationSettings.notification_preferences,
            show_recording_started: notificationsEnabled,
            show_recording_stopped: notificationsEnabled,
          }
        };

        console.log("Calling updateNotificationSettings with:", updatedSettings);
        await updateNotificationSettings(updatedSettings);
        setPreviousNotificationsEnabled(notificationsEnabled);
        console.log("Successfully updated notification settings to:", notificationsEnabled);

        // Track notification preference change - only fires when user manually toggles
        await Analytics.track('notification_settings_changed', {
          notifications_enabled: notificationsEnabled.toString()
        });
      } catch (error) {
        console.error('Failed to update notification settings:', error);
      }
    };

    handleUpdateNotificationSettings();
  }, [notificationsEnabled, notificationSettings, isInitialLoad, previousNotificationsEnabled, updateNotificationSettings])

  const handleOpenFolder = async (folderType: 'database' | 'models' | 'recordings') => {
    try {
      switch (folderType) {
        case 'database':
          await invoke('open_database_folder');
          break;
        case 'models':
          await invoke('open_models_folder');
          break;
        case 'recordings':
          await invoke('open_recordings_folder');
          break;
      }

      // Track storage folder access
      await Analytics.track('storage_folder_opened', {
        folder_type: folderType
      });
    } catch (error) {
      console.error(`Failed to open ${folderType} folder:`, error);
    }
  };

  // Show loading only if we're actually loading and don't have cached data
  if (isLoadingPreferences && !notificationSettings && !storageLocations) {
    return <div className="max-w-2xl mx-auto p-6">{t('common.loadingPreferences')}</div>
  }

  // Show loading if notificationsEnabled hasn't been determined yet
  if (notificationsEnabled === null && !isLoadingPreferences) {
    return <div className="max-w-2xl mx-auto p-6">{t('common.loadingPreferences')}</div>
  }

  // Ensure we have a boolean value for the Switch component
  const notificationsEnabledValue = notificationsEnabled ?? false;

  const handleAppLanguageChange = (language: AppLanguage) => {
    if (language === appLanguage || languageSwitchProgress !== null) return;

    setLanguageSwitchProgress(8);
    const steps = [24, 45, 68, 86, 100];
    steps.forEach((progress, index) => {
      window.setTimeout(() => {
        setLanguageSwitchProgress(progress);
        if (progress === 86) setAppLanguage(language);
        if (progress === 100) {
          window.setTimeout(() => setLanguageSwitchProgress(null), 250);
        }
      }, 180 * (index + 1));
    });
  };

  return (
    <div className="space-y-6">
      {languageSwitchProgress !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--pt-bg-primary)]/95 backdrop-blur">
          <div className="w-full max-w-xs text-center">
            <div className="text-sm font-medium text-stone-950">{t('preferences.switchingLanguage')}</div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-stone-950 transition-all duration-200"
                style={{ width: `${languageSwitchProgress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-stone-500">{languageSwitchProgress}%</div>
          </div>
        </div>
      )}

      <ProtocolitoAccessSettings />

      <div className="pt-panel rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-[var(--pt-brand-soft)] p-2 text-[var(--pt-brand)]">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('preferences.appearanceTitle')}</h3>
              <p className="text-sm text-gray-600">{t('preferences.appearanceDescription')}</p>
            </div>
          </div>
          <Switch checked={darkMode} onCheckedChange={setDarkMode} />
        </div>
      </div>

      {/* Language Section */}
      <div className="pt-panel rounded-2xl p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-[var(--pt-brand-soft)] p-2 text-[var(--pt-brand)]">
            <Languages className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('preferences.uiLanguageTitle')}</h3>
            <p className="text-sm text-gray-600">{t('preferences.uiLanguageDescription')}</p>
          </div>
        </div>
        <div className="space-y-2 max-w-md">
          <Label>{t('preferences.uiLanguageLabel')}</Label>
          <Select value={appLanguage} onValueChange={(value) => handleAppLanguageChange(value as AppLanguage)}>
            <SelectTrigger>
              <SelectValue placeholder={t('preferences.uiLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('preferences.english')}</SelectItem>
              <SelectItem value="de">{t('preferences.german')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Meeting Language Section */}
      <div className="pt-panel rounded-2xl p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-[var(--pt-brand-soft)] p-2 text-[var(--pt-brand)]">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('preferences.meetingLanguageTitle')}</h3>
            <p className="text-sm text-gray-600">{t('preferences.meetingLanguageDescription')}</p>
          </div>
        </div>
        <div className="space-y-2 max-w-md">
          <Label>{t('preferences.meetingLanguageLabel')}</Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue placeholder={t('preferences.meetingLanguageLabel')} />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="pt-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-[var(--pt-brand-soft)] p-2 text-[var(--pt-brand)]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('preferences.notificationsTitle')}</h3>
              <p className="text-sm text-gray-600">{t('preferences.notificationsDescription')}</p>
            </div>
          </div>
          <Switch checked={notificationsEnabledValue} onCheckedChange={setNotificationsEnabled} />
        </div>
      </div>

      {/* Data Storage Locations Section */}
      <div className="pt-panel rounded-2xl p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-[var(--pt-brand-soft)] p-2 text-[var(--pt-brand)]">
            <HardDrive className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('preferences.storageTitle')}</h3>
            <p className="text-sm text-gray-600">{t('preferences.storageDescription')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Database Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Database</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.database || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('database')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Models Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Whisper Models</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.models || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('models')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Recordings Location */}
          <div className="rounded-xl border border-[var(--pt-border)] bg-[var(--pt-bg-secondary)] p-4">
            <div className="font-medium mb-2">{t('preferences.meetingRecordings')}</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.recordings || t('common.loadingPreferences')}
            </div>
            <button
              onClick={() => handleOpenFolder('recordings')}
              className="pt-focus-ring flex items-center gap-2 rounded-xl border border-[var(--pt-border)] px-3 py-2 text-sm transition-colors hover:bg-[var(--pt-bg-elevated)]"
            >
              <FolderOpen className="w-4 h-4" />
              {t('preferences.openFolder')}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--pt-brand-soft)] p-3">
          <p className="text-xs text-[var(--pt-text-secondary)]">
            <strong>{t('common.note')}</strong> {t('preferences.storageNote')}
          </p>
        </div>
      </div>

      <OfflineQueueSettings />
    </div>
  )
}
