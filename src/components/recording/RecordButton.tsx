import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrimaryActionButton } from '@/components/ui/protocolito-surface';

interface RecordButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  startLabel: string;
  stopLabel: string;
  onClick: () => void;
}

export function RecordButton({ isRecording, disabled, startLabel, stopLabel, onClick }: RecordButtonProps) {
  return (
    <PrimaryActionButton
      layout
      tone={isRecording ? 'neutral' : 'brand'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl',
        isRecording && 'pt-coral-glow',
      )}
    >
      {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <motion.span layout>{isRecording ? stopLabel : startLabel}</motion.span>
    </PrimaryActionButton>
  );
}
