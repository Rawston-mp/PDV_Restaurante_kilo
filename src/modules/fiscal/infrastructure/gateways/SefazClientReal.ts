import type { SefazClient, SefazClientConfig } from '../../domain/ports/SefazClient';
import type { FiscalAuthorizationResult } from '../../domain/ports/FiscalGateway';
import https from 'https';
import { URL } from 'url';

/**
 * SefazClientReal
 *
 * Cliente real para comunicação com os webservices da SEFAZ-SP.
 * Implementa chamadas SOAP para:
 * - NFeAutorizacao4
 * - NFeRetAutorizacao4
 * - NFeConsultaProtocolo4
 * - NFeCancelamento4
 *
 * NOTA: Esta é uma implementação estruturada. Para uso em produção,
 * é necessário:
 * 1. Certificado A1 válido carregado no agente HTTPS
 * 2. Endpoints corretos da SEFAZ-SP (homologação/produção)
 * 3. Tratamento completo de namespaces SOAP e WS-Security
 */
export class SefazClientReal implements SefazClient {
  private config: SefazClientConfig;

  // Endpoints SEFAZ-SP (exemplos - devem ser validados)
  private readonly endpoints = {
    HOMOLOGACAO: {
      autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      retorno: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
      consulta: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      cancelamento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfecancelamento4.asmx',
    },
    PRODUCAO: {
      autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      retorno: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
      consulta: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      cancelamento: 'https://nfe.fazenda.sp.gov.br/ws/nfecancelamento4.asmx',
    },
  };

  constructor(config: SefazClientConfig) {
    this.config = config;
  }

  async transmitirLote(xmlAssinado: string, loteId: string): Promise<FiscalAuthorizationResult> {
    const endpoint =
      this.config.ambiente === 'PRODUCAO'
        ? this.endpoints.PRODUCAO.autorizacao
        : this.endpoints.HOMOLOGACAO.autorizacao;

    const soapEnvelope = this.buildAutorizacaoEnvelope(xmlAssinado, loteId);

    try {
      const responseXml = await this.postSoap(
        endpoint,
        soapEnvelope,
        'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote'
      );

      return this.parseAutorizacaoResponse(responseXml);
    } catch (error: any) {
      if (this.isNetworkError(error)) {
        return { status: 'OFFLINE', lastError: 'Sem comunicação com SEFAZ' };
      }
      throw error;
    }
  }

  async consultarRetornoLote(recibo: string): Promise<FiscalAuthorizationResult> {
    const endpoint =
      this.config.ambiente === 'PRODUCAO'
        ? this.endpoints.PRODUCAO.retorno
        : this.endpoints.HOMOLOGACAO.retorno;

    const soapEnvelope = this.buildRetornoEnvelope(recibo);

    const responseXml = await this.postSoap(
      endpoint,
      soapEnvelope,
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote'
    );

    return this.parseRetornoResponse(responseXml);
  }

  async consultarStatusChave(chaveAcesso: string): Promise<FiscalAuthorizationResult> {
    const endpoint =
      this.config.ambiente === 'PRODUCAO'
        ? this.endpoints.PRODUCAO.consulta
        : this.endpoints.HOMOLOGACAO.consulta;

    const soapEnvelope = this.buildConsultaEnvelope(chaveAcesso);

    const responseXml = await this.postSoap(
      endpoint,
      soapEnvelope,
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF'
    );

    return this.parseConsultaResponse(responseXml);
  }

  async cancelarNfce(
    chaveAcesso: string,
    justificativa: string,
    protocoloAutorizacao: string
  ): Promise<{
    status: 'CANCELLED' | 'REJECTED';
    protocoloCancelamento?: string;
    cstat: string;
    xmotivo: string;
  }> {
    const endpoint =
      this.config.ambiente === 'PRODUCAO'
        ? this.endpoints.PRODUCAO.cancelamento
        : this.endpoints.HOMOLOGACAO.cancelamento;

    const soapEnvelope = this.buildCancelamentoEnvelope(
      chaveAcesso,
      justificativa,
      protocoloAutorizacao
    );

    const responseXml = await this.postSoap(
      endpoint,
      soapEnvelope,
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeCancelamento4/nfeCancelamento'
    );

    return this.parseCancelamentoResponse(responseXml);
  }

