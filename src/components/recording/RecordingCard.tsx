import { motion } from 'framer-motion';
import { Mic, Settings } from 'lucide-react';
import { LanguageSelect, TemplateSelect } from '@/components/recording/RecordingSelects';
import { RecordButton } from '@/components/recording/RecordButton';

interface RecordingCardProps {
  title: string;
  description: string;
  languageLabel: string;
  languageValue: string;
  languagePlaceholder: string;
  languageOptions: Array<{ value: string; label: string }>;
  templateLabel: string;
  templateValue: string;
  templatePlaceholder: string;
  templateOptions: Array<{ value: string; label: string }>;
  templateDisabled?: boolean;
  isRecording: boolean;
  startLabel: string;
  stopLabel: string;
  settingsLabel: string;
  onLanguageChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onRecordClick: () => void;
  onSettingsClick: () => void;
}

export function RecordingCard({
  title,
  description,
  languageLabel,
  languageValue,
  languagePlaceholder,
  languageOptions,
  templateLabel,
  templateValue,
  templatePlaceholder,
  templateOptions,
  templateDisabled,
  isRecording,
  startLabel,
  stopLabel,
  settingsLabel,
  onLanguageChange,
  onTemplateChange,
  onRecordClick,
  onSettingsClick,
}: RecordingCardProps) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full max-w-[560px] rounded-2xl border border-[var(--pt-border)] bg-[var(--pt-bg-card)] p-10"
    >
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-4">
          <motion.div
            animate={isRecording ? { scale: 1 } : { scale: [1, 1.035, 1] }}
            transition={isRecording ? { duration: 0.16 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-white"
          >
            <Mic className="h-6 w-6" />
          </motion.div>
          <div className="min-w-0 pt-1">
            <h1 className="text-[22px] font-semibold leading-tight tracking-normal text-[var(--pt-text-primary)]">
              {title}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--pt-text-secondary)]">
              {description}
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <LanguageSelect
            label={languageLabel}
            value={languageValue}
            placeholder={languagePlaceholder}
            options={languageOptions}
            onChange={onLanguageChange}
          />
          <TemplateSelect
            label={templateLabel}
            value={templateValue}
            placeholder={templatePlaceholder}
            options={templateOptions}
            disabled={templateDisabled}
            onChange={onTemplateChange}
          />
        </div>

        <div className="grid gap-3">
          <RecordButton
            isRecording={isRecording}
            startLabel={startLabel}
            stopLabel={stopLabel}
            onClick={onRecordClick}
          />
          <button
            type="button"
            onClick={onSettingsClick}
            className="mx-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--pt-text-secondary)] transition-colors hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]"
          >
            <Settings className="h-4 w-4" />
            {settingsLabel}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
