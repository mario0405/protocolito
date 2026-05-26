const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { createCommandRegistry } = require('./backend/commands');

let mainWindow;

if (process.env.PROTOCOLITO_USER_DATA_DIR) {
  app.setPath('userData', process.env.PROTOCOLITO_USER_DATA_DIR);
}

app.setAppUserModelId('ch.protocolito.app');

function resolveStaticEntry() {
  return path.join(__dirname, '..', 'dist-renderer', 'index.html');
}

function resolveAppIcon() {
  const candidates = [
    path.join(process.resourcesPath || '', 'resources', 'app_icon.ico'),
    path.join(process.resourcesPath || '', 'app_icon.ico'),
    path.join(__dirname, '..', 'resources', 'app_icon.ico'),
    path.join(__dirname, '..', 'build', 'app_icon.ico'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 960,
    minHeight: 620,
    title: 'Protocolito',
    icon: resolveAppIcon(),
    backgroundColor: '#f9fafb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(resolveStaticEntry());
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.PROTOCOLITO_CAPTURE_PATH || process.env.PROTOCOLITO_TEST_SCRIPT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        let testResult = null;
        try {
          if (process.env.PROTOCOLITO_TEST_SCRIPT) {
            try {
              testResult = await mainWindow.webContents.executeJavaScript(process.env.PROTOCOLITO_TEST_SCRIPT);
            } catch (error) {
              testResult = {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : null,
              };
            }
          }

          if (process.env.PROTOCOLITO_CAPTURE_PATH) {
            const image = await mainWindow.capturePage();
            fs.writeFileSync(process.env.PROTOCOLITO_CAPTURE_PATH, image.toPNG());
          }
        } finally {
          if (process.env.PROTOCOLITO_TEST_RESULT_PATH) {
            fs.writeFileSync(
              process.env.PROTOCOLITO_TEST_RESULT_PATH,
              JSON.stringify(testResult, null, 2)
            );
          }
          app.quit();
        }
      }, Number(process.env.PROTOCOLITO_CAPTURE_DELAY_MS || 2500));
    });
  }
}

app.whenReady().then(() => {
  const emitToRenderer = (event, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('protocolito:event', { event, payload });
  };

  const registry = createCommandRegistry({ app, shell, emitToRenderer });

  ipcMain.handle('protocolito:invoke', async (_event, command, args = {}) => {
    return registry.invoke(command, args);
  });

  ipcMain.on('protocolito:emit', (_event, payload) => {
    emitToRenderer(payload.event, payload.payload);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
