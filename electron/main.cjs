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
const forge = require('node-forge');

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

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const escapeXml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const formatFiscalAmount = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '0.00';
};

const formatNfceDateTime = (date = new Date()) => {
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetRemainder = String(absOffset % 60).padStart(2, '0');
    const pad = (part) => String(part).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHours}:${offsetRemainder}`;
};

const calculateModulo11CheckDigit = (base) => {
    let weight = 2;
    let sum = 0;

    for (let index = base.length - 1; index >= 0; index -= 1) {
        sum += Number(base[index]) * weight;
        weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    const digit = 11 - remainder;
    return digit >= 10 ? '0' : String(digit);
};

const splitAddressLine = (line) => {
    const rawLine = String(line || '').trim();
    const [streetChunk = '', numberChunk = '', districtChunk = ''] = rawLine.split(',').map((part) => part.trim());

    return {
        street: streetChunk || 'Rua Exemplo',
        number: numberChunk || 'S/N',
        district: districtChunk || 'Centro'
    };
};

const splitCityUf = (value, fallbackUf) => {
    const rawValue = String(value || '').trim();
    const [cityChunk = '', ufChunk = ''] = rawValue.split('/').map((part) => part.trim());

    return {
        city: cityChunk || 'Sao Paulo',
        uf: (ufChunk || fallbackUf || 'SP').toUpperCase().slice(0, 2)
    };
};

const buildNfceAccessKey = ({ cnpj, serie, number, issuedAt }) => {
    const year = String(issuedAt.getFullYear()).slice(-2);
    const month = String(issuedAt.getMonth() + 1).padStart(2, '0');
    const numericSerie = onlyDigits(serie).padStart(3, '0').slice(-3);
    const numericNumber = onlyDigits(number).padStart(9, '0').slice(-9);
    const randomCode = crypto
        .createHash('sha1')
        .update(`${cnpj}-${numericSerie}-${numericNumber}-${issuedAt.toISOString()}`)
        .digest('hex')
        .replace(/\D/g, '')
        .padEnd(8, '0')
        .slice(0, 8);
    const base = `35${year}${month}${cnpj.padStart(14, '0').slice(0, 14)}65${numericSerie}${numericNumber}1${randomCode}`;

    return `${base}${calculateModulo11CheckDigit(base)}`;
};

const buildDevelopmentQrCodeUrl = ({ accessKey, environment, cscId, cscCode }) => {
    const tpAmb = environment === 'PRODUCAO' ? '1' : '2';
    const normalizedCscId = onlyDigits(cscId).padStart(6, '0').slice(-6);
    const token = String(cscCode || '').trim();
    const hash = crypto
        .createHash('sha1')
        .update(`${accessKey}|2|${tpAmb}|${normalizedCscId}${token}`)
        .digest('hex')
        .toUpperCase();

    return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${accessKey}|2|${tpAmb}|${normalizedCscId}|${hash}`;
};

