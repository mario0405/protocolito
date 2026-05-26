import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const port = Number(process.env.PORT || 8080);
const usageDir = path.resolve(process.env.USAGE_DIR || './data');
const usageFile = path.join(usageDir, 'usage.jsonl');

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadCompanies() {
  const raw = process.env.PROTOCOLITO_COMPANIES_JSON || process.env.PROTOCOLITO_COMPANIES_B64 || '[]';
  try {
    const json = process.env.PROTOCOLITO_COMPANIES_B64
      ? Buffer.from(process.env.PROTOCOLITO_COMPANIES_B64, 'base64').toString('utf8')
      : raw;
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return parsed && typeof parsed === 'object' ? [parsed] : [];
  } catch {
    return [];
  }
}

function bearerAuthorization(apiKey) {
  const token = String(apiKey || '').trim();
  if (!token) return null;
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function ownerConfig() {
  return {
    productId: process.env.INFOMANIAK_PRODUCT_ID || '',
    apiKey: process.env.INFOMANIAK_API_KEY || '',
    summaryModels: splitCsv(process.env.INFOMANIAK_SUMMARY_MODELS),
    transcriptionModels: splitCsv(process.env.INFOMANIAK_TRANSCRIPTION_MODELS || 'whisper-large-v3'),
  };
}

function chatEndpoint(productId) {
  return `https://api.infomaniak.com/2/ai/${encodeURIComponent(productId)}/openai/v1/chat/completions`;
}

function transcriptionEndpoint(productId) {
  return `https://api.infomaniak.com/1/ai/${encodeURIComponent(productId)}/openai/audio/transcriptions`;
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authenticate(req, res, next) {
  const key = String(req.header('x-protocolito-key') || '').trim();
  const company = loadCompanies().find((item) => item.enabled !== false && constantTimeEqual(item.apiKey, key));
  if (!company) {
    res.status(401).json({ error: 'Invalid Protocolito company key.' });
    return;
  }

  req.company = company;
  next();
}

function requireOwnerConfig() {
  const config = ownerConfig();
  if (!config.productId || !config.apiKey) {
    throw Object.assign(new Error('Infomaniak owner credentials are not configured.'), { statusCode: 503 });
  }
  return config;
}

function allowedModel(company, type, model) {
  const owner = ownerConfig();
  const key = type === 'summary' ? 'summaryModels' : 'transcriptionModels';
  const companyModels = Array.isArray(company[key]) && company[key].length ? company[key] : owner[key];
  const selected = model || companyModels[0];
  if (!selected || !companyModels.includes(selected)) {
    throw Object.assign(new Error(`Model is not allowed for ${type}.`), { statusCode: 403 });
  }
  return selected;
}

function appendUsage(event) {
  fs.mkdirSync(usageDir, { recursive: true });
  fs.appendFileSync(usageFile, `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`);
}

function publicCompany(company) {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name || company.id,
    plan: company.plan || 'standard',
    enabled: company.enabled !== false,
    monthlySummaryLimit: company.monthlySummaryLimit ?? null,
    monthlyTranscriptionLimit: company.monthlyTranscriptionLimit ?? null,
    summaryModels: company.summaryModels || ownerConfig().summaryModels,
    transcriptionModels: company.transcriptionModels || ownerConfig().transcriptionModels,
  };
}

function requireAdmin(req, res, next) {
  const expected = String(process.env.ADMIN_TOKEN || '').trim();
  const received = String(req.header('x-admin-token') || req.query.adminToken || '').trim();
  if (!expected || !received || !constantTimeEqual(expected, received)) {
    res.status(401).json({ error: 'Invalid admin token.' });
    return;
  }
  next();
}

function readUsageEvents(limit = 200) {
  if (!fs.existsSync(usageFile)) return [];
  const lines = fs.readFileSync(usageFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);
  return lines
    .slice(-Math.max(1, Math.min(Number(limit) || 200, 1000)))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function usageTotals(events) {
  return events.reduce((totals, event) => {
    const companyId = event.companyId || 'unknown';
    const current = totals[companyId] || {
      accessChecks: 0,
      summaries: 0,
      transcriptions: 0,
      inputChars: 0,
      outputChars: 0,
      inputBytes: 0,
      errors: 0,
    };

    if (event.type === 'access_check') current.accessChecks += 1;
    if (event.type === 'summary') current.summaries += 1;
    if (event.type === 'transcription') current.transcriptions += 1;
    if (event.ok === false) current.errors += 1;
    current.inputChars += Number(event.inputChars || 0);
    current.outputChars += Number(event.outputChars || 0);
    current.inputBytes += Number(event.inputBytes || 0);
    totals[companyId] = current;
    return totals;
  }, {});
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin(origin, callback) {
    const allowed = splitCsv(process.env.CORS_ORIGINS || '*');
    if (allowed.includes('*') || !origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Origin not allowed.'));
  },
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'protocolito-cloud-proxy' });
});

