const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const PORT = process.env.PORT || '3001';
const APP_URL = `http://127.0.0.1:${PORT}`;

let backendProcess = null;
let mainWindow = null;

const waitForServer = (url, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Servidor local nao respondeu em ${url}.`));
          return;
        }

        setTimeout(attempt, 500);
      });

      req.setTimeout(2000, () => {
        req.destroy();
      });
    };

    attempt();
  });

const startBackend = () => {
  const root = app.getAppPath();
  const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(root, 'backend', 'src', 'server.ts');

  backendProcess = spawn(process.execPath, [tsxCli, serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT
    },
    stdio: 'ignore',
    windowsHide: true
  });

  backendProcess.on('exit', () => {
    backendProcess = null;
  });
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: 'PDVTouch Restaurante',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadURL(APP_URL);
};

app.whenReady().then(async () => {
  try {
    startBackend();
    await waitForServer(APP_URL);
    await createWindow();
  } catch (error) {
    dialog.showErrorBox('PDVTouch nao iniciou', error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
