const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const PORT = process.env.PORT || '3001';
const APP_URL = `http://127.0.0.1:${PORT}`;

let backendProcess = null;
let mainWindow = null;
const startupLogPath = path.join(os.tmpdir(), 'pdvtouch-main.log');

const writeStartupLog = (message, error) => {
    const details = error ? ` | ${error.stack || error.message || String(error)}` : '';
    const line = `[${new Date().toISOString()}] ${message}${details}\n`;

    try {
        fs.appendFileSync(startupLogPath, line, 'utf8');
    } catch {
        // Logging must never block application startup.
    }
};

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

const startBackendInProcess = async(root, serverEntry) => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = PORT;

    const { tsImport } = await
    import ('tsx/esm/api');
    await tsImport(pathToFileURL(serverEntry).href, {
        parentURL: pathToFileURL(path.join(root, 'electron', 'main.cjs')).href
    });
};

const startBackend = async() => {
    const root = app.getAppPath();
    const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const serverEntry = path.join(root, 'backend', 'src', 'server.ts');

    if (!fs.existsSync(serverEntry)) {
        throw new Error(`Backend ausente: nao encontrei ${serverEntry}.`);
    }

    if (app.isPackaged) {
        await startBackendInProcess(root, serverEntry);
        return;
    }

    if (!fs.existsSync(tsxCli)) {
        throw new Error(`Runtime ausente: nao encontrei tsx em ${tsxCli}.`);
    }

    await new Promise((resolve, reject) => {
        writeStartupLog(`Spawning backend with `);
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

        backendProcess.once('spawn', () => {
            writeStartupLog('Backend child process spawned.');
            resolve();
        });

        backendProcess.once('error', (error) => {
            backendProcess = null;
            reject(new Error(`Nao foi possivel iniciar o backend local: ${error.message}`));
        });

        backendProcess.on('exit', () => {
            backendProcess = null;
        });
    });
};
const getRendererIndexPath = () => path.join(app.getAppPath(), 'dist', 'index.html');

const createWindow = async() => {
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

    const rendererIndex = getRendererIndexPath();

    if (!fs.existsSync(rendererIndex)) {
        throw new Error(`Interface ausente: nao encontrei ${rendererIndex}.`);
    }

    await mainWindow.loadFile(rendererIndex);
};

app.whenReady().then(async() => {
    try {
        writeStartupLog('Electron app ready.');
        await startBackend();
        await waitForServer(APP_URL);
        await createWindow();
    } catch (error) {
        writeStartupLog('Startup failed.', error);
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