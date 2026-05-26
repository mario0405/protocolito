'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, Bot, Loader2, Search, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from '@/lib/vite-shims/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { askMeetingSearch, MeetingSearchSource } from '@/services/meetingSearchService';
import { useConfig } from '@/contexts/ConfigContext';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MeetingSearchSource[];
}

export default function MeetingSearchPage() {
  const router = useRouter();
  const { t } = useConfig();
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const question = query.trim();
    if (!question || isSearching) return;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };
    setTurns((current) => [...current, userTurn]);
    setQuery('');
    setError(null);
    setIsSearching(true);

    try {
      const result = await askMeetingSearch(question);
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

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-5xl items-center gap-5 px-8 py-5">
          <button
            onClick={() => router.back()}
            className="flex shrink-0 items-center gap-2 text-sm text-stone-600 transition-colors hover:text-stone-950"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('common.back')}
          </button>
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-stone-950">{t('search.title')}</h1>
            <p className="mt-1 text-sm text-stone-600">{t('search.description')}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-8 py-6">
        <div className="flex-1 overflow-y-auto rounded-md border border-stone-200 bg-white">
          {turns.length === 0 ? (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div>
                <Search className="mx-auto h-10 w-10 text-stone-400" />
                <h2 className="mt-4 text-lg font-medium text-stone-950">{t('search.emptyTitle')}</h2>
                <p className="mt-2 max-w-xl text-sm text-stone-600">
                  {t('search.emptyExample')}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {turns.map((turn) => (
                <article key={turn.id} className="grid gap-4 px-6 py-5 md:grid-cols-[36px_1fr]">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md ${turn.role === 'assistant' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>
                    {turn.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="prose prose-stone max-w-none text-sm">
                      {turn.role === 'assistant' ? <ReactMarkdown>{turn.content}</ReactMarkdown> : <p>{turn.content}</p>}
                    </div>
                    {turn.sources && turn.sources.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {turn.sources.map((source) => (
                          <button
                            key={`${turn.id}-${source.sourceId}`}
                            onClick={() => router.push(`/meeting-details?id=${source.meetingId}`)}
                            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-50"
                          >
                            [{source.sourceId}] {source.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {isSearching && (
                <div className="flex items-center gap-3 px-6 py-5 text-sm text-stone-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('search.searching')}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="h-11 bg-white"
          />
          <Button type="submit" disabled={isSearching || !query.trim()} className="h-11 bg-stone-950 hover:bg-stone-800">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t('search.ask')}
          </Button>
        </form>
      </main>
    </div>
  );
}
