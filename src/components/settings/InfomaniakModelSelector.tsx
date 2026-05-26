import { Label } from '@/components/ui/label';
import { modelHint } from '@/lib/modelHints';
import { useConfig } from '@/contexts/ConfigContext';

interface InfomaniakModelSelectorProps {
  className?: string;
  title?: string;
  description: string;
  label: string;
  models: string[];
  value: string;
  configured: boolean;
  placeholder: string;
  actionLabel: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function InfomaniakModelSelector({
  className = '',
  title,
  description,
  label,
  models,
  value,
  configured,
  placeholder,
  actionLabel,
  onChange,
  onSave,
}: InfomaniakModelSelectorProps) {
  const { t } = useConfig();

  return (
    <div className={`space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-gray-700 dark:bg-[#151821] ${className}`}>
      <div>
        {title && <h4 className="text-sm font-semibold text-emerald-950 dark:text-white">{title}</h4>}
        <p className="mt-1 text-xs text-emerald-900 dark:text-gray-100">{description}</p>
        {configured && (
          <p className="mt-2 text-xs text-emerald-800 dark:text-gray-300">
            {models.length === 1
              ? t('cloud.oneModel')
              : t('cloud.modelsAvailable').replace('{count}', String(models.length))}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-emerald-900 dark:text-white">{label}</Label>
        {models.length > 0 ? (
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-[#0f1115] dark:text-white"
          >
            {models.map((model) => (
              <option key={model} value={model}>{model} - {modelHint(model, t)}</option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-[#0f1115] dark:text-white"
            placeholder={placeholder}
          />
        )}
      </div>

      {!configured && (
        <p className="text-xs text-amber-800 dark:text-amber-100">
          {t('cloud.notConfigured')}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!value.trim() || !configured}
        className="rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}
