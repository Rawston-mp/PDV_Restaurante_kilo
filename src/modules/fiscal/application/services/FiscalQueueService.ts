import type { FiscalQueueRepository } from '../../domain/ports/FiscalQueueRepository';
import type { FiscalGateway } from '../../domain/ports/FiscalGateway';
import type { FiscalDocumentRepository } from '../../domain/ports/FiscalDocumentRepository';
import type { FiscalQueueItem } from '../../domain/entities/FiscalQueueItem';

/**
 * FiscalQueueService
 *
 * Serviço de fila persistente para emissão assíncrona de NFC-e.
 * Responsável por:
 * - Enfileirar documentos pendentes
 * - Processar a fila periodicamente
 * - Retry automático com backoff
 * - Atualizar status no FiscalDocument
 */
export class FiscalQueueService {
  constructor(
    private queueRepo: FiscalQueueRepository,
    private documentRepo: FiscalDocumentRepository,
    private gateway: FiscalGateway
  ) {}

  /**
   * Adiciona um documento à fila de emissão
   */
  async enqueue(documentId: string, saleId: string): Promise<void> {
    await this.queueRepo.enqueue({
      documentId,
      saleId,
      maxAttempts: 5,
    });
  }

  /**
   * Processa um item da fila (chamado por worker)
   */
  async processNext(): Promise<{
    processed: boolean;
    item?: FiscalQueueItem;
    result?: string;
  }> {
    const item = await this.queueRepo.dequeue();
    if (!item) {
      return { processed: false };
    }

    const document = await this.documentRepo.findById(item.documentId);
    if (!document) {
      await this.queueRepo.updateStatus(item.id, 'FAILED', 'Documento não encontrado');
      return { processed: true, item, result: 'FAILED - Documento não encontrado' };
    }

    try {
      await this.queueRepo.updateStatus(item.id, 'PROCESSING');

      // Usa o payload completo armazenado no documento (FiscalReceipt)
      const receipt = document.payload;
      const result = await this.gateway.authorizeNfce(receipt);

      if (result.status === 'AUTHORIZED') {
        document.status = 'AUTHORIZED';
        document.protocol = result.protocol;
        document.authorizedAt = new Date();
        document.authorizedXml = result.authorizedXml;
        await this.documentRepo.save(document);

        await this.queueRepo.updateStatus(item.id, 'AUTHORIZED');
        return { processed: true, item, result: 'AUTHORIZED' };
      }

      if (result.status === 'REJECTED' || result.status === 'MANUAL_REVIEW') {
        document.status = result.status === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : 'REJECTED';
        document.lastError = result.xmotivo;
        await this.documentRepo.save(document);

        await this.queueRepo.updateStatus(item.id, document.status, result.xmotivo);
        return { processed: true, item, result: document.status };
      }

      // OFFLINE ou erro temporário → agenda retry com backoff
      if (item.attempts + 1 >= item.maxAttempts) {
        await this.queueRepo.updateStatus(item.id, 'FAILED', 'Máximo de tentativas atingido');
        document.status = 'MANUAL_REVIEW';
        document.lastError = 'Máximo de tentativas atingido';
        await this.documentRepo.save(document);
        return { processed: true, item, result: 'FAILED - Máximo de tentativas' };
      }

      await this.scheduleBackoffRetry(item);

      return { processed: true, item, result: `RETRY agendado` };
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido';

      if (item.attempts + 1 >= item.maxAttempts) {
        await this.queueRepo.updateStatus(item.id, 'FAILED', errorMsg);
        document.status = 'MANUAL_REVIEW';
        document.lastError = errorMsg;
        await this.documentRepo.save(document);
        return { processed: true, item, result: 'FAILED - ' + errorMsg };
      }

      await this.scheduleBackoffRetry(item);

      return { processed: true, item, result: `RETRY agendado - ${errorMsg}` };
    }
  }

  private async scheduleBackoffRetry(item: FiscalQueueItem): Promise<void> {
    const backoffMinutes = [5, 30, 60, 240, 960][Math.min(item.attempts, 4)];
    const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);
    await this.queueRepo.scheduleRetry(item.id, nextRetry);
    await this.queueRepo.incrementAttempts(item.id);
  }
}
