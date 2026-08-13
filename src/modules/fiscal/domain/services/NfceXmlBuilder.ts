import type { FiscalReceipt, ReceiptItem, ReceiptPayment } from '@/fiscal/types';
import type { DigitalCertificateSettings } from '@/shared/domain/services/digitalCertificateRules';
import type { XmlBuilder, XmlBuildResult } from '../ports/XmlBuilder';
import { gerarChaveAcesso } from './NfceKeyGenerator';

/**
 * NfceXmlBuilder
 * 
 * Monta o XML da NFC-e (modelo 65, layout 4.00) conforme NT 2015.002 e Manual de Orientação do Contribuinte.
 * 
 * Por enquanto usa template strings para evitar dependências externas.
 * Futuramente pode ser migrado para xmlbuilder2 ou libxmljs para maior robustez.
 */
export class NfceXmlBuilder implements XmlBuilder {
  async buildNfceXml(
    receipt: FiscalReceipt,
    certificateSettings: DigitalCertificateSettings,
    nextNumber: string
  ): Promise<XmlBuildResult> {
    const cnpj = receipt.emitente.cnpj.replace(/\D/g, '');
    const uf = receipt.emitente.endereco.uf;

    // Gera chave de acesso
    const chaveResult = gerarChaveAcesso({
      uf,
      dataEmissao: new Date(receipt.nfce.dataEmissao),
      cnpj,
      modelo: '65',
      serie: receipt.nfce.serie,
      numero: nextNumber,
      tipoEmissao: receipt.nfce.ambiente === 'PRODUCAO' ? '1' : '1', // Normal por padrão
    });

    const chaveAcesso = chaveResult.chaveAcesso;
    const numeroFormatado = nextNumber.padStart(9, '0');
    const serieFormatada = receipt.nfce.serie.padStart(3, '0');

    // Monta o XML
    const xml = this.montarXmlNfe(receipt, certificateSettings, {
      chaveAcesso,
      numero: numeroFormatado,
      serie: serieFormatada,
      cNF: chaveResult.codigoNumerico,
      dataEmissao: receipt.nfce.dataEmissao,
    });

    // URL do QR Code (será substituída pelo gateway real)
    const qrCodeUrl = receipt.nfce.qrCodeUrl || 
      `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${chaveAcesso}|2|1|${certificateSettings.cscId || ''}`;

    return {
      xml,
      accessKey: chaveAcesso,
      qrCodeUrl,
      numero: numeroFormatado,
      serie: serieFormatada,
    };
  }

