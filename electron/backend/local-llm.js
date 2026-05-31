const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pipeline } = require('stream/promises');
const { ensureDir } = require('./json-store');

const LOCAL_LLM_MODELS = [
  {
    name: 'qwen2.5-0.5b-instruct-q4',
    display_name: 'Qwen 2.5 0.5B',
    size_mb: 380,
    context_size: 32768,
    gguf_file: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    description: 'Fast local summaries. Best first local model for pilot laptops.',
  },
  {
    name: 'qwen2.5-1.5b-instruct-q4',
    display_name: 'Qwen 2.5 1.5B',
    size_mb: 986,
    context_size: 32768,
    gguf_file: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    description: 'Balanced local summaries. Better quality while still reasonable on pilot laptops.',
  },
  {
    name: 'qwen2.5-3b-instruct-q4',
    display_name: 'Qwen 2.5 3B',
    size_mb: 1920,
    context_size: 32768,
    gguf_file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    description: 'Best local pilot quality. Larger download and slower CPU inference.',
  },
];

function splitPathEnv() {
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findFile(root, names) {
  if (!root || !fs.existsSync(root)) return null;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(full);
      } else if (wanted.has(item.name.toLowerCase())) {
        return full;
      }
    }
  }
  return null;
}

function findExecutable(names) {
  for (const dir of splitPathEnv()) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function getLlamaModelsDir(app) {
  const dir = path.join(app.getPath('userData'), 'models', 'llm');
  ensureDir(dir);
  return dir;
}

function getLlamaCli(app) {
  const explicit = process.env.PROTOCOLITO_LLAMA_CLI;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const names = process.platform === 'win32'
    ? ['llama-cli.exe', 'main.exe']
    : ['llama-cli', 'main'];

  const managed = findFile(path.join(app.getPath('userData'), 'bin', 'llama.cpp'), names);
  if (managed) return managed;
  return findExecutable(names);
}

function getModelDefinition(modelName) {
  return LOCAL_LLM_MODELS.find((model) => model.name === modelName) || LOCAL_LLM_MODELS[0];
}

function getModelPath(app, modelName) {
  const model = getModelDefinition(modelName);
  return path.join(getLlamaModelsDir(app), model.gguf_file);
}

function listLocalLlmModels(app) {
  const engine = getLlamaCli(app);
  return LOCAL_LLM_MODELS.map((model) => {
    const modelPath = getModelPath(app, model.name);
    const available = Boolean(engine && fs.existsSync(modelPath));
    return {
      ...model,
      path: modelPath,
      status: {
        type: available ? 'available' : 'not_downloaded',
      },
    };
  });
}

function runFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      timeout: options.timeout || 15 * 60 * 1000,
      windowsHide: true,
      maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}${stderr ? `\n${stderr}` : ''}`;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function cleanLlamaOutput(stdout, promptInput = '') {
  let normalized = String(stdout || '').replace(/\u001b\[[0-9;]*m/g, '');
  if (promptInput && normalized.includes(promptInput)) {
    normalized = normalized.slice(normalized.indexOf(promptInput) + promptInput.length);
  }

  const lines = normalized.split(/\r?\n/);
  const output = [];
  let sawPrompt = false;
  let collecting = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed.startsWith('> ')) {
      sawPrompt = true;
      collecting = false;
      continue;
    }
    if (!sawPrompt) continue;
    if (!collecting && !trimmed) continue;
    if (/^\[\s*Prompt:/i.test(trimmed) || /^Exiting\.\.\.$/i.test(trimmed)) break;
    if (/^(Loading model|build\s+:|model\s+:|modalities\s+:|available commands:)/i.test(trimmed)) continue;
    if (/^(\/exit|\/regen|\/clear|\/read|\/glob)\b/i.test(trimmed)) continue;
    collecting = true;
    output.push(line);
  }

  const cleaned = output.join('\n').trim();
  if (cleaned) {
    const cleanedMarkdownStart = cleaned.match(/(?:^|\n)(#{1,3}\s+(?:Meeting|Protocol|Summary|Protokoll|Zusammenfassung)[\s\S]*)/i);
    return (cleanedMarkdownStart?.[1] || cleaned).trim();
  }

  const markdownStart = normalized.match(/(?:^|\n)(#{1,3}\s+(?:Meeting|Protocol|Summary|Protokoll|Zusammenfassung)[\s\S]*)/i);
  if (markdownStart?.[1]) {
    return markdownStart[1]
      .replace(/\n\[\s*Prompt:[\s\S]*$/i, '')
      .replace(/\nExiting\.\.\.[\s\S]*$/i, '')
      .trim();
  }

  return normalized
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed
        && !/^\[\s*Prompt:/i.test(trimmed)
        && !/^Exiting\.\.\.$/i.test(trimmed)
        && !/^(Loading model|build\s+:|model\s+:|modalities\s+:|available commands:)/i.test(trimmed)
        && !/^(\/exit|\/regen|\/clear|\/read|\/glob)\b/i.test(trimmed)
        && !/^[▄█▀\s]+$/.test(trimmed);
    })
    .join('\n')
    .trim();
}

async function downloadFile(url, targetPath, onProgress) {
  ensureDir(path.dirname(targetPath));
  const tempPath = `${targetPath}.download`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with ${response.status}: ${await response.text()}`);
  }

  const total = Number(response.headers.get('content-length') || 0);
  let downloaded = 0;
  const source = new ReadableStream({
    start(controller) {
      const reader = response.body.getReader();
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }
          downloaded += value.byteLength;
          if (total && onProgress) {
            onProgress({
              progress: Math.min(100, (downloaded / total) * 100),
              downloadedMb: downloaded / 1024 / 1024,
              totalMb: total / 1024 / 1024,
            });
          }
          controller.enqueue(value);
          read();
        }).catch((error) => controller.error(error));
      }
      read();
    },
  });

  await pipeline(source, fs.createWriteStream(tempPath));
  fs.renameSync(tempPath, targetPath);
}

