import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  startLabel: string;
  stopLabel: string;
  onClick: () => void;
}

export function RecordButton({ isRecording, disabled, startLabel, stopLabel, onClick }: RecordButtonProps) {
  return (
    <motion.button
      type="button"
      layout
      whileHover={disabled ? undefined : { filter: 'brightness(1.06)' }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        isRecording ? 'bg-stone-950 hover:bg-stone-900' : 'bg-[var(--pt-brand)] hover:bg-[var(--pt-brand-strong)]',
      )}
    >
      {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <motion.span layout>{isRecording ? stopLabel : startLabel}</motion.span>
    </motion.button>
  );
}
