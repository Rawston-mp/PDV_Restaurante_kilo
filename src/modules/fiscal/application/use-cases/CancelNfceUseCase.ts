import type { FiscalGateway } from '../../domain/ports/FiscalGateway';
import type { FiscalDocumentRepository } from '../../domain/ports/FiscalDocumentRepository';

/**
 * CancelNfceUseCase
 *
 * Cancela uma NFC-e já autorizada.
 * Requisitos SEFAZ:
 * - Justificativa com no mínimo 15 caracteres
 * - Prazo máximo de 30 dias após autorização (regra SEFAZ-SP)
 */
export class CancelNfceUseCase {
  constructor(
    private gateway: FiscalGateway,
    private documentRepository: FiscalDocumentRepository
  ) {}

  async execute(params: {
    documentId: string;
    justificativa: string;
  }): Promise<{
    success: boolean;
    protocoloCancelamento?: string;
    cstat?: string;
    xmotivo?: string;
    error?: string;
  }> {
    if (params.justificativa.length < 15) {
      return {
        success: false,
        error: 'Justificativa deve ter no mínimo 15 caracteres',
      };
    }

    const document = await this.documentRepository.findById(params.documentId);
    if (!document) {
      return { success: false, error: 'Documento fiscal não encontrado' };
    }

    if (document.status !== 'AUTHORIZED') {
      return { success: false, error: 'Apenas NFC-e autorizadas podem ser canceladas' };
    }

    if (!document.protocol) {
      return { success: false, error: 'Protocolo de autorização ausente' };
    }

    try {
      const result = await this.gateway.cancelNfce({
        chaveAcesso: document.accessKey,
        justificativa: params.justificativa,
        protocoloAutorizacao: document.protocol,
      });

      if (result.status === 'CANCELLED') {
        // Atualiza documento no repositório
        document.status = 'CANCELLED';
        document.cancelledAt = new Date();
        await this.documentRepository.save(document);

        return {
          success: true,
          protocoloCancelamento: result.protocoloCancelamento,
          cstat: result.cstat,
          xmotivo: result.xmotivo,
        };
      }

      return {
        success: false,
        cstat: result.cstat,
        xmotivo: result.xmotivo,
        error: 'Cancelamento rejeitado pela SEFAZ',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao cancelar NFC-e',
      };
    }
  }
}
