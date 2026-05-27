import { motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen pt-app-bg text-[var(--pt-text-primary)]">
      <Sidebar />
      <motion.main
        layout
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className={cn(
          'min-h-screen',
          isCollapsed ? 'pl-14' : 'pl-60',
        )}
      >
        {children}
      </motion.main>
    </div>
  );
}
