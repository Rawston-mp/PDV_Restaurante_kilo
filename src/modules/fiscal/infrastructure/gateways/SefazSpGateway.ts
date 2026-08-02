import type { FiscalReceipt } from '@/fiscal/types';
import type {
  FiscalAuthorizationResult,
  FiscalGateway,
} from '../../domain/ports/FiscalGateway';
import type { SefazClient, SefazClientConfig } from '../../domain/ports/SefazClient';

/**
 * SefazSpGateway
 *
 * Implementação REAL do gateway fiscal para SEFAZ-SP.
 * Responsável por:
 * - Montar lote NFC-e assinado
 * - Transmitir para NFeAutorizacao4
 * - Consultar retorno (NFeRetAutorizacao4)
 * - Tratar contingência
 * - Cancelamento e inutilização
 *
 * NOTA: Esta implementação ainda é um esqueleto estruturado.
 * A integração real com os webservices da SEFAZ-SP (SOAP) deve ser completada
 * com certificado válido em ambiente de homologação.
 */
export class SefazSpGateway implements FiscalGateway {
  private client: SefazClient;
  private config: SefazClientConfig;

  constructor(client: SefazClient, config: SefazClientConfig) {
    this.client = client;
    this.config = config;
  }

  async authorizeNfce(receipt: FiscalReceipt): Promise<FiscalAuthorizationResult> {
    try {
      // 1. Validações preliminares
      if (!receipt.nfce.chaveAcesso || receipt.nfce.chaveAcesso.length !== 44) {
        return {
          status: 'REJECTED',
          cstat: '999',
          xmotivo: 'Chave de acesso inválida ou ausente',
        };
      }

      // 2. Verifica se está em contingência
      if (this.isContingencyMode()) {
        return this.handleContingency(receipt);
      }

      // 3. Transmite para SEFAZ (NFeAutorizacao4)
      // TODO: Implementar envelope SOAP real + certificado A1
      const result = await this.client.transmitirLote(
        receipt.nfce.chaveAcesso, // placeholder - deveria ser o XML assinado completo
        `LOTE-${Date.now()}`
      );

      return result;
    } catch (error: any) {
      // 4. Fallback para contingência em caso de erro de comunicação
      if (this.isOfflineError(error)) {
        return {
          status: 'OFFLINE',
          lastError: 'Sem comunicação com SEFAZ. NFC-e registrada para envio posterior.',
        };
      }

      return {
        status: 'REJECTED',
        cstat: '999',
        xmotivo: error.message || 'Erro desconhecido na autorização',
        lastError: error.message,
      };
    }
  }

  async cancelNfce(params: {
    chaveAcesso: string;
    justificativa: string;
    protocoloAutorizacao: string;
  }): Promise<{
    status: 'CANCELLED' | 'REJECTED';
    protocoloCancelamento?: string;
    cstat: string;
    xmotivo: string;
  }> {
    try {
      return await this.client.cancelarNfce(
        params.chaveAcesso,
        params.justificativa,
        params.protocoloAutorizacao
      );
    } catch (error: any) {
      return {
        status: 'REJECTED',
        cstat: '999',
        xmotivo: error.message || 'Erro ao cancelar NFC-e',
      };
    }
  }

  async consultarStatus(chaveAcesso: string): Promise<FiscalAuthorizationResult> {
    try {
      return await this.client.consultarStatusChave(chaveAcesso);
    } catch (error: any) {
      return {
        status: 'REJECTED',
        cstat: '999',
        xmotivo: error.message || 'Erro ao consultar status',
        lastError: error.message,
      };
    }
  }

  /**
   * Verifica se o sistema está operando em modo contingência
   */
  private isContingencyMode(): boolean {
    // TODO: Implementar lógica real (ex: flag em configuração ou status do serviço SEFAZ)
    return false;
  }

  /**
   * Trata emissão em contingência (SVC-AN ou FS-DA)
   */
  private handleContingency(receipt: FiscalReceipt): FiscalAuthorizationResult {
    // Em contingência, a NFC-e é emitida localmente com tipo de emissão 6 ou 7
    // e posteriormente regularizada quando o serviço voltar
    return {
      status: 'MANUAL_REVIEW',
      cstat: '108',
      xmotivo: 'Emitido em contingência. Regularizar quando o serviço SEFAZ voltar.',
      lastError: 'Contingência ativada',
    };
  }

  /**
   * Detecta erro de comunicação offline
   */
  private isOfflineError(error: any): boolean {
    const offlineMessages = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'offline', 'timeout'];
    const message = (error.message || '').toLowerCase();
    return offlineMessages.some((m) => message.includes(m));
  }
}
