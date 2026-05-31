import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePathname } from '@/lib/vite-shims/navigation';
import { Toaster, toast } from 'sonner';
import 'sonner/dist/styles.css';
import SplashScreen from '@/components/SplashScreen';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RecordingStateProvider } from '@/contexts/RecordingStateContext';
import { OllamaDownloadProvider } from '@/contexts/OllamaDownloadContext';
import { TranscriptProvider } from '@/contexts/TranscriptContext';
import { ConfigProvider, useConfig } from '@/contexts/ConfigContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { OnboardingFlow } from '@/components/onboarding';
import { DownloadProgressToastProvider } from '@/components/shared/DownloadProgressToast';
import { UpdateCheckProvider } from '@/components/UpdateCheckProvider';
import { RecordingPostProcessingProvider } from '@/contexts/RecordingPostProcessingProvider';
import { CalendarMeetingReminder } from '@/components/CalendarMeetingReminder';
import { RecordingProcessingOverlay } from '@/components/RecordingProcessingOverlay';
import { ImportAudioDialog, ImportDropOverlay } from '@/components/ImportAudio';
import { ImportDialogProvider } from '@/contexts/ImportDialogContext';
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider';
import { isAudioExtension, getAudioFormatsDisplayList } from '@/constants/audioFormats';
import { loadBetaFeatures } from '@/types/betaFeatures';
import { APP_NAME } from '@/constants/branding';
import { listOfflineQueue, retryOfflineQueueItem } from '@/services/offlineQueueService';
import Home from '@/app/page';
import MeetingDetails from '@/app/meeting-details/page';
import SettingsPage from '@/app/settings/page';
import MeetingSearchPage from '@/app/search/page';
import { PageShell } from '@/components/PageShell';
import { RecordingMiniWindow } from '@/components/RecordingMiniWindow';

/* SplashScreen is now in its own component file */

function ConditionalImportDialog({
  showImportDialog,
  handleImportDialogClose,
  importFilePath,
}: {
  showImportDialog: boolean;
  handleImportDialogClose: (open: boolean) => void;
  importFilePath: string | null;
}) {
  const { betaFeatures } = useConfig();

  if (!betaFeatures.importAndRetranscribe) return null;

  return (
    <ImportAudioDialog
      open={showImportDialog}
      onOpenChange={handleImportDialogClose}
      preselectedFile={importFilePath}
    />
  );
}

function CurrentRoute() {
  const pathname = usePathname();

  if (pathname === '/settings') return <SettingsPage />;
  if (pathname === '/search') return <MeetingSearchPage />;
  if (pathname === '/meeting-details') return <MeetingDetails />;
  return <Home />;
}

function AppShell() {
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showDropOverlay, setShowDropOverlay] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFilePath, setImportFilePath] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowStartupSplash(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem('protocolito.theme') === 'dark');
  }, []);

  useEffect(() => {
    let syncing = false;

    const syncOfflineQueue = async () => {
      if (syncing || !navigator.onLine) return;
      syncing = true;
      try {
        const queue = await listOfflineQueue();
        for (const item of queue.filter((entry) => entry.status !== 'syncing')) {
          await retryOfflineQueueItem(item.id);
        }
        if (queue.length > 0) {
          toast.success('Offline recordings synced', {
            description: `${queue.length} queued recording${queue.length === 1 ? '' : 's'} saved locally.`,
          });
        }
      } catch (error) {
        console.warn('[App] Offline queue sync failed:', error);
      } finally {
        syncing = false;
      }
    };

    window.addEventListener('online', syncOfflineQueue);
    syncOfflineQueue();
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      setShowOnboarding(true);
      setIsCheckingOnboarding(false);
    }, 8000);

    invoke<{ completed: boolean } | null>('get_onboarding_status')
      .then((status) => {
        if (cancelled) return;
        const isComplete = status?.completed ?? false;
        setShowOnboarding(!isComplete);
      })
      .catch((error) => {
        console.error('[App] Failed to check onboarding status:', error);
        if (!cancelled) setShowOnboarding(true);
      })
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(fallbackTimer);
        setIsCheckingOnboarding(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    const handleDirectStart = () => {
      if (showOnboarding) {
        toast.error('Please complete setup first', {
          description: 'Finish onboarding before starting a recording.',
        });
        return;
      }

      window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
    };

    window.addEventListener('request-recording-toggle', handleDirectStart);
    return () => window.removeEventListener('request-recording-toggle', handleDirectStart);
  }, [showOnboarding]);

  const handleFileDrop = useCallback((files: FileList | null) => {
    if (!files?.length) return;

    const betaFeatures = loadBetaFeatures();
    if (!betaFeatures.importAndRetranscribe) {
      toast.error('Beta feature disabled', {
        description: 'Enable Import Audio & Retranscribe in Settings > Beta to use this feature.',
      });
      return;
    }

    const audioFile = Array.from(files).find((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return !!ext && isAudioExtension(ext);
    });

    if (audioFile) {
      setImportFilePath((audioFile as File & { path?: string }).path || null);
      setShowImportDialog(true);
    } else {
      toast.error('Please drop an audio file', {
        description: `Supported formats: ${getAudioFormatsDisplayList()}`,
      });
    }
  }, []);

  useEffect(() => {
    if (showOnboarding) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (loadBetaFeatures().importAndRetranscribe) setShowDropOverlay(true);
    };
    const onDragLeave = () => setShowDropOverlay(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setShowDropOverlay(false);
      handleFileDrop(event.dataTransfer?.files || null);
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [showOnboarding, handleFileDrop]);

  const handleOpenImportDialog = useCallback((filePath?: string | null) => {
    setImportFilePath(filePath ?? null);
    setShowImportDialog(true);
  }, []);

  const handleImportDialogClose = useCallback((open: boolean) => {
    setShowImportDialog(open);
    if (!open) setImportFilePath(null);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <AnalyticsProvider>
      <RecordingStateProvider>
        <TranscriptProvider>
          <ConfigProvider>
            <OllamaDownloadProvider>
              <OnboardingProvider>
                <UpdateCheckProvider>
                  <SidebarProvider>
                    <TooltipProvider>
                      <RecordingPostProcessingProvider>
                        <ImportDialogProvider onOpen={handleOpenImportDialog}>
                          <DownloadProgressToastProvider />
                          <RecordingProcessingOverlay />
                          {showStartupSplash || isCheckingOnboarding ? (
                            <SplashScreen />
                          ) : showOnboarding ? (
                            <OnboardingFlow onComplete={handleOnboardingComplete} />
                          ) : (
                            <PageShell>
                              <CalendarMeetingReminder />
                              <CurrentRoute />
                            </PageShell>
                          )}
                          <ImportDropOverlay visible={showDropOverlay} />
                          <ConditionalImportDialog
                            showImportDialog={showImportDialog}
                            handleImportDialogClose={handleImportDialogClose}
                            importFilePath={importFilePath}
                          />
                        </ImportDialogProvider>
                      </RecordingPostProcessingProvider>
                    </TooltipProvider>
                  </SidebarProvider>
                </UpdateCheckProvider>
              </OnboardingProvider>
            </OllamaDownloadProvider>
          </ConfigProvider>
        </TranscriptProvider>
      </RecordingStateProvider>
      <Toaster position="bottom-center" richColors closeButton />
    </AnalyticsProvider>
  );
}

export default function App() {
  if (new URLSearchParams(window.location.search).get('window') === 'recording-mini') {
    return <RecordingMiniWindow />;
  }

  return <AppShell />;
}
