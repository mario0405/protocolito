import { Check, ChevronDown } from 'lucide-react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface RecordingSelectProps {
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

function RecordingSelect({ label, value, placeholder, options, disabled, onChange }: RecordingSelectProps) {
  return (
    <div className="grid gap-2">
      <label className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--pt-text-muted)]">
        {label}
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-12 w-full items-center justify-between rounded-xl border border-[var(--pt-border)]',
            'bg-[var(--pt-bg-glass)] px-4 text-left text-sm font-medium text-[var(--pt-text-primary)] backdrop-blur',
            'pt-focus-ring transition-colors hover:border-[var(--pt-border-strong)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4 text-[var(--pt-text-muted)]" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={8}
            className="pt-elevated z-[80] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl p-1 text-[var(--pt-text-primary)]"
          >
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
              <SelectPrimitive.Viewport>
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-default select-none items-center rounded-lg px-3 py-2 text-sm outline-none hover:bg-[var(--pt-bg-secondary)] focus:bg-[var(--pt-bg-secondary)]"
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="ml-auto">
                      <Check className="h-4 w-4 text-[var(--pt-brand)]" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
            </motion.div>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

export function LanguageSelect(props: RecordingSelectProps) {
  return <RecordingSelect {...props} />;
}

export function TemplateSelect(props: RecordingSelectProps) {
  return <RecordingSelect {...props} />;
}