  private async postSoap(endpoint: string, soapEnvelope: string, soapAction: string): Promise<string> {
    const url = new URL(endpoint);
    const timeoutMs = this.config.timeoutMs || 30000;

    const pfxOption = this.config.certificatePfx
      ? (typeof this.config.certificatePfx === 'string' ? Buffer.from(this.config.certificatePfx, 'base64') : this.config.certificatePfx)
      : undefined;

    const agent = new https.Agent({ pfx: pfxOption, passphrase: this.config.certificatePassword });

    return await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            SOAPAction: soapAction,
            'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
          },
          agent,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            const responseText = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseText);
            } else {
              reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${responseText.slice(0, 300)}`));
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy(new Error('AbortError: request timeout'));
      });

      req.write(soapEnvelope, 'utf8');
      req.end();
    });
  }

  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === 'AbortError' || /fetch|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(error.message);
  }

  // ==================== ENVELOPES SOAP ====================

  private buildAutorizacaoEnvelope(xmlAssinado: string, loteId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <envioLoteNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <idLote>${loteId}</idLote>
        <indSinc>0</indSinc>
        ${xmlAssinado}
      </envioLoteNFe>
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildRetornoEnvelope(recibo: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${this.config.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
        <nRec>${recibo}</nRec>
      </consReciNFe>
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildConsultaEnvelope(chaveAcesso: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">
      <consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${this.config.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
        <xServ>CONSULTAR</xServ>
        <chNFe>${chaveAcesso}</chNFe>
      </consSitNFe>
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  private buildCancelamentoEnvelope(
    chaveAcesso: string,
    justificativa: string,
    protocolo: string
  ): string {
    const cnpj = chaveAcesso.substring(6, 20); // Extrai CNPJ da chave
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeCancelamento4">
      <envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <idLote>1</idLote>
        <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
          <infEvento Id="ID110111${chaveAcesso}01">
            <cOrgao>35</cOrgao>
            <tpAmb>${this.config.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
            <CNPJ>${cnpj}</CNPJ>
            <chNFe>${chaveAcesso}</chNFe>
            <dhEvento>${new Date().toISOString()}</dhEvento>
            <tpEvento>110111</tpEvento>
            <nSeqEvento>1</nSeqEvento>
            <verEvento>1.00</verEvento>
            <detEvento versao="1.00">
              <descEvento>Cancelamento</descEvento>
              <nProt>${protocolo}</nProt>
              <xJust>${justificativa}</xJust>
            </detEvento>
          </infEvento>
        </evento>
      </envEvento>
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  // ==================== PARSERS ====================

  private parseAutorizacaoResponse(xml: string): FiscalAuthorizationResult {
    // TODO: Implementar parser real do XML de resposta da SEFAZ
    // Por enquanto retorna estrutura esperada
    if (xml.includes('<cStat>100</cStat>')) {
      return {
        status: 'AUTHORIZED',
        accessKey: this.extractTag(xml, 'chNFe') || '',
        protocol: this.extractTag(xml, 'nProt') || '',
        qrCodeUrl: this.extractTag(xml, 'qrCode') || '',
        cstat: '100',
        xmotivo: this.extractTag(xml, 'xMotivo') || 'Autorizado',
        authorizedAt: new Date(),
      };
    }

    return {
      status: 'REJECTED',
      cstat: this.extractTag(xml, 'cStat') || '999',
      xmotivo: this.extractTag(xml, 'xMotivo') || 'Rejeitado',
    };
  }

  private parseRetornoResponse(xml: string): FiscalAuthorizationResult {
    return this.parseAutorizacaoResponse(xml);
  }

  private parseConsultaResponse(xml: string): FiscalAuthorizationResult {
    return this.parseAutorizacaoResponse(xml);
  }

  private parseCancelamentoResponse(xml: string): {
    status: 'CANCELLED' | 'REJECTED';
    protocoloCancelamento?: string;
    cstat: string;
    xmotivo: string;
  } {
    if (xml.includes('<cStat>101</cStat>') || xml.includes('<cStat>151</cStat>')) {
      return {
        status: 'CANCELLED',
        protocoloCancelamento: this.extractTag(xml, 'nProt') || '',
        cstat: this.extractTag(xml, 'cStat') || '101',
        xmotivo: this.extractTag(xml, 'xMotivo') || 'Cancelado',
      };
    }

    return {
      status: 'REJECTED',
      cstat: this.extractTag(xml, 'cStat') || '999',
      xmotivo: this.extractTag(xml, 'xMotivo') || 'Erro ao cancelar',
    };
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`);
    const match = xml.match(regex);
    return match ? match[1] : null;
  }
}
