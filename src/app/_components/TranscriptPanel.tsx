import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { LANGUAGES } from '@/constants/languages';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { Copy, GlobeIcon } from 'lucide-react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';
import { useMemo } from 'react';
import { useRouter } from '@/lib/vite-shims/navigation';
import { RecordingCard } from '@/components/recording/RecordingCard';

/**
 * TranscriptPanel Component
 *
 * Displays transcript content with controls for copying and language settings.
 * Uses TranscriptContext, ConfigContext, and RecordingStateContext internally.
 */

interface TranscriptPanelProps {
  // indicates stop-processing state for transcripts; derived from backend statuses.
  isProcessingStop: boolean;
  isStopping: boolean;
  showModal: (name: ModalType, message?: string) => void;
}

export function TranscriptPanel({
  isProcessingStop,
  isStopping,
  showModal
}: TranscriptPanelProps) {
  // Contexts
  const { transcripts, transcriptContainerRef, copyTranscript } = useTranscripts();
  const { transcriptModelConfig, selectedLanguage, setSelectedLanguage, t } = useConfig();
  const { isRecording, isPaused } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone, error } = usePermissionCheck();
  const isLinux = useIsLinux();
  const router = useRouter();
  const templates = useTemplates();

  // Convert transcripts to segments for virtualized view
  const segments = useMemo(() =>
    transcripts.map(t => ({
      id: t.id,
      timestamp: t.audio_start_time ?? 0,
      endTime: t.audio_end_time,
      text: t.text,
      confidence: t.confidence,
    })),
    [transcripts]
  );
  const showRecordingCard = !isChecking && segments.length === 0 && !error;
  const selectedLanguageName = LANGUAGES.find(language => language.code === selectedLanguage)?.name || selectedLanguage;

  return (
    <div ref={transcriptContainerRef} className="flex h-screen w-full flex-col overflow-y-auto bg-[var(--pt-bg-primary)]">
      {/* Title area - Sticky header */}
      <div className="sticky top-0 z-10 bg-[var(--pt-bg-primary)] p-4">
        <div className="flex flex-col space-y-3">
          <div className="flex  flex-col space-y-2">
            <div className="flex justify-center  items-center space-x-2">
              <ButtonGroup>
                {transcripts?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTranscript}
                    title={t('meeting.copyTranscript')}
                  >
                    <Copy />
                    <span className='hidden md:inline'>
                      {t('common.copy')}
                    </span>
                  </Button>
                )}
                {transcriptModelConfig.provider === "localWhisper" &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showModal('languageSettings')}
                    title={t('transcription.language')}
                  >
                    <GlobeIcon />
                    <span className='hidden md:inline'>
                      {t('transcription.language')}
                    </span>
                  </Button>
                }
              </ButtonGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Warning - Not needed on Linux */}
      {!isRecording && isChecking && !isLinux && (
        <div className="flex justify-center px-4 pt-8">
          <div className="w-full max-w-md rounded-md border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-sm font-medium text-stone-900">{t('home.checkingAudioTitle')}</p>
            <p className="mt-1 text-xs text-stone-600">{t('home.checkingAudioDescription')}</p>
          </div>
        </div>
      )}

      {!isRecording && !isChecking && error && !isLinux && (
        <div className="flex justify-center px-4 pt-8">
          <div className="w-full max-w-md rounded-md border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm font-medium text-amber-950">{t('meeting.audioCheckAttention')}</p>
            <p className="mt-1 text-xs text-amber-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={checkPermissions}>
              {t('meeting.recheckDevices')}
            </Button>
          </div>
        </div>
      )}

      {!isRecording && !isChecking && !isLinux && (
        <div className="flex justify-center px-4 pt-4">
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={checkPermissions}
            isRechecking={isChecking}
          />
        </div>
      )}

      {showRecordingCard && (
        <div className="flex flex-1 items-center justify-center px-8 py-16">
          <RecordingCard
            title={isRecording ? t('sidebar.recordingInProgress') : t('home.ready')}
            description={isRecording ? 'Protocolito is listening and transcribing this meeting.' : t('home.readyDescription')}
            languageLabel={t('home.meetingLanguage')}
            languageValue={selectedLanguage}
            languagePlaceholder={selectedLanguageName}
            languageOptions={LANGUAGES.map(language => ({ value: language.code, label: language.name }))}
            templateLabel={t('home.protocolTemplate')}
            templateValue={templates.selectedTemplate}
            templatePlaceholder={t('home.protocolTemplate')}
            templateOptions={templates.availableTemplates.map(template => ({ value: template.id, label: template.name }))}
            templateDisabled={templates.availableTemplates.length === 0}
            isRecording={isRecording}
            startLabel={t('home.startRecording')}
            stopLabel={t('recording.stop')}
            settingsLabel={t('common.settings')}
            onLanguageChange={setSelectedLanguage}
            onTemplateChange={(templateId) => {
              const template = templates.availableTemplates.find(item => item.id === templateId);
              templates.handleTemplateSelection(templateId, template?.name || templateId);
            }}
            onRecordClick={() => {
              window.dispatchEvent(new CustomEvent(isRecording ? 'stop-recording-from-card' : 'start-recording-from-sidebar'));
            }}
            onSettingsClick={() => router.push('/settings')}
          />
        </div>
      )}

      {/* Transcript content */}
      {(isRecording || segments.length > 0) && (
      <div className="pb-20">
        <div className="flex justify-center">
          <div className="w-2/3 max-w-[750px]">
            <VirtualizedTranscriptView
              segments={segments}
              isRecording={isRecording}
              isPaused={isPaused}
              isProcessing={isProcessingStop}
              isStopping={isStopping}
              enableStreaming={isRecording}
              showConfidence={true}
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