const buildHomologationNfceXml = ({ settings, accessKey, qrCodeUrl, issuedAt }) => {
    const address = splitAddressLine(settings.addressLine1);
    const cityUf = splitCityUf(settings.cityUf, settings.uf);
    const cnpj = onlyDigits(settings.cnpj).padStart(14, '0').slice(0, 14);
    const serie = onlyDigits(settings.nfceSerie).padStart(3, '0').slice(-3);
    const number = onlyDigits(settings.nfceNextNumber).padStart(9, '0').slice(-9);
    const stateRegistration = onlyDigits(settings.stateRegistration) || 'ISENTO';
    const crt = String(settings.taxRegime || '').toLowerCase().includes('simples') ? '1' : '3';
    const issueDate = formatNfceDateTime(issuedAt);
    const productValue = 1;

    return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${accessKey}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${accessKey.slice(35, 43)}</cNF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>${serie}</serie>
      <nNF>${number}</nNF>
      <dhEmi>${issueDate}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${accessKey.slice(-1)}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>PDVTouch-DEV</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpj}</CNPJ>
      <xNome>${escapeXml(settings.companyName || 'PDVTouch Restaurante')}</xNome>
      <enderEmit>
        <xLgr>${escapeXml(address.street)}</xLgr>
        <nro>${escapeXml(address.number)}</nro>
        <xBairro>${escapeXml(address.district)}</xBairro>
        <cMun>3550308</cMun>
        <xMun>${escapeXml(cityUf.city)}</xMun>
        <UF>${escapeXml(cityUf.uf)}</UF>
        <CEP>00000000</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${escapeXml(stateRegistration)}</IE>
      <CRT>${crt}</CRT>
    </emit>
    <dest>
      <CPF>00000000000</CPF>
      <xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>
      <indIEDest>9</indIEDest>
    </dest>
    <det nItem="1">
      <prod>
        <cProd>HOMOLOGACAO</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xProd>
        <NCM>21069090</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>${formatFiscalAmount(productValue)}</vUnCom>
        <vProd>${formatFiscalAmount(productValue)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>1.0000</qTrib>
        <vUnTrib>${formatFiscalAmount(productValue)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISOutr>
            <CST>49</CST>
            <vBC>0.00</vBC>
            <pPIS>0.0000</pPIS>
            <vPIS>0.00</vPIS>
          </PISOutr>
        </PIS>
        <COFINS>
          <COFINSOutr>
            <CST>49</CST>
            <vBC>0.00</vBC>
            <pCOFINS>0.0000</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSOutr>
        </COFINS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${formatFiscalAmount(productValue)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${formatFiscalAmount(productValue)}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <indPag>0</indPag>
        <tPag>01</tPag>
        <vPag>${formatFiscalAmount(productValue)}</vPag>
      </detPag>
    </pag>
  </infNFe>
  <infNFeSupl>
    <qrCode><![CDATA[${qrCodeUrl}]]></qrCode>
    <urlChave>https://www.nfce.fazenda.sp.gov.br/consulta</urlChave>
  </infNFeSupl>
</NFe>`;
};

const canonicalizeGeneratedXml = (xml) =>
    String(xml || '')
        .replace(/\r?\n\s*/g, '')
        .replace(/>\s+</g, '><')
        .trim();

const getPkcs12Identity = (pfxBuffer, password) => {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, String(password || ''));
    const keyBags = [
        ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
        ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])
    ];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const privateKey = keyBags.find((bag) => bag.key)?.key;
    const certificate = certBags.find((bag) => bag.cert)?.cert;

    if (!privateKey || !certificate) {
        throw new Error('Certificado A1 não contém chave privada e certificado públicos válidos.');
    }

    return { privateKey, certificate };
};

const signNfceXmlForHomologationPreparation = ({ xml, accessKey, certificateBuffer, password }) => {
    const { privateKey, certificate } = getPkcs12Identity(certificateBuffer, password);
    const infNfePattern = new RegExp(`<infNFe Id="NFe${accessKey}" versao="4.00">[\\s\\S]*?<\\/infNFe>`);
    const infNfeMatch = xml.match(infNfePattern);

    if (!infNfeMatch) {
        throw new Error('Não foi possível localizar a tag infNFe para assinatura.');
    }

    const canonicalInfNfe = canonicalizeGeneratedXml(infNfeMatch[0]);
    const digestValue = crypto.createHash('sha256').update(canonicalInfNfe, 'utf8').digest('base64');
    const signedInfo = `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI="#NFe${accessKey}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
    const md = forge.md.sha256.create();
    md.update(canonicalizeGeneratedXml(signedInfo), 'utf8');
    const signatureValue = forge.util.encode64(privateKey.sign(md));
    const certificateValue = forge.pki
        .certificateToPem(certificate)
        .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\r?\n/g, '');
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certificateValue}</X509Certificate></X509Data></KeyInfo></Signature>`;
    const signedXml = xml.replace('</NFe>', `${signatureXml}</NFe>`);

    return {
        signedXml,
        digestValue,
        referenceId: `NFe${accessKey}`
    };
};

const validatePreparedNfceXml = ({ signedXml, accessKey, environment, qrCodeUrl }) => {
    const errors = [];
    const warnings = [
        'Validação local estrutural concluída. Autorização real ainda depende de XSD oficial e transmissão SOAP em homologação SEFAZ-SP.'
    ];
    const requiredSnippets = [
        '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">',
        `<infNFe Id="NFe${accessKey}" versao="4.00">`,
        '<ide>',
        '<emit>',
        '<det nItem="1">',
        '<total>',
        '<pag>',
        '<infNFeSupl>',
        '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
        '<DigestValue>',
        '<SignatureValue>',
        '<X509Certificate>'
    ];

    for (const snippet of requiredSnippets) {
        if (!signedXml.includes(snippet)) {
            errors.push(`XML assinado sem estrutura obrigatória: ${snippet}`);
        }
    }

    if (environment !== 'HOMOLOGACAO') {
        errors.push('Preparação NFC-e direta está liberada apenas para homologação nesta etapa.');
    }

    if (!qrCodeUrl.includes(accessKey)) {
        errors.push('QR Code não contém a chave de acesso gerada.');
    }

    if (!signedXml.includes('<tpAmb>2</tpAmb>')) {
        errors.push('XML de teste deve permanecer em ambiente de homologação.');
    }

    return { errors, warnings };
};

const prepareHomologationNfce = async({ secureStorageId, password, settings = {} }) => {
    const passphrase = String(password || '');
    if (!passphrase) {
        throw new Error('Informe a senha do certificado A1 para preparar o XML.');
    }

    const environment = settings.nfceEnvironment === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';
    if (environment !== 'HOMOLOGACAO') {
        throw new Error('Produção permanece bloqueada. Use homologação para preparar o XML de teste.');
    }

    const cnpj = onlyDigits(settings.cnpj);
    if (cnpj.length !== 14) {
        throw new Error('CNPJ do emitente deve conter 14 dígitos para preparar a NFC-e.');
    }

    if (!String(settings.cscId || '').trim() || !String(settings.cscCode || '').trim()) {
        throw new Error('Informe CSC ID e CSC de homologação antes de preparar o QR Code.');
    }

    const certificate = await loadSecureCertificateBuffer(secureStorageId);
    tls.createSecureContext({ pfx: certificate.buffer, passphrase });

    const issuedAt = new Date();
    const accessKey = buildNfceAccessKey({
        cnpj,
        serie: settings.nfceSerie || '1',
        number: settings.nfceNextNumber || '1',
        issuedAt
    });
    const qrCodeUrl = buildDevelopmentQrCodeUrl({
        accessKey,
        environment,
        cscId: settings.cscId,
        cscCode: settings.cscCode
    });
    const xml = buildHomologationNfceXml({ settings: { ...settings, cnpj }, accessKey, qrCodeUrl, issuedAt });
    const signed = signNfceXmlForHomologationPreparation({
        xml,
        accessKey,
        certificateBuffer: certificate.buffer,
        password: passphrase
    });
    const validation = validatePreparedNfceXml({
        signedXml: signed.signedXml,
        accessKey,
        environment,
        qrCodeUrl
    });

    return {
        accessKey,
        environment,
        serie: onlyDigits(settings.nfceSerie || '1').padStart(3, '0').slice(-3),
        number: onlyDigits(settings.nfceNextNumber || '1').padStart(9, '0').slice(-9),
        qrCodeUrl,
        xmlLength: xml.length,
        signedXmlLength: signed.signedXml.length,
        digestValue: signed.digestValue,
        referenceId: signed.referenceId,
        validation,
        preparedAt: new Date().toISOString()
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

ipcMain.handle('nfce:prepare-homologation', async(_event, input = {}) => {
    try {
        const result = await prepareHomologationNfce(input);
        writeStartupLog(`XML NFC-e de homologacao preparado: ${result.accessKey}.`);
        return { ok: true, result };
    } catch (error) {
        writeStartupLog('Falha ao preparar XML NFC-e de homologacao.', error);
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

