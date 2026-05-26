import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';
import {
  deleteOfflineQueueItem,
  listOfflineQueue,
  OfflineQueueItem,
  retryOfflineQueueItem,
} from '@/services/offlineQueueService';

export function OfflineQueueSettings() {
  const { t } = useConfig();
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);

  const refreshOfflineQueue = async () => {
    setOfflineQueue(await listOfflineQueue());
  };

  useEffect(() => {
    refreshOfflineQueue();
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">{t('offline.title')}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {t('offline.description')}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {(offlineQueue.length === 1 ? t('offline.queuedCount') : t('offline.queuedCountPlural')).replace('{count}', String(offlineQueue.length))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshOfflineQueue}>
              <RefreshCw className="h-4 w-4" />
              {t('common.refresh')}
            </Button>
          </div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {offlineQueue.length === 0 ? (
              <div className="py-3 text-sm text-gray-500">{t('offline.empty')}</div>
            ) : offlineQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-500">
                    {item.status} · {item.transcriptCount} {t('offline.transcriptSegments')} · {new Date(item.createdAt).toLocaleString()}
                  </div>
                  {item.error && <div className="mt-1 text-xs text-red-700">{item.error}</div>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={async () => {
                    await retryOfflineQueueItem(item.id);
                    await refreshOfflineQueue();
                    toast.success(t('offline.synced'));
                  }}>
                    {t('common.retry')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={async () => {
                    await deleteOfflineQueueItem(item.id);
                    await refreshOfflineQueue();
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
