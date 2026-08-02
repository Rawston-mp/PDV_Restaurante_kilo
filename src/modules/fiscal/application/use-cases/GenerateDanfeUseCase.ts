import type { FiscalDocument } from '../../domain/entities/FiscalDocument';
import type { FiscalReceipt } from '@/fiscal/types';
import QRCode from 'qrcode';

/**
 * GenerateDanfeUseCase
 *
 * Gera o DANFE NFC-e (Documento Auxiliar da Nota Fiscal Eletrônica de Consumidor).
 * Para NFC-e, o DANFE é geralmente um cupom simplificado impresso em impressora térmica,
 * contendo:
 * - Chave de acesso
 * - QR Code (modelo 2)
 * - Protocolo de autorização
 * - Itens, totais e pagamentos
 * - Marca d'água de homologação (se aplicável)
 *
 * Integra com o sistema de impressão térmica existente (escpos).
 */
export class GenerateDanfeUseCase {
  /**
   * Gera o texto do DANFE NFC-e formatado para impressão térmica.
   * Gera QR Code real (modelo 2) usando a biblioteca qrcode.
   */
  async execute(params: {
    document: FiscalDocument;
    receipt: FiscalReceipt;
    qrCodeUrl?: string; // URL do QR Code (modelo 2) – se não informado, será gerado
  }): Promise<{
    success: boolean;
    danfeText: string;
    qrCodeAscii?: string; // QR Code em ASCII para impressão térmica
    error?: string;
  }> {
    try {
      const { document, receipt } = params;
      const isHomologacao = document.environment === 'HOMOLOGACAO';

      let danfe = '';

      // Cabeçalho
      danfe += this.center('=== DANFE NFC-e ===') + '\n';
      danfe += this.center(receipt.emitente.nomeFantasia || receipt.emitente.razaoSocial) + '\n';
      danfe += this.center(
        `${receipt.emitente.endereco.logradouro}, ${receipt.emitente.endereco.numero}`
      ) + '\n';
      danfe += this.center(
        `${receipt.emitente.endereco.bairro} - ${receipt.emitente.endereco.municipio}/${receipt.emitente.endereco.uf}`
      ) + '\n';
      danfe += '\n';

      // Status / Homologação
      if (isHomologacao) {
        danfe += this.center('*** AMBIENTE DE HOMOLOGACAO ***') + '\n';
        danfe += this.center('SEM VALOR FISCAL') + '\n\n';
      }

      // Dados da NFC-e
      danfe += `Chave: ${document.accessKey}\n`;
      danfe += `Protocolo: ${document.protocol || 'N/A'}\n`;
      danfe += `Emissão: ${new Date(document.issuedAt).toLocaleString('pt-BR')}\n`;
      danfe += `Série/Número: ${document.series}/${document.number}\n`;
      danfe += '\n';

      // Itens
      danfe += '--- ITENS ---\n';
      receipt.itens.forEach((item, index) => {
        danfe += `${index + 1}. ${item.descricao}\n`;
        danfe += `   ${item.quantidade} ${item.unidade} x R$ ${item.valorUnitario.toFixed(2)} = R$ ${item.valorTotal.toFixed(2)}\n`;
      });
      danfe += '\n';

      // Totais
      danfe += '--- TOTAIS ---\n';
      danfe += `Subtotal: R$ ${receipt.totalProdutos.toFixed(2)}\n`;
      if (receipt.descontoTotal > 0) {
        danfe += `Desconto: R$ ${receipt.descontoTotal.toFixed(2)}\n`;
      }
      danfe += `TOTAL: R$ ${receipt.totalDocumento.toFixed(2)}\n`;
      if (receipt.troco && receipt.troco > 0) {
        danfe += `Troco: R$ ${receipt.troco.toFixed(2)}\n`;
      }
      danfe += '\n';

      // Pagamentos
      danfe += '--- PAGAMENTOS ---\n';
      receipt.pagamentos.forEach((pag) => {
        danfe += `${pag.tipo}: R$ ${pag.valor.toFixed(2)}\n`;
      });
      danfe += '\n';

      // QR Code
      let qrCodeAscii: string | undefined;
      const qrUrl = params.qrCodeUrl || document.qrCodeUrl;

      if (qrUrl) {
        try {
          qrCodeAscii = await QRCode.toString(qrUrl, {
            type: 'terminal',
            small: true,
          });
          danfe += this.center('--- QR CODE ---') + '\n';
          danfe += qrCodeAscii + '\n';
        } catch {
          danfe += this.center('Consulte pela chave de acesso') + '\n';
        }
      } else {
        danfe += this.center('Consulte pela chave de acesso') + '\n\n';
      }

      // Rodapé
      danfe += this.center('Obrigado pela preferência!') + '\n';
      danfe += this.center(new Date().toLocaleString('pt-BR')) + '\n';

      return {
        success: true,
        danfeText: danfe,
        qrCodeAscii,
      };
    } catch (error: any) {
      return {
        success: false,
        danfeText: '',
        error: error.message || 'Erro ao gerar DANFE',
      };
    }
  }

  private center(text: string, width: number = 40): string {
    if (text.length >= width) return text;
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(padding) + text;
  }
}
