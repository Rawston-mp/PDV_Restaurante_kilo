const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const tls = require('node:tls');
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

    const { tsImport } = await import('tsx/esm/api');
    await tsImport(pathToFileURL(serverEntry).href, {
        parentURL: pathToFileURL(path.join(root, 'electron', 'main.cjs')).href
    });
};

const getAppRoot = () => {
    const appPath = app.getAppPath();
    if (fs.existsSync(path.join(appPath, 'backend', 'src', 'server.ts'))) {
        return appPath;
    }
    const parentPath = path.resolve(appPath, '..');
    if (fs.existsSync(path.join(parentPath, 'backend', 'src', 'server.ts'))) {
        return parentPath;
    }
    return path.resolve(__dirname, '..');
};

const startBackend = async() => {
    const root = getAppRoot();
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
const getRendererIndexPath = () => path.join(getAppRoot(), 'dist', 'index.html');
const getPreloadPath = () => path.join(getAppRoot(), 'electron', 'preload.cjs');

const buildEscPosTestPayload = (config) => {
    const columns = Number(config && config.colunas) || 48;
    const title = 'TESTE DE IMPRESSAO PDV TOUCH';
    const line = '-'.repeat(Math.min(Math.max(columns, 32), 48));
    const cutCommand = config && config.corteAutomatico ? '\x1D\x56\x41\x00' : '';

    return Buffer.from(`\x1B@${title}\n${line}\nConexao: REDE\nData: ${new Date().toLocaleString('pt-BR')}\n\n\n${cutCommand}`, 'binary');
};

const getSecureCertificateDirectory = () => path.join(app.getPath('userData'), 'secure-certificates');

const ensureSecureCertificateDirectory = () => {
    const certificateDirectory = getSecureCertificateDirectory();
    fs.mkdirSync(certificateDirectory, { recursive: true });
    return certificateDirectory;
};

const getFileExtension = (filePath) => path.extname(filePath).replace('.', '').toLowerCase();

const storeCertificateSecurely = async(filePath, importSource) => {
    const extension = getFileExtension(filePath);
    if (!['pfx', 'p12'].includes(extension)) {
        throw new Error('Selecione um certificado A1 nos formatos .pfx ou .p12.');
    }

    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Armazenamento criptografado indisponível neste computador.');
    }

    const stats = await fs.promises.stat(filePath);
    if (stats.size <= 0) {
        throw new Error('Arquivo de certificado vazio ou inválido.');
    }

    if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Arquivo de certificado acima de 10 MB.');
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const secureStorageId = crypto.randomUUID();
    const encryptedPayload = safeStorage.encryptString(fileBuffer.toString('base64')).toString('base64');
    const certificateDirectory = ensureSecureCertificateDirectory();
    const targetPath = path.join(certificateDirectory, `${secureStorageId}.json`);

    const record = {
        version: 1,
        encryptedPayload,
        algorithm: 'electron.safeStorage',
        fileName: path.basename(filePath),
        fileExtension: extension,
        fileSize: stats.size,
        sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
        importSource: importSource === 'PENDRIVE' ? 'PENDRIVE' : 'MAQUINA',
        importedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(targetPath, JSON.stringify(record, null, 2), { encoding: 'utf8' });

    return {
        secureStorageId,
        fileName: record.fileName,
        fileExtension: record.fileExtension,
        fileSize: record.fileSize,
        importSource: record.importSource,
        importedAt: record.importedAt,
        hasSecureCertificate: true
    };
};

const loadSecureCertificateBuffer = async(secureStorageId) => {
    const normalizedId = String(secureStorageId || '').trim();
    if (!/^[a-f0-9-]{32,}$/i.test(normalizedId)) {
        throw new Error('Identificador do certificado inválido. Importe o A1 novamente.');
    }

    const certificatePath = path.join(getSecureCertificateDirectory(), `${normalizedId}.json`);
    const recordText = await fs.promises.readFile(certificatePath, 'utf8');
    const record = JSON.parse(recordText);

    if (!record.encryptedPayload || record.algorithm !== 'electron.safeStorage') {
        throw new Error('Registro do certificado está incompleto ou em formato inválido.');
    }

    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Armazenamento criptografado indisponível neste computador.');
    }

    const decryptedBase64 = safeStorage.decryptString(Buffer.from(record.encryptedPayload, 'base64'));
    return {
        buffer: Buffer.from(decryptedBase64, 'base64'),
        fileName: record.fileName || 'certificado-a1.pfx',
        fileSize: Number(record.fileSize) || 0,
        importedAt: record.importedAt || null,
        sha256: record.sha256 || null
    };
};

const validateStoredCertificate = async({ secureStorageId, password }) => {
    const passphrase = String(password || '');
    if (!passphrase) {
        throw new Error('Informe a senha do certificado A1 para validar.');
    }

    const certificate = await loadSecureCertificateBuffer(secureStorageId);
    tls.createSecureContext({
        pfx: certificate.buffer,
        passphrase
    });

    return {
        fileName: certificate.fileName,
        fileSize: certificate.fileSize,
        importedAt: certificate.importedAt,
        sha256: certificate.sha256,
        validatedAt: new Date().toISOString()
    };
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

ipcMain.handle('certificate:select-and-store', async(_event, options = {}) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Selecionar certificado digital A1',
            properties: ['openFile'],
            filters: [
                { name: 'Certificado A1', extensions: ['pfx', 'p12'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { ok: false, canceled: true };
        }

        const metadata = await storeCertificateSecurely(result.filePaths[0], options && options.importSource);
        writeStartupLog(`Certificado A1 armazenado com seguranca: ${metadata.fileName}.`);
        return { ok: true, metadata };
    } catch (error) {
        writeStartupLog('Falha ao armazenar certificado A1.', error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
});

ipcMain.handle('certificate:validate', async(_event, input = {}) => {
    try {
        const result = await validateStoredCertificate(input);
        writeStartupLog(`Certificado A1 validado: ${result.fileName}.`);
        return { ok: true, result };
    } catch (error) {
        writeStartupLog('Falha ao validar certificado A1.', error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
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

