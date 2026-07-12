const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
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
const getPreloadPath = () => path.join(app.getAppPath(), 'electron', 'preload.cjs');

const buildEscPosTestPayload = (config) => {
    const columns = Number(config && config.colunas) || 48;
    const title = 'TESTE DE IMPRESSAO PDV TOUCH';
    const line = '-'.repeat(Math.min(Math.max(columns, 32), 48));
    const cutCommand = config && config.corteAutomatico ? '\x1D\x56\x41\x00' : '';

    return Buffer.from(`\x1B@${title}\n${line}\nConexao: REDE\nData: ${new Date().toLocaleString('pt-BR')}\n\n\n${cutCommand}`, 'binary');
};

const sendNetworkPrinterTest = (config) =>
    new Promise((resolve, reject) => {
        const host = String(config && config.caminhoPorta ? config.caminhoPorta : '').trim();
        const port = Number(config && config.portaTcp) || 9100;

        if (!host) {
            reject(new Error('IP da impressora nao informado.'));
            return;
        }

        const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
            socket.write(buildEscPosTestPayload(config), () => {
                socket.end();
                resolve();
            });
        });

        socket.on('timeout', () => {
            socket.destroy(new Error('Tempo limite ao conectar na impressora.'));
        });

        socket.on('error', reject);
    });

ipcMain.on('print-job:test', (event, config) => {
    const safeConfig = config && typeof config === 'object' ? config : {};

    if (safeConfig.tipoConexao !== 'REDE') {
        writeStartupLog(`Teste de impressora recebido para conexao ${safeConfig.tipoConexao || 'desconhecida'}.`);
        return;
    }

    sendNetworkPrinterTest(safeConfig)
        .then(() => {
            writeStartupLog(`Teste de impressora enviado para ${safeConfig.caminhoPorta}:${safeConfig.portaTcp || 9100}.`);
        })
        .catch((error) => {
            writeStartupLog('Falha no teste de impressora.', error);
        });
});

ipcMain.on('print-job:execute', (_event, dados) => {
    writeStartupLog(`Print job recebido para implementacao futura: ${typeof dados}.`);
});

ipcMain.handle('print-job:list-printers', async() => {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) {
            return [];
        }

        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers.map((printer) => ({
            name: printer.name,
            displayName: printer.displayName || printer.name,
            description: printer.description || '',
            isDefault: Boolean(printer.isDefault),
            status: printer.status
        }));
    } catch (error) {
        writeStartupLog('Falha ao listar impressoras instaladas.', error);
        return [];
    }
});

const createWindow = async() => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 720,
        title: 'PDVTouch Restaurante',
        autoHideMenuBar: true,
        webPreferences: {
            preload: getPreloadPath(),
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
