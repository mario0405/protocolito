import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useConfig } from '@/contexts/ConfigContext';

interface SummaryStatusPanelProps {
  status: 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';
  error: string | null;
}

export function SummaryStatusPanel({ status, error }: SummaryStatusPanelProps) {
  const { t } = useConfig();

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center mb-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-red-700 font-medium">{t('summary.errorTitle')}</h3>
        </div>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="text-red-500 text-xs mt-2">{t('summary.errorHelp')}</p>
      </div>
    );
  }

  if (status !== 'processing' && status !== 'summarizing' && status !== 'regenerating') {
    return null;
  }

  return (
    <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
        <div>
          <h3 className="text-blue-700 font-medium">
            {status === 'processing' ? t('summary.processingTranscript') : t('summary.generatingSummary')}
          </h3>
          <p className="text-blue-600 text-sm">
            {status === 'processing'
              ? t('summary.analyzingTranscript')
              : t('summary.creatingDetailed')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyCompletedSummary() {
  const { t } = useConfig();

  return (
    <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
      <p className="text-gray-600">{t('summary.emptyContent')}</p>
      <p className="text-gray-500 text-sm mt-1">{t('summary.tryGenerating')}</p>
    </div>
  );
}
