import { HTMLMotionProps, motion } from 'framer-motion';
import type { HTMLAttributes, TextareaHTMLAttributes } from 'react';
import TextareaAutosize, { TextareaAutosizeProps } from 'react-textarea-autosize';
import { cn } from '@/lib/utils';

type SurfaceVariant = 'glass' | 'panel' | 'elevated';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

export function GlassPanel({ className, variant = 'panel', ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        variant === 'glass' && 'pt-glass',
        variant === 'panel' && 'pt-panel',
        variant === 'elevated' && 'pt-elevated',
        className,
      )}
      {...props}
    />
  );
}

interface PrimaryActionButtonProps extends HTMLMotionProps<'button'> {
  tone?: 'brand' | 'neutral';
}

export function PrimaryActionButton({ className, tone = 'brand', disabled, ...props }: PrimaryActionButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -1, filter: 'brightness(1.04)' }}
      whileTap={disabled ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      disabled={disabled}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 pt-focus-ring',
        tone === 'brand'
          ? 'bg-[var(--pt-brand)] text-white hover:bg-[var(--pt-brand-strong)] pt-coral-glow'
          : 'bg-stone-950 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200',
        className,
      )}
      {...props}
    />
  );
}

export function CommandTextarea({ className, ...props }: TextareaAutosizeProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <TextareaAutosize
      className={cn(
        'min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 text-[var(--pt-text-primary)] outline-none placeholder:text-[var(--pt-text-muted)]',
        className,
      )}
      {...props}
    />
  );
}
