import { Label } from '@/components/ui/label';

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
  return (
    <div className={`space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 ${className}`}>
      <div>
        {title && <h4 className="text-sm font-semibold text-emerald-950">{title}</h4>}
        <p className="mt-1 text-xs text-emerald-900">{description}</p>
        {configured && (
          <p className="mt-2 text-xs text-emerald-800">
            {models.length === 1
              ? 'Protocolito Cloud currently exposes 1 model for this company. Add more models on the server to show them here.'
              : `${models.length} Protocolito Cloud models available.`}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium text-emerald-900">{label}</Label>
        {models.length > 0 ? (
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          >
            {models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder={placeholder}
          />
        )}
      </div>

      {!configured && (
        <p className="text-xs text-amber-800">
          Protocolito Cloud is not configured on this device yet.
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