  private montarXmlNfe(
    receipt: FiscalReceipt,
    cert: DigitalCertificateSettings,
    meta: { chaveAcesso: string; numero: string; serie: string; cNF: string; dataEmissao: string }
  ): string {
    const dataEmissaoISO = new Date(meta.dataEmissao).toISOString();
    const dataEmissaoFormatada = dataEmissaoISO.replace(/\.\d{3}Z$/, '-03:00'); // Ajuste fuso SP

    const emitCNPJ = receipt.emitente.cnpj.replace(/\D/g, '');
    const emitIE = (receipt.emitente.inscricaoEstadual || '').replace(/\D/g, '');

    const itensXml = receipt.itens.map((item, index) => this.montarDet(item, index + 1)).join('\n');
    const pagamentosXml = receipt.pagamentos.map(p => this.montarPagamento(p)).join('\n');

    const totalProdutos = receipt.totalProdutos.toFixed(2);
    const totalDocumento = receipt.totalDocumento.toFixed(2);
    const troco = (receipt.troco || 0).toFixed(2);

    // CSC para QR Code (será usado no gateway real)
    const cscId = cert.cscId || '';
    const cscCode = cert.cscCode || '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${meta.chaveAcesso}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${meta.cNF}</cNF>
      <natOp>Venda de mercadoria</natOp>
      <mod>65</mod>
      <serie>${meta.serie}</serie>
      <nNF>${meta.numero}</nNF>
      <dhEmi>${dataEmissaoFormatada}</dhEmi>
      <dhSaiEnt>${dataEmissaoFormatada}</dhSaiEnt>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${meta.chaveAcesso.slice(-1)}</cDV>
      <tpAmb>${receipt.nfce.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>PDVTouch 0.1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emitCNPJ}</CNPJ>
      <xNome>${this.escapeXml(receipt.emitente.razaoSocial)}</xNome>
      ${receipt.emitente.nomeFantasia ? `<xFant>${this.escapeXml(receipt.emitente.nomeFantasia)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${this.escapeXml(receipt.emitente.endereco.logradouro)}</xLgr>
        <nro>${receipt.emitente.endereco.numero}</nro>
        <xBairro>${this.escapeXml(receipt.emitente.endereco.bairro)}</xBairro>
        <cMun>3550308</cMun>
        <xMun>${this.escapeXml(receipt.emitente.endereco.municipio)}</xMun>
        <UF>${receipt.emitente.endereco.uf}</UF>
        <CEP>${receipt.emitente.endereco.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${emitIE}</IE>
      <CRT>1</CRT>
    </emit>
    ${receipt.consumidor?.cpfCnpj ? this.montarDest(receipt.consumidor) : ''}
    ${itensXml}
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
        <vProd>${totalProdutos}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${totalDocumento}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      ${pagamentosXml}
      <vTroco>${troco}</vTroco>
    </pag>
    ${receipt.nfce.ambiente === 'HOMOLOGACAO' ? '<infAdic><infCpl>EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</infCpl></infAdic>' : ''}
  </infNFe>
</NFe>`;
  }

  private montarDet(item: ReceiptItem, nItem: number): string {
    const vUnCom = item.valorUnitario.toFixed(2);
    const vProd = item.valorTotal.toFixed(2);
    const qCom = item.quantidade.toFixed(3);
    const ncm = (item.ncm || '21069090').replace(/\D/g, '').padStart(8, '0');
    const cfop = item.cfop || '5102';
    const cst = item.cstCsosn || '102';

    return `    <det nItem="${nItem}">
      <prod>
        <cProd>${this.escapeXml(item.codigo)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${this.escapeXml(item.descricao)}</xProd>
        <NCM>${ncm}</NCM>
        <CFOP>${cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${qCom}</qCom>
        <vUnCom>${vUnCom}</vUnCom>
        <vProd>${vProd}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${item.unidade}</uTrib>
        <qTrib>${qCom}</qTrib>
        <vUnTrib>${vUnCom}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>${cst}</CSOSN>
            <pCredSN>0.00</pCredSN>
            <vCredICMSSN>0.00</vCredICMSSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISOutr>
            <CST>99</CST>
            <vBC>0.00</vBC>
            <pPIS>0.00</pPIS>
            <vPIS>0.00</vPIS>
          </PISOutr>
        </PIS>
        <COFINS>
          <COFINSOutr>
            <CST>99</CST>
            <vBC>0.00</vBC>
            <pCOFINS>0.00</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSOutr>
        </COFINS>
      </imposto>
    </det>`;
  }

  private montarPagamento(pag: ReceiptPayment): string {
    const tPagMap: Record<string, string> = {
      DINHEIRO: '01',
      PIX: '17',
      CARTAO_CREDITO: '03',
      CARTAO_DEBITO: '04',
      VALE: '10',
      OUTROS: '99',
    };

    const tPag = tPagMap[pag.tipo] || '99';
    const vPag = pag.valor.toFixed(2);

    return `      <detPag>
        <tPag>${tPag}</tPag>
        <vPag>${vPag}</vPag>
      </detPag>`;
  }

  private montarDest(consumidor: { nome?: string; cpfCnpj?: string }): string {
    if (!consumidor.cpfCnpj) return '';

    const doc = consumidor.cpfCnpj.replace(/\D/g, '');
    const isCpf = doc.length === 11;

    return `    <dest>
      ${isCpf ? `<CPF>${doc}</CPF>` : `<CNPJ>${doc}</CNPJ>`}
      ${consumidor.nome ? `<xNome>${this.escapeXml(consumidor.nome)}</xNome>` : ''}
    </dest>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
