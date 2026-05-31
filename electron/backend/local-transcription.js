const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pipeline } = require('stream/promises');
const { ensureDir } = require('./json-store');

const WHISPER_MODELS = [
  { name: 'tiny', size_mb: 39, accuracy: 'Decent', speed: 'Very Fast' },
  { name: 'base', size_mb: 142, accuracy: 'Good', speed: 'Fast' },
  { name: 'small', size_mb: 466, accuracy: 'Good', speed: 'Medium' },
  { name: 'medium', size_mb: 1463, accuracy: 'High', speed: 'Slow' },
  { name: 'large-v3', size_mb: 2951, accuracy: 'High', speed: 'Slow' },
  { name: 'large-v3-turbo', size_mb: 1549, accuracy: 'High', speed: 'Medium' },
  { name: 'medium-q5_0', size_mb: 514, accuracy: 'High', speed: 'Medium' },
  { name: 'large-v3-q5_0', size_mb: 1031, accuracy: 'High', speed: 'Slow' },
  { name: 'large-v3-turbo-q5_0', size_mb: 547, accuracy: 'High', speed: 'Medium' },
];

const MODEL_FILES = Object.fromEntries(WHISPER_MODELS.map((model) => [
  model.name,
  `ggml-${model.name}.bin`,
]));

const MODEL_URLS = Object.fromEntries(Object.entries(MODEL_FILES).map(([model, file]) => [
  model,
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`,
]));

const WINDOWS_ENGINE_URL = 'https://github.com/ggml-org/whisper.cpp/releases/latest/download/whisper-bin-x64.zip';

function splitPathEnv() {
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
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

function getWhisperCli(app) {
  const explicit = process.env.PROTOCOLITO_WHISPER_CLI;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const names = process.platform === 'win32'
    ? ['whisper-cli.exe', 'whisper.exe']
    : ['whisper-cli', 'whisper'];

  const managedEngine = findFile(path.join(app.getPath('userData'), 'bin', 'whisper.cpp'), names);
  if (managedEngine) return managedEngine;

  const localCandidates = [
    path.join(app.getPath('userData'), 'bin', names[0]),
    path.join(process.resourcesPath || '', 'bin', names[0]),
    path.join(process.cwd(), 'bin', names[0]),
  ];
  const local = localCandidates.find((candidate) => candidate && fs.existsSync(candidate));
  return local || findExecutable(names);
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

function getWhisperModelsDir(app) {
  const dir = path.join(app.getPath('userData'), 'models', 'whisper');
  ensureDir(dir);
  return dir;
}

function getModelPath(app, modelName) {
  const fileName = MODEL_FILES[modelName] || `ggml-${modelName}.bin`;
  return path.join(getWhisperModelsDir(app), fileName);
}

function listWhisperModels(app) {
  const engine = getWhisperCli(app);
  return WHISPER_MODELS.map((model) => {
    const modelPath = getModelPath(app, model.name);
    const exists = fs.existsSync(modelPath);
    const status = exists && engine ? 'Available' : 'Missing';

    return {
      ...model,
      path: modelPath,
      status,
      description: exists && engine
        ? 'Local Whisper model for offline transcription.'
        : 'Download sets up the Whisper engine and this model automatically.',
    };
  });
}

function validateWhisperReady(app, modelName) {
  const engine = getWhisperCli(app);
  if (!engine) {
    throw new Error('Local Whisper is not available in this desktop build. Install whisper.cpp and set PROTOCOLITO_WHISPER_CLI, or use Infomaniak transcription.');
  }

  const modelPath = getModelPath(app, modelName || 'large-v3-turbo');
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Local Whisper model is missing: ${path.basename(modelPath)}. Download or copy it into ${getWhisperModelsDir(app)}.`);
  }

  return modelPath;
}

function runFile(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: options.timeout || 15 * 60 * 1000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}${stderr ? `\n${stderr}` : ''}`;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
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
          if (total && onProgress) onProgress(Math.min(100, (downloaded / total) * 100));
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

async function ensureWhisperEngine(app, onProgress) {
  const existing = getWhisperCli(app);
  if (existing) return existing;
  if (process.platform !== 'win32') {
    throw new Error('Automatic Whisper engine setup is currently available for Windows only.');
  }

  const engineDir = path.join(app.getPath('userData'), 'bin', 'whisper.cpp');
  fs.rmSync(engineDir, { recursive: true, force: true });
  ensureDir(engineDir);

  const zipPath = path.join(app.getPath('userData'), 'bin', 'whisper-bin-x64.zip');
  await downloadFile(WINDOWS_ENGINE_URL, zipPath, onProgress);
  await runFile('tar', ['-xf', zipPath, '-C', engineDir], { timeout: 2 * 60 * 1000 });

  const engine = getWhisperCli(app);
  if (!engine) {
    throw new Error('Whisper engine downloaded, but whisper-cli.exe was not found in the package.');
  }
  return engine;
}

async function downloadWhisperModel(app, modelName, onProgress) {
  const model = modelName || 'large-v3-turbo';
  const url = MODEL_URLS[model];
  if (!url) throw new Error(`No download URL configured for Whisper model: ${model}`);

  await ensureWhisperEngine(app, (progress) => onProgress?.(Math.min(10, progress * 0.1)));

  const modelPath = getModelPath(app, model);
  if (!fs.existsSync(modelPath)) {
    await downloadFile(url, modelPath, (progress) => onProgress?.(10 + progress * 0.9));
  }

  validateWhisperReady(app, model);
  onProgress?.(100);
  return modelPath;
}

function normalizeAudioBytes(audioData) {
  if (Array.isArray(audioData)) return Buffer.from(audioData);
  if (audioData instanceof ArrayBuffer) return Buffer.from(new Uint8Array(audioData));
  if (ArrayBuffer.isView(audioData)) return Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
  if (Buffer.isBuffer(audioData)) return audioData;
  throw new Error('Invalid audio payload for local transcription.');
}

async function transcribeWithWhisperCli({ app, audioData, mimeType, fileName, modelName }) {
  const engine = getWhisperCli(app);
  const modelPath = validateWhisperReady(app, modelName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protocolito-whisper-'));
  const ext = path.extname(fileName || '') || (String(mimeType || '').includes('wav') ? '.wav' : '.webm');
  const inputPath = path.join(tmpDir, `recording${ext}`);
  const outputBase = path.join(tmpDir, 'transcript');

  try {
    fs.writeFileSync(inputPath, normalizeAudioBytes(audioData));
    const baseName = path.basename(engine).toLowerCase();

    if (baseName === 'whisper.exe' || baseName === 'whisper') {
      await runFile(engine, [
        inputPath,
        '--model', modelName || 'large-v3-turbo',
        '--output_format', 'txt',
        '--output_dir', tmpDir,
      ]);
      const txtPath = path.join(tmpDir, `${path.basename(inputPath, ext)}.txt`);
      return { text: fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8').trim() : '' };
    }

    await runFile(engine, [
      '-m', modelPath,
      '-f', inputPath,
      '-otxt',
      '-of', outputBase,
      '-l', 'auto',
    ]);
    const txtPath = `${outputBase}.txt`;
    return { text: fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8').trim() : '' };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = {
  getWhisperCli,
  getWhisperModelsDir,
  listWhisperModels,
  transcribeWithWhisperCli,
  validateWhisperReady,
  downloadWhisperModel,
};
