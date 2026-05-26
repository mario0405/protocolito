const fs = require('fs');
const path = require('path');

function infomaniakChatEndpoint(productId) {
  const id = String(productId || '').trim();
  return id ? `https://api.infomaniak.com/2/ai/${encodeURIComponent(id)}/openai/v1` : null;
}

function infomaniakTranscriptionEndpoint(productId) {
  const id = String(productId || '').trim();
  return id ? `https://api.infomaniak.com/1/ai/${encodeURIComponent(id)}/openai/audio/transcriptions` : null;
}

function uniqueStrings(items) {
  return [...new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function bearerAuthorization(apiKey) {
  const token = String(apiKey || '').trim();
  if (!token) return null;
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function readOwnerInfomaniakConfig() {
  const candidates = [
    process.env.PROTOCOLITO_INFOMANIAK_CONFIG,
    path.join(path.dirname(process.execPath || ''), '..', '..', 'infomaniak.config.json'),
    path.join(path.dirname(process.execPath || ''), 'infomaniak.config.json'),
    path.join(process.resourcesPath || '', 'infomaniak.config.json'),
    path.join(__dirname, '..', '..', 'infomaniak.config.json'),
    path.join(process.cwd(), 'infomaniak.config.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return {
          productId: data.productId || '',
          apiKey: data.apiKey || '',
          transcriptionModels: Array.isArray(data.transcriptionModels)
            ? data.transcriptionModels.join(',')
            : (data.transcriptionModels || ''),
          summaryModels: Array.isArray(data.summaryModels)
            ? data.summaryModels.join(',')
            : (data.summaryModels || ''),
        };
      }
    } catch (error) {
      console.warn(`[Protocolito] Failed to read Infomaniak config file ${file}:`, error);
    }
  }

  return { productId: '', apiKey: '', transcriptionModels: '', summaryModels: '' };
}

function ownerInfomaniakConfig() {
  const fileConfig = readOwnerInfomaniakConfig();
  const transcriptionModels = process.env.PROTOCOLITO_INFOMANIAK_TRANSCRIPTION_MODELS || fileConfig.transcriptionModels;
  const summaryModels = process.env.PROTOCOLITO_INFOMANIAK_SUMMARY_MODELS || fileConfig.summaryModels;

  return {
    productId: process.env.PROTOCOLITO_INFOMANIAK_PRODUCT_ID || fileConfig.productId || '',
    apiKey: process.env.PROTOCOLITO_INFOMANIAK_API_KEY || fileConfig.apiKey || '',
    transcriptionModels: String(transcriptionModels || 'whisper-large-v3')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    summaryModels: String(summaryModels || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

async function listInfomaniakChatModels() {
  const config = ownerInfomaniakConfig();
  const endpoint = infomaniakChatEndpoint(config.productId);
  if (!endpoint || !config.apiKey) return [];

  const response = await fetch(`${endpoint}/models`, {
    headers: {
      Authorization: bearerAuthorization(config.apiKey),
    },
  });

  if (!response.ok) {
    throw new Error(`Infomaniak model list returned ${response.status}`);
  }

  const data = await response.json();
  const entries = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : Array.isArray(data)
        ? data
        : [];

  return uniqueStrings(entries.map((entry) => (
    typeof entry === 'string' ? entry : entry?.id || entry?.name || entry?.model
  )));
}

function bufferFromAudioData(audioData) {
  if (!audioData) return Buffer.alloc(0);
  if (Buffer.isBuffer(audioData)) return audioData;
  if (audioData instanceof ArrayBuffer) return Buffer.from(audioData);
  if (ArrayBuffer.isView(audioData)) return Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
  if (Array.isArray(audioData)) return Buffer.from(audioData);
  throw new Error('Unsupported audio payload format');
}

async function callInfomaniakTranscription({ productId, apiKey, model, audioData, mimeType, fileName }) {
  const endpoint = infomaniakTranscriptionEndpoint(productId);
  if (!endpoint) return { configured: false, text: '' };
  if (!apiKey) throw new Error('Infomaniak API key is missing.');

  const buffer = bufferFromAudioData(audioData);
  if (!buffer.length) throw new Error('No audio data was captured.');

  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });
  form.append('file', blob, fileName || 'recording.wav');
  form.append('model', model || 'whisper-large-v3');
  form.append('response_format', 'json');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: bearerAuthorization(apiKey),
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Infomaniak transcription returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    configured: true,
    text: data.text || data.transcript || '',
    raw: data,
  };
}

module.exports = {
  callInfomaniakTranscription,
  bearerAuthorization,
  infomaniakChatEndpoint,
  infomaniakTranscriptionEndpoint,
  listInfomaniakChatModels,
  ownerInfomaniakConfig,
  uniqueStrings,
};
