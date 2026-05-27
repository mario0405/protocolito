'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FileText, Loader2, Search, Send, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from '@/lib/vite-shims/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CommandTextarea, GlassPanel } from '@/components/ui/protocolito-surface';
import { askMeetingSearch, MeetingSearchSource } from '@/services/meetingSearchService';
import { useConfig } from '@/contexts/ConfigContext';
import { cn } from '@/lib/utils';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MeetingSearchSource[];
}

const SUGGESTIONS = [
  'What did we decide in the last standup?',
  'Show all open action items',
  'Who mentioned the Q3 deadline?',
  "Summarize last week's meetings",
  'Which decisions still need follow-up?',
  'What did Max say at the end of May?',
];

export default function MeetingSearchPage() {
  const router = useRouter();
  const { t } = useConfig();
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns, isSearching, error]);

  const askQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isSearching) return;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setTurns((current) => [...current, userTurn]);
    setQuery('');
    setError(null);
    setIsSearching(true);

    try {
      const result = await askMeetingSearch(trimmed);
      setTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.answer || t('search.noAnswer'),
          sources: result.sources,
        },
      ]);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    askQuestion(query);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askQuestion(query);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col pt-app-bg text-[var(--pt-text-primary)]">
        <header className="pt-glass h-10 shrink-0 border-x-0 border-t-0">
          <div className="mx-auto flex h-full max-w-[720px] items-center justify-between px-12">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--pt-text-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--pt-brand)]" />
              Meeting AI
            </div>
            <div className="text-xs text-[var(--pt-text-muted)]">Sources from saved meetings</div>
          </div>
        </header>

        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-12">
          <div className="mx-auto flex min-h-full max-w-[720px] flex-col pb-36 pt-10">
            <AnimatePresence mode="popLayout">
              {turns.length === 0 ? (
                <motion.section
                  key="empty-state"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex flex-1 items-center justify-center text-center"
                >
                  <div className="max-w-2xl">
                    <motion.div
                      initial={{ scale: 0.94, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="pt-glass mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-[var(--pt-brand)]"
                    >
                      <Search className="h-4 w-4" />
                    </motion.div>
                    <h1 className="mt-4 text-[22px] font-semibold tracking-normal text-[var(--pt-text-primary)]">
                      {t('search.emptyTitle')}
                    </h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--pt-text-secondary)]">
                      {t('search.description')}
                    </p>
                    <motion.div
                      className="mt-7 flex flex-wrap justify-center gap-2"
                      variants={{
                        visible: { transition: { staggerChildren: 0.03 } },
                      }}
                      initial="hidden"
                      animate="visible"
                    >
                      {SUGGESTIONS.map((suggestion) => (
                        <motion.button
                          key={suggestion}
                          type="button"
                          variants={{
                            hidden: { opacity: 0, y: 8 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => askQuestion(suggestion)}
                          className="pt-glass rounded-full px-3.5 py-2 text-sm text-[var(--pt-text-secondary)] transition-colors hover:border-[var(--pt-border-strong)] hover:bg-[var(--pt-bg-elevated)] hover:text-[var(--pt-text-primary)]"
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </motion.div>
                  </div>
                </motion.section>
              ) : (
                <motion.div
                  key="messages"
                  className="space-y-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16 }}
                >
                  {turns.map((turn) => (
                    <motion.article
                      key={turn.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={cn('grid gap-4 md:grid-cols-[32px_1fr]', turn.role === 'user' && 'md:grid-cols-[1fr_32px]')}
                    >
                      {turn.role === 'assistant' && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-950 text-white dark:bg-white dark:text-stone-950">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={cn(
                          'min-w-0 text-sm leading-6',
                          turn.role === 'user'
                            ? 'pt-glass rounded-2xl px-4 py-3 text-[var(--pt-text-primary)] md:col-start-1'
                            : 'text-[var(--pt-text-primary)]',
                        )}
                      >
                        {turn.role === 'assistant' ? (
                          <div className="prose prose-stone max-w-none text-sm leading-6 dark:prose-invert">
                            <ReactMarkdown>{turn.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{turn.content}</p>
                        )}

                        {turn.sources && turn.sources.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {turn.sources.map((source) => (
                              <button
                                key={`${turn.id}-${source.sourceId}`}
                                type="button"
                                onClick={() => router.push(`/meeting-details?id=${source.meetingId}`)}
                                className="pt-glass inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--pt-text-secondary)] transition-colors hover:border-[var(--pt-brand)]/40 hover:text-[var(--pt-text-primary)]"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="shrink-0">[{source.sourceId}]</span>
                                <span className="truncate">{source.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {turn.role === 'user' && (
                        <div className="pt-glass flex h-8 w-8 items-center justify-center rounded-xl text-[var(--pt-text-secondary)] md:col-start-2 md:row-start-1">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </motion.article>
                  ))}

                  {isSearching && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-4 md:grid-cols-[32px_1fr]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-950 text-white dark:bg-white dark:text-stone-950">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-3 text-sm text-[var(--pt-text-secondary)]">
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--pt-brand)]" />
                        {t('search.searching')}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <div className="pt-glass shrink-0 border-x-0 border-b-0 px-12 py-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-[720px]">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
              >
                {error}
              </motion.div>
            )}
            <GlassPanel variant="glass" className="flex items-end gap-2 rounded-2xl p-2">
              <CommandTextarea
                value={query}
                minRows={1}
                maxRows={6}
                onKeyDown={handleKeyDown}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('search.placeholder')}
                className="max-h-40"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: query.trim() && !isSearching ? 1.03 : 1 }}
                    whileTap={{ scale: query.trim() && !isSearching ? 0.97 : 1 }}
                    disabled={isSearching || !query.trim()}
                    aria-label={t('search.ask')}
                    className="pt-coral-glow mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pt-brand)] text-white transition-colors hover:bg-[var(--pt-brand-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent>{t('search.ask')}</TooltipContent>
              </Tooltip>
            </GlassPanel>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--pt-text-muted)]">
              <span>Ask across transcripts, summaries, tasks, dates, and people.</span>
              <span>Enter to send · Shift Enter for newline</span>
            </div>
          </form>
        </div>
      </div>
    </TooltipProvider>
  );
}
