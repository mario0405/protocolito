import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LANGUAGES } from '@/constants/languages';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { Copy, GlobeIcon, Mic, Settings } from 'lucide-react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';
import { useMemo } from 'react';
import { useRouter } from '@/lib/vite-shims/navigation';

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
  const showReadyState = !isRecording && !isChecking && segments.length === 0 && !error;
  const selectedLanguageName = LANGUAGES.find(language => language.code === selectedLanguage)?.name || selectedLanguage;

  return (
    <div ref={transcriptContainerRef} className="w-full border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
      {/* Title area - Sticky header */}
      <div className="sticky top-0 z-10 bg-white p-4 border-gray-200">
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

      {showReadyState && (
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-2xl border border-stone-100 bg-white px-8 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-950 text-white shadow-sm">
                <Mic className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-normal text-stone-950">{t('home.ready')}</h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">{t('home.readyDescription')}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-5">
              <div className="grid gap-2">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                  {t('home.meetingLanguage')}
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/70 px-4 shadow-none">
                    <SelectValue placeholder={selectedLanguageName} />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(language => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                  {t('home.protocolTemplate')}
                </Label>
                <Select
                  value={templates.selectedTemplate}
                  onValueChange={(templateId) => {
                    const template = templates.availableTemplates.find(item => item.id === templateId);
                    templates.handleTemplateSelection(templateId, template?.name || templateId);
                  }}
                  disabled={templates.availableTemplates.length === 0}
                >
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/70 px-4 shadow-none">
                    <SelectValue placeholder={t('home.protocolTemplate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.availableTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/settings')}
                className="h-10 justify-center gap-2 rounded-xl px-4 text-stone-600 hover:bg-stone-100 hover:text-stone-950"
              >
                <Settings className="h-4 w-4" />
                {t('common.settings')}
              </Button>
              <Button
                size="lg"
                onClick={() => window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'))}
                className="h-12 justify-center gap-2 rounded-xl bg-stone-950 px-6 text-white shadow-sm hover:bg-stone-800 sm:min-w-48"
              >
                <Mic className="h-4 w-4" />
                {t('home.startRecording')}
              </Button>
            </div>
          </div>
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
