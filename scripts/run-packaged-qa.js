const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  })
);

const scriptName = args.get('script') || 'qa-deep-settings.js';
const port = Number(args.get('port') || 9340);
const exe = path.join(root, 'dist', 'win-unpacked', 'Protocolito.exe');
const qaScriptPath = path.join(root, 'artifacts', scriptName);
const userDataDir = args.get('user-data-dir')
  ? path.resolve(args.get('user-data-dir'))
  : path.join(root, 'artifacts', `qa-userdata-${path.basename(scriptName, '.js')}`);
const useConfigFile = args.get('infomaniak') === 'config';
const useCloudConfig = args.get('cloud') === 'config';

function killRunningApp() {
  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      "Get-Process | Where-Object { $_.ProcessName -match 'Protocolito|electron' } | Stop-Process -Force",
    ], { stdio: 'ignore' });
  } catch {
    // No running app to stop.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(1000, () => request.destroy(new Error('timeout')));
  });
}

async function waitForDebugTarget() {
  const start = Date.now();

  while (Date.now() - start < 20000) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Electron has not opened the debug port yet.
    }

    await sleep(250);
  }

  throw new Error('Timed out waiting for Electron debug target');
}

function connectToDebugger(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;

    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ ws, send });
    ws.onerror = () => reject(new Error('WebSocket debugger connection failed'));
  });
}

async function main() {
  if (!fs.existsSync(exe)) throw new Error(`Packaged app not found: ${exe}`);
  if (!fs.existsSync(qaScriptPath)) throw new Error(`QA script not found: ${qaScriptPath}`);

  killRunningApp();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const baseEnv = {
    ...process.env,
    PROTOCOLITO_USER_DATA_DIR: userDataDir,
  };

  const app = spawn(exe, [`--remote-debugging-port=${port}`], {
    cwd: root,
    env: useCloudConfig
      ? {
        ...baseEnv,
        PROTOCOLITO_CLOUD_CONFIG: process.env.PROTOCOLITO_CLOUD_CONFIG || path.join(root, '.secrets', 'protocolito.cloud.json'),
      }
      : useConfigFile
      ? {
        ...baseEnv,
        PROTOCOLITO_INFOMANIAK_CONFIG: process.env.PROTOCOLITO_INFOMANIAK_CONFIG || path.join(root, 'infomaniak.config.json'),
      }
      : {
        ...baseEnv,
        PROTOCOLITO_INFOMANIAK_PRODUCT_ID: process.env.PROTOCOLITO_INFOMANIAK_PRODUCT_ID || 'owner-product',
        PROTOCOLITO_INFOMANIAK_API_KEY: process.env.PROTOCOLITO_INFOMANIAK_API_KEY || 'owner-key',
        PROTOCOLITO_INFOMANIAK_TRANSCRIPTION_MODELS: process.env.PROTOCOLITO_INFOMANIAK_TRANSCRIPTION_MODELS || 'whisper-large-v3,whisper-large-v3-turbo',
        PROTOCOLITO_INFOMANIAK_SUMMARY_MODELS: process.env.PROTOCOLITO_INFOMANIAK_SUMMARY_MODELS || 'llama-3.3-70b-instruct,mistral-large',
      },
    stdio: 'ignore',
  });

  let client;
  try {
    const target = await waitForDebugTarget();
    client = await connectToDebugger(target.webSocketDebuggerUrl);
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    const qaScript = fs.readFileSync(qaScriptPath, 'utf8');
    const evaluated = await client.send('Runtime.evaluate', {
      expression: qaScript,
      awaitPromise: true,
      returnByValue: true,
      timeout: Number(args.get('timeout') || 45000),
    });

    if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));

    const value = evaluated.result.value;
    console.log(JSON.stringify(value, null, 2));
    if (!value?.ok) process.exitCode = 1;
  } finally {
    try { client?.ws?.close(); } catch {}
    try { app.kill(); } catch {}
    try { execFileSync('taskkill.exe', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
