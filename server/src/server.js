import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import cors from 'cors';
import { Composio } from '@composio/core';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const port = Number(process.env.PORT || 8080);
const usageDir = path.resolve(process.env.USAGE_DIR || './data');
const usageFile = path.join(usageDir, 'usage.jsonl');
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120);
const maxSummaryChars = Number(process.env.MAX_SUMMARY_CHARS || 200_000);
const maxPromptChars = Number(process.env.MAX_PROMPT_CHARS || 8_000);
const rateLimitBuckets = new Map();

const integrationDefaults = {
  notion: {
    label: 'Notion',
    toolkit: 'notion',
    authConfigId: 'ac_S9kwK2CjmEEr',
    toolSlug: 'NOTION_CREATE_NOTION_PAGE',
  },
  asana: {
    label: 'Asana',
    toolkit: 'asana',
    authConfigId: 'ac_ryG_8_hkmxMc',
    toolSlug: 'ASANA_CREATE_A_TASK',
  },
  'google-docs': {
    label: 'Google Docs',
    toolkit: 'googledocs',
    authConfigId: 'ac_wKi1dD1vP2FD',
    toolSlug: 'GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN',
  },
  slack: {
    label: 'Slack',
    toolkit: 'slack',
    authConfigId: 'ac_uab06y7ctK1H',
    toolSlug: 'SLACK_SEND_MESSAGE',
  },
  teams: {
    label: 'Microsoft Teams',
    toolkit: 'microsoft_teams',
    authConfigId: 'ac_JTH3Lz65MbLs',
    toolSlug: 'MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE',
  },
  jira: {
    label: 'Jira',
    toolkit: 'jira',
    authConfigId: 'ac_QF3v5Y6diH25',
    toolSlug: 'JIRA_CREATE_ISSUE',
  },
  monday: {
    label: 'Monday.com',
    toolkit: 'monday',
    authConfigId: 'ac_drgRSeCidLQ7',
    toolSlug: 'MONDAY_CREATE_ITEM',
  },
  hubspot: {
    label: 'HubSpot',
    toolkit: 'hubspot',
    authConfigId: 'ac_AwOmyrA1i_oi',
    toolSlug: 'HUBSPOT_CREATE_NOTE',
  },
  salesforce: {
    label: 'Salesforce',
    toolkit: 'salesforce',
    authConfigId: 'ac_jMie8BCNSwfx',
    toolSlug: 'SALESFORCE_CREATE_NOTE',
  },
};

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

function loadIntegrationOverrides() {
  const raw = process.env.COMPOSIO_INTEGRATIONS_JSON || '{}';
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function envName(provider, suffix) {
  return `COMPOSIO_${provider.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_${suffix}`;
}

function integrationConfigs() {
  const overrides = loadIntegrationOverrides();
  return Object.entries(integrationDefaults).reduce((configs, [provider, base]) => {
    const override = overrides[provider] || {};
    configs[provider] = {
      ...base,
      ...override,
      authConfigId: process.env[envName(provider, 'AUTH_CONFIG_ID')] || override.authConfigId || base.authConfigId,
      toolSlug: process.env[envName(provider, 'TOOL_SLUG')] || override.toolSlug || base.toolSlug,
    };
    return configs;
  }, {});
}

function composioClient() {
  const apiKey = String(process.env.COMPOSIO_API_KEY || '').trim();
  if (!apiKey) {
    throw Object.assign(new Error('Composio API key is not configured on the server.'), { statusCode: 503 });
  }

  return new Composio({
    apiKey,
    baseURL: process.env.COMPOSIO_BASE_URL || undefined,
    allowTracking: false,
    disableVersionCheck: true,
    host: 'protocolito-cloud-proxy',
  });
}

function integrationUserId(company, body = {}) {
  const subject = usageSubject(body) || body.email || body.userId || body.deviceId || 'default';
  return `${company.id}:${String(subject).trim().slice(0, 180)}`;
}

function getIntegrationConfig(provider) {
  const config = integrationConfigs()[provider];
  if (!config) {
    throw Object.assign(new Error('Unsupported integration provider.'), { statusCode: 400 });
  }
  if (!config.authConfigId) {
    throw Object.assign(new Error(`Composio auth config is missing for ${provider}.`), { statusCode: 503 });
  }
  if (!config.toolSlug) {
    throw Object.assign(new Error(`Composio tool slug is missing for ${provider}.`), { statusCode: 503 });
  }
  return config;
}

function parseDestination(target) {
  const value = String(target || '').trim();
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { id: value };
  } catch {
    return { id: value };
  }
}

