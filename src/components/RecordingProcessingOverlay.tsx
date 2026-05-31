'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Save, Sparkles, Waves } from 'lucide-react';
import { RecordingStatus, useRecordingState } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';
import { cn } from '@/lib/utils';

type OverlayPhase = {
  title: string;
  description: string;
  label: string;
  icon: typeof Waves;
};

const PROCESSING_STATUSES = new Set<RecordingStatus>([
  RecordingStatus.STOPPING,
  RecordingStatus.PROCESSING_TRANSCRIPTS,
  RecordingStatus.SAVING,
]);

function getPreviewStatus(): RecordingStatus | null {
  if (!(import.meta as any).env?.DEV || typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('processingPreview');
  if (value === 'stopping') return RecordingStatus.STOPPING;
  if (value === 'saving') return RecordingStatus.SAVING;
  if (value === 'processing') return RecordingStatus.PROCESSING_TRANSCRIPTS;
  return null;
}

export function RecordingProcessingOverlay() {
  const { status, statusMessage } = useRecordingState();
  const { t } = useConfig();
  const previewStatus = getPreviewStatus();
  const activeStatus = previewStatus || status;
  const isVisible = PROCESSING_STATUSES.has(activeStatus);

  const phaseMap: Record<RecordingStatus.STOPPING | RecordingStatus.PROCESSING_TRANSCRIPTS | RecordingStatus.SAVING, OverlayPhase> = {
    [RecordingStatus.STOPPING]: {
      title: t('recording.processingOverlayStoppingTitle'),
      description: t('recording.processingOverlayStoppingDescription'),
      label: t('recording.processingOverlayStoppingLabel'),
      icon: Waves,
    },
    [RecordingStatus.PROCESSING_TRANSCRIPTS]: {
      title: t('recording.processingOverlayTranscriptTitle'),
      description: t('recording.processingOverlayTranscriptDescription'),
      label: statusMessage || t('recording.processingOverlayTranscriptLabel'),
      icon: Sparkles,
    },
    [RecordingStatus.SAVING]: {
      title: t('recording.processingOverlaySavingTitle'),
      description: t('recording.processingOverlaySavingDescription'),
      label: statusMessage || t('recording.processingOverlaySavingLabel'),
      icon: Save,
    },
  };

  const phase = phaseMap[activeStatus as keyof typeof phaseMap];
  if (!phase) return null;

  const PhaseIcon = phase.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(248,248,247,0.76)] px-6 backdrop-blur-xl dark:bg-[rgba(15,15,18,0.76)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-black/10 bg-white/90 p-7 text-center shadow-[0_24px_80px_rgba(18,18,23,0.18)] dark:border-white/10 dark:bg-[#17171b]/92"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-[0_18px_42px_rgba(239,68,68,0.28)]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.3, repeat: Infinity, ease: 'linear' }}
                className="absolute h-20 w-20 rounded-full border border-white/35 border-t-white"
              />
              <PhaseIcon className="relative h-8 w-8" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-orange-300">
                {phase.label}
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-gray-950 dark:text-white">
                {phase.title}
              </h2>
              <p className="mx-auto max-w-[320px] text-sm leading-6 text-gray-600 dark:text-gray-300">
                {phase.description}
              </p>
            </div>

            <div className="mt-7 flex items-center justify-center gap-2">
              {[0, 1, 2].map((index) => (
                <motion.span
                  key={index}
                  className={cn('h-2 w-2 rounded-full bg-red-500/80', index === 1 && 'bg-orange-500', index === 2 && 'bg-red-400')}
                  animate={{ opacity: [0.35, 1, 0.35], y: [0, -4, 0] }}
                  transition={{ duration: 0.95, repeat: Infinity, delay: index * 0.14, ease: 'easeInOut' }}
                />
              ))}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-gray-100 px-2 py-1.5 dark:bg-white/8">
                <Check className="h-3 w-3 text-green-600" />
                {t('recording.processingOverlayStepRecord')}
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-red-50 px-2 py-1.5 text-red-700 dark:bg-red-500/12 dark:text-orange-200">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('recording.processingOverlayStepProcess')}
              </div>
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-gray-100 px-2 py-1.5 dark:bg-white/8">
                {t('recording.processingOverlayStepSave')}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
