import type { FiscalDocumentRepository } from '../../domain/ports/FiscalDocumentRepository';
import type { FiscalQueueRepository } from '../../domain/ports/FiscalQueueRepository';

/**
 * FiscalWebhookService
 *
 * Serviço para processar webhooks de status fiscal enviados pela SEFAZ ou pelo gateway.
 * Permite que a SEFAZ notifique o PDVTouch sobre mudanças de status de forma assíncrona.
 *
 * Endpoint sugerido: POST /v1/fiscal/webhooks/status
 */
export class FiscalWebhookService {
  constructor(
    private documentRepo: FiscalDocumentRepository,
    private queueRepo: FiscalQueueRepository
  ) {}

  /**
   * Processa uma notificação de status vinda da SEFAZ/gateway
   */
  async handleStatusWebhook(payload: {
    accessKey: string;
    status: 'AUTHORIZED' | 'REJECTED' | 'CANCELLED';
    protocol?: string;
    cstat: string;
    xmotivo: string;
    authorizedXml?: string;
    qrCodeUrl?: string;
  }): Promise<{
    success: boolean;
    documentId?: string;
    error?: string;
  }> {
    // Busca documento pela chave de acesso
    const documents = await this.documentRepo.list();
    const document = documents.find((d) => d.accessKey === payload.accessKey);

    if (!document) {
      return {
        success: false,
        error: 'Documento não encontrado para a chave de acesso informada',
      };
    }

    // Atualiza status do documento
    if (payload.status === 'AUTHORIZED') {
      document.status = 'AUTHORIZED';
      document.protocol = payload.protocol;
      document.authorizedXml = payload.authorizedXml;
      document.qrCodeUrl = payload.qrCodeUrl;
      document.authorizedAt = new Date();
    } else if (payload.status === 'REJECTED') {
      document.status = 'REJECTED';
      document.lastError = payload.xmotivo;
    } else if (payload.status === 'CANCELLED') {
      document.status = 'CANCELLED';
      document.cancelledAt = new Date();
    }

    await this.documentRepo.save(document);

    // Atualiza fila se existir
    const queueItem = await this.queueRepo.findByDocumentId(document.id);
    if (queueItem) {
      await this.queueRepo.updateStatus(
        queueItem.id,
        payload.status === 'AUTHORIZED' ? 'AUTHORIZED' : 'REJECTED',
        payload.xmotivo
      );
    }

    return {
      success: true,
      documentId: document.id,
    };
  }
}
