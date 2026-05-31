const { listLocalLlmModels } = require('./local-llm');

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

function builtinModels(app) {
  return listLocalLlmModels(app);
}

module.exports = { listOllamaModels, builtinModels };
