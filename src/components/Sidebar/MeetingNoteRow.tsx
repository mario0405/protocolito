import { File, Pencil, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MeetingNoteRowProps {
  title: string;
  active?: boolean;
  isMeeting?: boolean;
  dateLabel?: string;
  depth?: number;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel: string;
  deleteLabel: string;
}

export function MeetingNoteRow({
  title,
  active,
  isMeeting,
  dateLabel,
  depth = 0,
  onOpen,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: MeetingNoteRowProps) {
  const Icon = isMeeting ? File : Plus;

  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, x: -6 },
        visible: { opacity: 1, x: 0 },
      }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className={cn(
        'group my-0.5 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-[var(--pt-text-secondary)] transition-colors hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]',
        active && 'bg-[var(--pt-bg-secondary)] font-medium text-[var(--pt-text-primary)]',
      )}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
    >
      <div className="mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--pt-bg-secondary)]">
        <Icon className="h-3.5 w-3.5 text-stone-400" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate">{title}</div>
        {dateLabel && <div className="truncate text-[11px] font-medium text-stone-500">{dateLabel}</div>}
      </div>

      {isMeeting && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.();
            }}
            className="rounded-md p-1 text-[var(--pt-text-muted)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]"
            aria-label={editLabel}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.();
            }}
            className="rounded-md p-1 text-[var(--pt-text-muted)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-brand)]"
            aria-label={deleteLabel}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
