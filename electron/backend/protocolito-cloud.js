const fs = require('fs');
const path = require('path');

function trimSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readJsonFile(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cloudConfigCandidates(app) {
  const candidates = [
    process.env.PROTOCOLITO_CLOUD_CONFIG,
    path.join(path.dirname(process.execPath || ''), 'protocolito.cloud.json'),
    path.join(process.resourcesPath || '', 'protocolito.cloud.json'),
    path.join(process.cwd(), 'protocolito.cloud.json'),
  ];

  if (app) {
    candidates.push(path.join(app.getPath('userData'), 'protocolito.cloud.json'));
  }

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'Protocolito', 'protocolito.cloud.json'));
  }

  candidates.push(path.join(__dirname, '..', '..', 'protocolito.cloud.json'));
  candidates.push(path.join(__dirname, '..', '..', '.secrets', 'protocolito.cloud.json'));

  return candidates.filter(Boolean);
}

function readProtocolitoCloudConfig(app) {
  const fromEnv = {
    baseUrl: process.env.PROTOCOLITO_CLOUD_URL || '',
    companyKey: process.env.PROTOCOLITO_COMPANY_KEY || '',
  };

  if (fromEnv.baseUrl && fromEnv.companyKey) {
    return {
      configured: true,
      baseUrl: trimSlash(fromEnv.baseUrl),
      companyKey: fromEnv.companyKey.trim(),
      source: 'env',
    };
  }

  for (const file of cloudConfigCandidates(app)) {
    try {
      const data = readJsonFile(file);
      if (!data) continue;

      const baseUrl = trimSlash(data.baseUrl || data.apiUrl || data.url);
      const companyKey = String(data.companyKey || data.apiKey || data.token || '').trim();
      if (baseUrl && companyKey) {
        return {
          configured: true,
          baseUrl,
          companyKey,
          source: file,
        };
      }
    } catch (error) {
      console.warn(`[Protocolito] Failed to read cloud config ${file}:`, error.message || error);
    }
  }

  return {
    configured: false,
    baseUrl: '',
    companyKey: '',
    source: null,
  };
}

function cloudHeaders(config, json = true) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'x-protocolito-key': config.companyKey,
  };
}

async function callCloudJson({ app, path: apiPath, method = 'GET', body }) {
  const config = readProtocolitoCloudConfig(app);
  if (!config.configured) {
    throw Object.assign(new Error('Protocolito cloud proxy is not configured.'), { code: 'CLOUD_NOT_CONFIGURED' });
  }

  const response = await fetch(`${config.baseUrl}${apiPath}`, {
    method,
    headers: cloudHeaders(config),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    throw new Error(`Protocolito cloud returned ${response.status}: ${data.error || JSON.stringify(data)}`);
  }

  return data;
}

async function getCloudModels(app) {
  return callCloudJson({ app, path: '/v1/models' });
}

async function summarizeWithCloud({ app, text, model, customPrompt, userId }) {
  const data = await callCloudJson({
    app,
    path: '/v1/summarize',
    method: 'POST',
    body: {
      text,
      model,
      prompt: customPrompt || undefined,
      userId: userId || undefined,
    },
  });

  return {
    MeetingName: 'Meeting Summary',
    markdown: data.markdown || '',
    model: data.model || model,
  };
}

async function transcribeWithCloud({ app, audioData, mimeType, fileName, model, userId }) {
  const config = readProtocolitoCloudConfig(app);
  if (!config.configured) {
    throw Object.assign(new Error('Protocolito cloud proxy is not configured.'), { code: 'CLOUD_NOT_CONFIGURED' });
  }

  const buffer = Buffer.isBuffer(audioData)
    ? audioData
    : audioData instanceof ArrayBuffer
      ? Buffer.from(audioData)
      : ArrayBuffer.isView(audioData)
        ? Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength)
        : Array.isArray(audioData)
          ? Buffer.from(audioData)
          : Buffer.alloc(0);

  if (!buffer.length) throw new Error('No audio data was captured.');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/wav' }), fileName || 'recording.wav');
  form.append('model', model || 'whisper-large-v3');
  if (userId) form.append('userId', userId);

  const response = await fetch(`${config.baseUrl}/v1/transcribe`, {
    method: 'POST',
    headers: cloudHeaders(config, false),
    body: form,
  });

  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    throw new Error(`Protocolito cloud returned ${response.status}: ${data.error || JSON.stringify(data)}`);
  }

  return {
    configured: true,
    text: data.text || '',
    model: data.model || model,
    raw: data,
  };
}

module.exports = {
  getCloudModels,
  readProtocolitoCloudConfig,
  summarizeWithCloud,
  transcribeWithCloud,
};