app.post('/v1/access/check', authenticate, (req, res) => {
  appendUsage({
    type: 'access_check',
    ok: true,
    companyId: req.company.id,
    action: req.body?.action || 'unknown',
    appVersion: req.body?.appVersion || null,
    deviceId: req.body?.deviceId || null,
  });

  res.json({
    ok: true,
    company: publicCompany(req.company),
  });
});

app.get('/v1/models', authenticate, (req, res) => {
  const owner = ownerConfig();
  res.json({
    companyId: req.company.id,
    summaryModels: req.company.summaryModels || owner.summaryModels,
    transcriptionModels: req.company.transcriptionModels || owner.transcriptionModels,
  });
});

app.post('/v1/summarize', authenticate, asyncHandler(async (req, res) => {
  const owner = requireOwnerConfig();
  const transcript = String(req.body?.text || '').trim();
  if (!transcript) {
    res.status(400).json({ error: 'Missing transcript text.' });
    return;
  }

  const model = allowedModel(req.company, 'summary', req.body?.model);
  const prompt = String(req.body?.prompt || 'Create a concise meeting protocol in Markdown with Summary, Decisions, Action Items, and Next Steps.');
  const response = await fetch(chatEndpoint(owner.productId), {
    method: 'POST',
    headers: {
      Authorization: bearerAuthorization(owner.apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: transcript },
      ],
    }),
  });

  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) {
    res.status(response.status).json({ error: body.error?.message || body.raw || 'Infomaniak summary failed.' });
    return;
  }

  const markdown = body.choices?.[0]?.message?.content || '';
  appendUsage({
    type: 'summary',
    companyId: req.company.id,
    userId: req.body?.userId || null,
    model,
    inputChars: transcript.length,
    outputChars: markdown.length,
  });

  res.json({ markdown, model });
}));

app.post('/v1/transcribe', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  const owner = requireOwnerConfig();
  if (!req.file?.buffer?.length) {
    res.status(400).json({ error: 'Missing audio file.' });
    return;
  }

  const model = allowedModel(req.company, 'transcription', req.body?.model);
  const form = new FormData();
  form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/wav' }), req.file.originalname || 'recording.wav');
  form.append('model', model);
  form.append('response_format', 'json');

  const response = await fetch(transcriptionEndpoint(owner.productId), {
    method: 'POST',
    headers: {
      Authorization: bearerAuthorization(owner.apiKey),
    },
    body: form,
  });

  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) {
    res.status(response.status).json({ error: body.error?.message || body.raw || 'Infomaniak transcription failed.' });
    return;
  }

  const text = body.text || body.transcript || '';
  appendUsage({
    type: 'transcription',
    companyId: req.company.id,
    userId: req.body?.userId || null,
    model,
    inputBytes: req.file.size,
    outputChars: text.length,
  });

  res.json({ text, model });
}));

app.get('/admin/usage', requireAdmin, (req, res) => {
  const events = readUsageEvents(req.query.limit);
  const companies = loadCompanies().map(publicCompany);
  res.json({
    companies,
    totals: usageTotals(events),
    recent: events.reverse(),
  });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  res.status(status).json({ error: status >= 500 ? 'Server error.' : error.message });
});

app.listen(port, () => {
  console.log(`Protocolito cloud proxy listening on ${port}`);
});