async function latestWindowsCpuLlamaUrl() {
  const response = await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new Error(`Could not read llama.cpp release metadata: ${response.status}`);
  }
  const release = await response.json();
  const asset = (release.assets || []).find((item) => /bin-win-cpu-x64\.zip$/i.test(item.name || ''));
  if (!asset?.browser_download_url) {
    throw new Error('Could not find llama.cpp Windows CPU x64 release asset.');
  }
  return asset.browser_download_url;
}

async function ensureLlamaEngine(app, onProgress) {
  const existing = getLlamaCli(app);
  if (existing) return existing;
  if (process.platform !== 'win32') {
    throw new Error('Automatic local LLM setup is currently available for Windows only.');
  }

  const engineDir = path.join(app.getPath('userData'), 'bin', 'llama.cpp');
  fs.rmSync(engineDir, { recursive: true, force: true });
  ensureDir(engineDir);

  const url = await latestWindowsCpuLlamaUrl();
  const zipPath = path.join(app.getPath('userData'), 'bin', 'llama-bin-win-cpu-x64.zip');
  await downloadFile(url, zipPath, ({ progress }) => onProgress?.(Math.min(10, progress * 0.1)));
  await runFile('tar', ['-xf', zipPath, '-C', engineDir], { timeout: 2 * 60 * 1000 });

  const engine = getLlamaCli(app);
  if (!engine) {
    throw new Error('llama.cpp downloaded, but llama-cli.exe was not found in the package.');
  }
  return engine;
}

async function downloadLocalLlmModel(app, modelName, onProgress) {
  const model = getModelDefinition(modelName);
  await ensureLlamaEngine(app, onProgress);
  const modelPath = getModelPath(app, model.name);
  if (!fs.existsSync(modelPath)) {
    await downloadFile(model.url, modelPath, ({ progress, downloadedMb, totalMb }) => {
      onProgress?.(10 + progress * 0.9, downloadedMb, totalMb);
    });
  }
  validateLocalLlmReady(app, model.name);
  onProgress?.(100, model.size_mb, model.size_mb);
  return modelPath;
}

function validateLocalLlmReady(app, modelName) {
  const engine = getLlamaCli(app);
  if (!engine) {
    throw new Error('Local LLM engine is missing. Download a local summary model first.');
  }
  const modelPath = getModelPath(app, modelName);
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Local LLM model is missing: ${path.basename(modelPath)}.`);
  }
  return { engine, modelPath };
}

async function generateWithLocalLlm({ app, modelName, prompt, text }) {
  const { engine, modelPath } = validateLocalLlmReady(app, modelName);
  const threads = String(Math.max(1, Math.min(8, (os.cpus()?.length || 2) - 1)));
  const input = [
    'You are Protocolito, a precise meeting assistant.',
    prompt,
    '',
    'Create a concise meeting protocol in Markdown.',
    '',
    `Transcript:\n${text}`,
  ].filter(Boolean).join('\n\n');

  const promptFile = path.join(os.tmpdir(), `protocolito-llm-${Date.now()}.txt`);
  fs.writeFileSync(promptFile, input, 'utf8');
  try {
    const { stdout } = await runFile(engine, [
      '-m', modelPath,
      '-f', promptFile,
      '-n', '550',
      '--temp', '0.2',
      '--ctx-size', '8192',
      '--no-display-prompt',
      '--single-turn',
      '--simple-io',
      '--threads', threads,
    ], { timeout: 5 * 60 * 1000 });

    return {
      MeetingName: 'Meeting Summary',
      markdown: cleanLlamaOutput(stdout, input),
    };
  } finally {
    fs.rmSync(promptFile, { force: true });
  }
}

function deleteLocalLlmModel(app, modelName) {
  const modelPath = getModelPath(app, modelName);
  if (fs.existsSync(modelPath)) fs.rmSync(modelPath, { force: true });
  return { status: 'success' };
}

module.exports = {
  LOCAL_LLM_MODELS,
  deleteLocalLlmModel,
  downloadLocalLlmModel,
  generateWithLocalLlm,
  getLlamaCli,
  getLlamaModelsDir,
  listLocalLlmModels,
  validateLocalLlmReady,
};
