import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  prominent?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}

export function SidebarItem({
  icon: Icon,
  label,
  active,
  prominent,
  disabled,
  collapsed,
  onClick,
}: SidebarItemProps) {
  const button = (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: prominent ? 1.03 : 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-colors',
        collapsed ? 'h-10 w-10' : 'h-10 w-full justify-start gap-2 px-3 text-sm font-medium',
        prominent
          ? 'bg-[var(--pt-brand)] text-white hover:bg-[var(--pt-brand-strong)] pt-coral-glow'
          : 'text-[var(--pt-text-secondary)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]',
        active && !prominent && 'bg-[var(--pt-bg-secondary)] text-[var(--pt-text-primary)]',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      <Icon className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
      {!collapsed && <span className="truncate">{label}</span>}
    </motion.button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
