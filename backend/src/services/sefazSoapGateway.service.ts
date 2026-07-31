import fs from 'node:fs';
import https from 'node:https';

export type SefazAuthorizationStatus = 'AUTHORIZED' | 'REJECTED' | 'MANUAL_REVIEW' | 'OFFLINE';

export type SefazAuthorizationResult = {
  status: SefazAuthorizationStatus;
  accessKey?: string;
  protocol?: string;
  qrCodeUrl?: string;
  authorizedXml?: string;
  cstat?: string;
  xmotivo?: string;
  lastError?: string;
  authorizedAt?: string;
};

type FiscalReceiptLike = {
  tipo?: string;
  emitente?: {
    razaoSocial?: string;
    nomeFantasia?: string;
    cnpj?: string;
    inscricaoEstadual?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  nfce?: {
    serie?: string;
    numero?: string;
    chaveAcesso?: string;
    dataEmissao?: string;
    ambiente?: 'HOMOLOGACAO' | 'PRODUCAO';
    qrCodeUrl?: string;
  };
  itens?: Array<{
    codigo?: string;
    descricao?: string;
    ncm?: string;
    cfop?: string;
    unidade?: string;
    quantidade?: number;
    valorUnitario?: number;
    valorTotal?: number;
    cstCsosn?: string;
  }>;
  pagamentos?: Array<{
    tipo?: string;
    valor?: number;
  }>;
  totalProdutos?: number;
  descontoTotal?: number;
  acrescimoTotal?: number;
  totalDocumento?: number;
};

type SoapPostInput = {
  url: string;
  soapAction: string;
  envelope: string;
  pfxPath: string;
  passphrase: string;
  timeoutMs: number;
};

const SEFAZ_SP_AUTHORIZATION_URLS: Record<'HOMOLOGACAO' | 'PRODUCAO', string> = {
  HOMOLOGACAO: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
  PRODUCAO: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
};

const normalizeDigits = (value?: string) => String(value ?? '').replace(/\D/g, '');

const escapeXml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toDecimal = (value: unknown, fractionDigits = 2) => {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return parsed.toFixed(fractionDigits);
};

const resolveEnvironment = (receipt: FiscalReceiptLike) =>
  receipt.nfce?.ambiente === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

export const calculateNfeCheckDigit = (accessKeyWithoutDigit: string) => {
  const digits = normalizeDigits(accessKeyWithoutDigit);
  let factor = 2;
  let sum = 0;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += Number(digits[index]) * factor;
    factor = factor === 9 ? 2 : factor + 1;
  }

  const mod = sum % 11;
  const digit = 11 - mod;
  return digit >= 10 ? '0' : String(digit);
};

const resolveAccessKey = (receipt: FiscalReceiptLike) => {
  const configuredKey = normalizeDigits(receipt.nfce?.chaveAcesso);
  if (configuredKey.length === 44) {
    return configuredKey;
  }

  const cnpj = normalizeDigits(receipt.emitente?.cnpj).padStart(14, '0').slice(-14);
  const serie = normalizeDigits(receipt.nfce?.serie).padStart(3, '0').slice(-3);
  const numero = normalizeDigits(receipt.nfce?.numero).padStart(9, '0').slice(-9);
  const cuf = '35';
  const aamm = new Date().toISOString().slice(2, 7).replace('-', '');
  const modelo = '65';
  const tpEmis = '1';
  const codigoNumerico = numero.padStart(8, '0').slice(-8);
  const withoutDigit = `${cuf}${aamm}${cnpj}${modelo}${serie}${numero}${tpEmis}${codigoNumerico}`;
  return `${withoutDigit}${calculateNfeCheckDigit(withoutDigit)}`;
};

const mapPaymentTypeToNfe = (type?: string) => {
  switch (type) {
    case 'DINHEIRO':
      return '01';
    case 'CARTAO_CREDITO':
      return '03';
    case 'CARTAO_DEBITO':
      return '04';
    case 'PIX':
      return '17';
    default:
      return '99';
  }
};

