const BUILTIN_MODELS = [
  {
    name: 'gemma3:1b',
    display_name: 'Gemma 3 1B',
    size: 0,
    status: { type: 'ready' },
    description: 'Small local summary model placeholder for Electron builds.',
  },
];

async function listOllamaModels(endpoint) {
  try {
    const base = (endpoint || 'http://localhost:11434').replace(/\/+$/, '');
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((model) => ({
      name: model.name,
      model: model.model || model.name,
      size: model.size,
      modified_at: model.modified_at,
    }));
  } catch {
    return [];
  }
}

function builtinModels() {
  return BUILTIN_MODELS;
}

module.exports = { listOllamaModels, builtinModels };