function buildIntegrationToolArguments(provider, target, payload = {}) {
  const title = String(payload.title || 'Protocolito protocol');
  const markdown = String(payload.markdownPackage || payload.summaryMarkdown || '');
  const destination = parseDestination(target);

  if (provider === 'notion') {
    if (!destination.id) throw Object.assign(new Error('Add a Notion parent page or database ID as the destination.'), { statusCode: 400 });
    return {
      parent_id: destination.id,
      database_id: destination.databaseId || destination.id,
      title,
      markdown,
      content: markdown,
    };
  }

  if (provider === 'asana') {
    if (!destination.id) throw Object.assign(new Error('Add an Asana project or workspace gid as the destination.'), { statusCode: 400 });
    return {
      data: {
        name: title,
        notes: markdown,
        projects: destination.projectId ? [destination.projectId] : [destination.id],
        workspace: destination.workspaceId || destination.id,
      },
    };
  }

  if (provider === 'google-docs') {
    return {
      title,
      markdown,
      text: markdown,
      folder_id: destination.folderId || destination.id,
    };
  }

  if (provider === 'slack') {
    if (!destination.id) throw Object.assign(new Error('Add a Slack channel ID as the destination.'), { statusCode: 400 });
    return {
      channel: destination.id,
      channel_id: destination.id,
      text: markdown,
      message: markdown,
    };
  }

  if (provider === 'teams') {
    if (!destination.id) throw Object.assign(new Error('Add a Microsoft Teams chat or channel ID as the destination.'), { statusCode: 400 });
    return {
      chat_id: destination.chatId || destination.id,
      channel_id: destination.channelId || destination.id,
      team_id: destination.teamId,
      content: markdown,
      body: markdown,
      message: markdown,
    };
  }

  return {
    title,
    content: markdown,
    body: markdown,
    description: markdown,
    destination: destination.id || target || '',
    ...destination,
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

function hashForLog(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function rateLimitKey(req) {
  const key = String(req.header('x-protocolito-key') || '').trim();
  return key ? `key:${hashForLog(key)}` : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

function rateLimit(req, res, next) {
  if (!rateLimitWindowMs || !rateLimitMaxRequests) {
    next();
    return;
  }

  const now = Date.now();
  const bucketKey = rateLimitKey(req);
  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + rateLimitWindowMs });
    next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > rateLimitMaxRequests) {
    res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many requests. Try again shortly.' });
    return;
  }

  next();
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

function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

function monthlyUsageCount(companyId, type, subjectId = null) {
  const month = currentMonthPrefix();
  return readUsageEvents(1000).filter((event) => (
    event.companyId === companyId
    && event.type === type
    && event.ok !== false
    && (!subjectId || event.userId === subjectId || event.deviceId === subjectId)
    && String(event.at || '').startsWith(month)
  )).length;
}

function enforceMonthlyLimit(company, type, subjectId = null) {
  const limitKey = type === 'summary' ? 'monthlySummaryLimit' : 'monthlyTranscriptionLimit';
  const limit = Number(company?.[limitKey] ?? 0);
  if (Number.isFinite(limit) && limit > 0) {
    const used = monthlyUsageCount(company.id, type);
    if (used >= limit) {
      throw Object.assign(new Error(`Monthly ${type} limit reached.`), {
        statusCode: 429,
        usageType: type,
        monthlyLimit: limit,
        monthlyUsed: used,
      });
    }
  }

  const userLimitKey = type === 'summary' ? 'monthlyUserSummaryLimit' : 'monthlyUserTranscriptionLimit';
  const userLimit = Number(company?.[userLimitKey] ?? 0);
  if (subjectId && Number.isFinite(userLimit) && userLimit > 0) {
    const userUsed = monthlyUsageCount(company.id, type, subjectId);
    if (userUsed >= userLimit) {
      throw Object.assign(new Error(`Monthly ${type} limit reached for this device.`), {
        statusCode: 429,
        usageType: type,
        monthlyLimit: userLimit,
        monthlyUsed: userUsed,
        subjectId,
      });
    }
  }
}

function usageSubject(body = {}) {
  return String(body.userId || body.deviceId || '').trim() || null;
}

function appendLimitMetadata(event, error) {
  if (!error) return event;
  return {
    ...event,
    monthlyLimit: error.monthlyLimit,
    monthlyUsed: error.monthlyUsed,
    subjectId: error.subjectId,
  };
}

function limitErrorEvent(type, companyId, error) {
  return appendLimitMetadata({
    type,
    ok: false,
    companyId,
    error: error.message,
  }, error);
}

function throwIfLimitReached(company, type, subjectId) {
  try {
    enforceMonthlyLimit(company, type, subjectId);
  } catch (error) {
    appendUsage(limitErrorEvent(type, company.id, error));
    throw error;
  }
}

function enforceRequestLimit(req, type) {
  const subjectId = usageSubject(req.body);
  throwIfLimitReached(req.company, type, subjectId);
  return subjectId;
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
    monthlyUserSummaryLimit: company.monthlyUserSummaryLimit ?? null,
    monthlyUserTranscriptionLimit: company.monthlyUserTranscriptionLimit ?? null,
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
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    const allowed = splitCsv(process.env.CORS_ORIGINS || '*');
    if (allowed.includes('*') || !origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Origin not allowed.'));
  },
}));
app.use('/v1', rateLimit);

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