export const buildUnsignedNfceXml = (receipt: FiscalReceiptLike) => {
  const environment = resolveEnvironment(receipt);
  const accessKey = resolveAccessKey(receipt);
  const issueDate = receipt.nfce?.dataEmissao || new Date().toISOString();
  const items = Array.isArray(receipt.itens) ? receipt.itens : [];
  const payments = Array.isArray(receipt.pagamentos) ? receipt.pagamentos : [];
  const emitter = receipt.emitente ?? {};
  const address = emitter.endereco ?? {};

  const itemXml = items.map((item, index) => {
    const itemNumber = index + 1;
    const quantityFraction = item.unidade === 'KG' ? 3 : 4;

    return `
      <det nItem="${itemNumber}">
        <prod>
          <cProd>${escapeXml(item.codigo || itemNumber)}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${escapeXml(item.descricao)}</xProd>
          <NCM>${escapeXml(normalizeDigits(item.ncm) || '00000000')}</NCM>
          <CFOP>${escapeXml(normalizeDigits(item.cfop) || '5102')}</CFOP>
          <uCom>${escapeXml(item.unidade || 'UN')}</uCom>
          <qCom>${toDecimal(item.quantidade, quantityFraction)}</qCom>
          <vUnCom>${toDecimal(item.valorUnitario, 10)}</vUnCom>
          <vProd>${toDecimal(item.valorTotal)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${escapeXml(item.unidade || 'UN')}</uTrib>
          <qTrib>${toDecimal(item.quantidade, quantityFraction)}</qTrib>
          <vUnTrib>${toDecimal(item.valorUnitario, 10)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN102>
              <orig>0</orig>
              <CSOSN>${escapeXml(item.cstCsosn || '102')}</CSOSN>
            </ICMSSN102>
          </ICMS>
          <PIS><PISNT><CST>07</CST></PISNT></PIS>
          <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
        </imposto>
      </det>`;
  }).join('');

  const paymentXml = payments.length > 0
    ? payments.map((payment) => `
      <detPag>
        <tPag>${mapPaymentTypeToNfe(payment.tipo)}</tPag>
        <vPag>${toDecimal(payment.valor)}</vPag>
      </detPag>`).join('')
    : '<detPag><tPag>01</tPag><vPag>0.00</vPag></detPag>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${accessKey}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${accessKey.slice(35, 43)}</cNF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>${escapeXml(receipt.nfce?.serie || '1')}</serie>
      <nNF>${escapeXml(receipt.nfce?.numero || '1')}</nNF>
      <dhEmi>${escapeXml(issueDate)}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${accessKey.slice(-1)}</cDV>
      <tpAmb>${environment === 'PRODUCAO' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>PDVTouch</verProc>
    </ide>
    <emit>
      <CNPJ>${escapeXml(normalizeDigits(emitter.cnpj))}</CNPJ>
      <xNome>${escapeXml(emitter.razaoSocial)}</xNome>
      <xFant>${escapeXml(emitter.nomeFantasia || emitter.razaoSocial)}</xFant>
      <enderEmit>
        <xLgr>${escapeXml(address.logradouro)}</xLgr>
        <nro>${escapeXml(address.numero)}</nro>
        <xBairro>${escapeXml(address.bairro)}</xBairro>
        <cMun>3550308</cMun>
        <xMun>${escapeXml(address.municipio || 'São Paulo')}</xMun>
        <UF>SP</UF>
        <CEP>${escapeXml(normalizeDigits(address.cep))}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${escapeXml(normalizeDigits(emitter.inscricaoEstadual))}</IE>
      <CRT>1</CRT>
    </emit>${itemXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${toDecimal(receipt.totalProdutos)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg>
        <vDesc>${toDecimal(receipt.descontoTotal)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS>
        <vOutro>${toDecimal(receipt.acrescimoTotal)}</vOutro><vNF>${toDecimal(receipt.totalDocumento)}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>${paymentXml}</pag>
  </infNFe>
</NFe>`;
};

export const buildNfceAuthorizationSoapEnvelope = (signedXml: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <idLote>1</idLote>
        <indSinc>1</indSinc>
        ${signedXml}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

const validateReceiptForSefaz = (receipt: FiscalReceiptLike) => {
  const errors = [
    receipt.tipo !== 'NFCE' ? 'Documento precisa ser NFC-e.' : null,
    normalizeDigits(receipt.emitente?.cnpj).length !== 14 ? 'CNPJ do emitente inválido.' : null,
    normalizeDigits(receipt.emitente?.inscricaoEstadual).length !== 12 ? 'Inscrição estadual de SP deve conter 12 dígitos.' : null,
    !receipt.emitente?.razaoSocial?.trim() ? 'Razão social do emitente não informada.' : null,
    !receipt.nfce?.serie?.trim() ? 'Série NFC-e não informada.' : null,
    !receipt.nfce?.numero?.trim() ? 'Número NFC-e não informado.' : null,
    !Array.isArray(receipt.itens) || receipt.itens.length === 0 ? 'NFC-e sem itens.' : null
  ].filter(Boolean) as string[];

  return errors;
};

const postSoap = ({ url, soapAction, envelope, pfxPath, passphrase, timeoutMs }: SoapPostInput) => new Promise<string>((resolve, reject) => {
  const requestUrl = new URL(url);
  const body = Buffer.from(envelope, 'utf8');
  const request = https.request({
    hostname: requestUrl.hostname,
    path: `${requestUrl.pathname}${requestUrl.search}`,
    port: requestUrl.port || 443,
    method: 'POST',
    pfx: fs.readFileSync(pfxPath),
    passphrase,
    timeout: timeoutMs,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      SOAPAction: soapAction,
      'Content-Length': body.length
    }
  }, (response) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => {
      const responseBody = Buffer.concat(chunks).toString('utf8');
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`SEFAZ HTTP ${response.statusCode}: ${responseBody.slice(0, 500)}`));
        return;
      }
      resolve(responseBody);
    });
  });

  request.on('timeout', () => {
    request.destroy(new Error('Tempo esgotado ao conectar com a SEFAZ.'));
  });
  request.on('error', reject);
  request.end(body);
});

const parseSefazResponse = (responseXml: string, receipt: FiscalReceiptLike): SefazAuthorizationResult => {
  const cstat = responseXml.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const xmotivo = responseXml.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1] ?? 'Retorno SEFAZ recebido sem motivo detalhado.';
  const protocol = responseXml.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const authorizedAt = responseXml.match(/<dhRecbto>(.*?)<\/dhRecbto>/)?.[1] ?? new Date().toISOString();
  const accessKey = resolveAccessKey(receipt);

  if (cstat === '100' && protocol) {
    return {
      status: 'AUTHORIZED',
      accessKey,
      protocol,
      qrCodeUrl: receipt.nfce?.qrCodeUrl,
      authorizedXml: responseXml,
      cstat,
      xmotivo,
      authorizedAt
    };
  }

  return {
    status: 'REJECTED',
    cstat: cstat ?? 'SEFAZ_REJECTED',
    xmotivo,
    lastError: xmotivo
  };
};

export const authorizeNfceWithSefazSoap = async (receipt: FiscalReceiptLike): Promise<SefazAuthorizationResult> => {
  const validationErrors = validateReceiptForSefaz(receipt);
  if (validationErrors.length > 0) {
    return {
      status: 'REJECTED',
      cstat: 'PDV_VALIDATION',
      xmotivo: validationErrors.join(' '),
      lastError: validationErrors.join(' ')
    };
  }

  if (process.env.SEFAZ_SOAP_ENABLED !== 'true') {
    return {
      status: 'MANUAL_REVIEW',
      cstat: 'SEFAZ_SOAP_DISABLED',
      xmotivo: 'Gateway SOAP próprio criado, mas transmissão real está desativada. Ative SEFAZ_SOAP_ENABLED=true somente em homologação controlada.',
      lastError: 'Transmissão SOAP desativada por configuração.'
    };
  }

  if (process.env.SEFAZ_SOAP_ALLOW_UNSIGNED !== 'true') {
    return {
      status: 'MANUAL_REVIEW',
      cstat: 'XML_SIGNATURE_REQUIRED',
      xmotivo: 'XML NFC-e montado, mas assinatura digital XML ainda precisa ser implementada antes do envio real à SEFAZ.',
      lastError: 'Assinatura XML não implementada.'
    };
  }

  const pfxPath = process.env.SEFAZ_A1_PFX_PATH?.trim();
  const passphrase = process.env.SEFAZ_A1_PASSWORD ?? '';
  if (!pfxPath || !fs.existsSync(pfxPath)) {
    return {
      status: 'MANUAL_REVIEW',
      cstat: 'CERTIFICATE_NOT_FOUND',
      xmotivo: 'Certificado A1 não encontrado no backend. Configure SEFAZ_A1_PFX_PATH e SEFAZ_A1_PASSWORD.',
      lastError: 'Certificado A1 indisponível para o processo fiscal.'
    };
  }

  const unsignedXml = buildUnsignedNfceXml(receipt);
  const envelope = buildNfceAuthorizationSoapEnvelope(unsignedXml);
  const url = SEFAZ_SP_AUTHORIZATION_URLS[resolveEnvironment(receipt)];

  try {
    const responseXml = await postSoap({
      url,
      soapAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      envelope,
      pfxPath,
      passphrase,
      timeoutMs: Number(process.env.SEFAZ_SOAP_TIMEOUT_MS ?? 15000)
    });
    return parseSefazResponse(responseXml, receipt);
  } catch (error) {
    return {
      status: 'OFFLINE',
      lastError: error instanceof Error ? error.message : 'Falha temporária ao conectar com a SEFAZ.'
    };
  }
};
