export function modelHint(model: string, t?: (key: string) => string) {
  const normalized = model.toLowerCase();
  const defaults: Record<string, string> = {
    'modelHint.transcription': 'Transcription',
    'modelHint.longMeetings': 'Long meetings',
    'modelHint.fastDrafts': 'Fast drafts',
    'modelHint.balanced': 'Balanced',
    'modelHint.quickSummaries': 'Quick summaries',
    'modelHint.longContext': 'Long context',
    'modelHint.structuredNotes': 'Structured notes',
    'modelHint.fastLocal': 'Fast local',
    'modelHint.highAccuracy': 'High accuracy',
    'modelHint.fastAccurate': 'Fast accurate',
    'modelHint.lightweight': 'Lightweight',
    'modelHint.generalUse': 'General use',
  };
  const label = (key: string) => (t ? t(key) : defaults[key] || key);

  if (normalized.includes('whisper')) return label('modelHint.transcription');
  if (normalized.includes('qwen')) return label('modelHint.longMeetings');
  if (normalized.includes('gemma')) return label('modelHint.fastDrafts');
  if (normalized.includes('mistral')) return label('modelHint.balanced');
  if (normalized.includes('ministral')) return label('modelHint.quickSummaries');
  if (normalized.includes('kimi')) return label('modelHint.longContext');
  if (normalized.includes('nemotron')) return label('modelHint.structuredNotes');
  if (normalized.includes('parakeet')) return label('modelHint.fastLocal');
  if (normalized.includes('large')) return label('modelHint.highAccuracy');
  if (normalized.includes('turbo')) return label('modelHint.fastAccurate');
  if (normalized.includes('small')) return label('modelHint.lightweight');

  return label('modelHint.generalUse');
}