app.get('/v1/integrations', authenticate, (req, res) => {
  const configured = Boolean(process.env.COMPOSIO_API_KEY);
  res.json({
    configured,
    providers: Object.entries(integrationConfigs()).map(([provider, config]) => ({
      provider,
      label: config.label,
      toolkit: config.toolkit,
      connectable: configured && Boolean(config.authConfigId),
      sendable: configured && Boolean(config.toolSlug),
    })),
  });
});

app.post('/v1/integrations/connect', authenticate, asyncHandler(async (req, res) => {
  const provider = String(req.body?.provider || '').trim();
  const config = getIntegrationConfig(provider);
  const userId = integrationUserId(req.company, req.body);
  const link = await composioClient().connectedAccounts.link(userId, config.authConfigId);
  res.json({
    status: 'started',
    provider,
    userId,
    connectedAccountId: link.connectedAccountId || link.connected_account_id || link.id || null,
    redirectUrl: link.redirectUrl || link.redirect_url || link.url || link.link || null,
  });
}));

app.post('/v1/integrations/status', authenticate, asyncHandler(async (req, res) => {
  const connectedAccountId = String(req.body?.connectedAccountId || '').trim();
  if (!connectedAccountId) {
    res.status(400).json({ error: 'Missing connected account ID.' });
    return;
  }
  const account = await composioClient().connectedAccounts.get(connectedAccountId);
  res.json({
    connectedAccountId,
    status: account.status || account.connectionStatus || null,
    provider: req.body?.provider || null,
  });
}));

