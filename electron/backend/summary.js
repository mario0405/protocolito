const { bearerAuthorization, infomaniakChatEndpoint, ownerInfomaniakConfig } = require('./infomaniak');
const { readProtocolitoCloudConfig, summarizeWithCloud } = require('./protocolito-cloud');

function buildFallbackSummary(text, customPrompt) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean);

  const sample = lines.slice(0, 8);
  const actionCandidates = lines.filter((line) => /\b(need|todo|follow|send|decide|next|action|must|should)\b/i.test(line));

  return {
    MeetingName: sample[0]?.slice(0, 80) || 'Meeting Summary',
    summary_json: null,
    markdown: [
      '# Protocol',
      '',
      '## Summary',
      sample.length
        ? sample.map((line) => `- ${line}`).join('\n')
        : '- No transcript content was available.',
      '',
      '## Decisions and Action Items',
      actionCandidates.length
        ? actionCandidates.slice(0, 8).map((line) => `- ${line}`).join('\n')
        : '- No explicit action items detected.',
      customPrompt ? `\n## Prompt Context\n${customPrompt}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function buildSummaryPrompt(template, customPrompt) {
  const templatePrompt = typeof template?.prompt === 'string' ? template.prompt.trim() : '';
  const userPrompt = String(customPrompt || '').trim();

  return [
    templatePrompt || 'Create a concise meeting protocol in Markdown with Summary, Decisions, Action Items, and Next Steps.',
    userPrompt ? `Additional user instruction:\n${userPrompt}` : '',
  ].filter(Boolean).join('\n\n');
}

async function callOpenAiCompatible({ endpoint, apiKey, model, text, prompt }) {
  const base = endpoint.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: bearerAuthorization(apiKey) } : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: `Transcript:\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model service returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const markdown = data.choices?.[0]?.message?.content || '';
  return {
    MeetingName: 'Meeting Summary',
    markdown,
  };
}

async function generateSummary({ app, db, args }) {
  const config = db.getSetting('modelConfig', {});
  const provider = args.model || config.provider || 'local-fallback';
  const model = args.modelName || config.model || '';
  const text = args.text || '';
  const customPrompt = args.customPrompt || '';
  const prompt = buildSummaryPrompt(args.template, customPrompt);

  if (!text.trim()) {
    throw new Error('No transcript text available for summary generation.');
  }

  let summary;
  if (provider === 'infomaniak') {
    if (readProtocolitoCloudConfig(app).configured) {
      summary = await summarizeWithCloud({
        app,
        text,
        model: model || config.model,
        customPrompt: prompt,
      });
    } else {
      const ownerConfig = ownerInfomaniakConfig();
      const endpoint = infomaniakChatEndpoint(ownerConfig.productId);
      if (!endpoint) throw new Error('Infomaniak owner configuration is missing.');
      if (!ownerConfig.apiKey) throw new Error('Infomaniak API key is missing.');
      summary = await callOpenAiCompatible({
        endpoint,
        apiKey: ownerConfig.apiKey,
        model: model || config.model,
        text,
        prompt,
      });
    }
  } else {
    summary = buildFallbackSummary(text, prompt);
  }

  db.saveSummary(args.meetingId, summary);
  return summary;
}

module.exports = { generateSummary, buildFallbackSummary };