app.post('/v1/integrations/send-summary', authenticate, asyncHandler(async (req, res) => {
  const provider = String(req.body?.provider || '').trim();
  const connectedAccountId = String(req.body?.connectedAccountId || '').trim();
  if (!connectedAccountId) {
    res.status(400).json({ error: 'Connect this integration before sending.' });
    return;
  }

  const config = getIntegrationConfig(provider);
  const args = buildIntegrationToolArguments(provider, req.body?.target, req.body?.payload || {});
  const result = await composioClient().tools.execute(config.toolSlug, {
    userId: integrationUserId(req.company, req.body),
    connectedAccountId,
    dangerouslySkipVersionCheck: true,
    arguments: args,
  });

  if (result?.successful === false || result?.error) {
    res.status(502).json({ error: result.error || 'Composio integration execution failed.', result });
    return;
  }

  appendUsage({
    type: 'integration_send',
    companyId: req.company.id,
    provider,
    connectedAccountId,
    outputChars: JSON.stringify(result || {}).length,
  });
  res.json({ status: 'success', provider, result });
}));

app.post('/v1/summarize', authenticate, asyncHandler(async (req, res) => {
  const owner = requireOwnerConfig();
  const transcript = String(req.body?.text || '').trim();
  if (!transcript) {
    appendUsage({
      type: 'summary',
      ok: false,
      companyId: req.company.id,
      error: 'missing_text',
    });
    res.status(400).json({ error: 'Missing transcript text.' });
    return;
  }
  if (transcript.length > maxSummaryChars) {
    appendUsage({
      type: 'summary',
      ok: false,
      companyId: req.company.id,
      inputChars: transcript.length,
      error: 'summary_too_large',
    });
    res.status(413).json({ error: 'Transcript is too large for one summary request.' });
    return;
  }

  const subjectId = enforceRequestLimit(req, 'summary');
  const model = allowedModel(req.company, 'summary', req.body?.model);
  const prompt = String(req.body?.prompt || 'Create a concise meeting protocol in Markdown with Summary, Decisions, Action Items, and Next Steps.').slice(0, maxPromptChars);
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
    appendUsage({
      type: 'summary',
      ok: false,
      companyId: req.company.id,
      model,
      inputChars: transcript.length,
      statusCode: response.status,
      error: body.error?.message || body.raw || 'infomaniak_summary_failed',
    });
    res.status(response.status).json({ error: body.error?.message || body.raw || 'Infomaniak summary failed.' });
    return;
  }

  const markdown = body.choices?.[0]?.message?.content || '';
  appendUsage({
    type: 'summary',
    companyId: req.company.id,
    userId: req.body?.userId || null,
    deviceId: req.body?.deviceId || null,
    subjectId,
    model,
    inputChars: transcript.length,
    outputChars: markdown.length,
  });

  res.json({ markdown, model });
}));

app.post('/v1/transcribe', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  const owner = requireOwnerConfig();
  if (!req.file?.buffer?.length) {
    appendUsage({
      type: 'transcription',
      ok: false,
      companyId: req.company.id,
      error: 'missing_audio_file',
    });
    res.status(400).json({ error: 'Missing audio file.' });
    return;
  }

  const subjectId = enforceRequestLimit(req, 'transcription');
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
    appendUsage({
      type: 'transcription',
      ok: false,
      companyId: req.company.id,
      model,
      inputBytes: req.file.size,
      statusCode: response.status,
      error: body.error?.message || body.raw || 'infomaniak_transcription_failed',
    });
    res.status(response.status).json({ error: body.error?.message || body.raw || 'Infomaniak transcription failed.' });
    return;
  }

  const text = body.text || body.transcript || '';
  appendUsage({
    type: 'transcription',
    companyId: req.company.id,
    userId: req.body?.userId || null,
    deviceId: req.body?.deviceId || null,
    subjectId,
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
  if (req.company && error.usageType) {
    appendUsage({
      type: error.usageType,
      ok: false,
      companyId: req.company.id,
      error: error.message,
      monthlyLimit: error.monthlyLimit,
      monthlyUsed: error.monthlyUsed,
    });
  }
  res.status(status).json({ error: status >= 500 ? 'Server error.' : error.message });
});

app.listen(port, () => {
  console.log(`Protocolito cloud proxy listening on ${port}`);
});
