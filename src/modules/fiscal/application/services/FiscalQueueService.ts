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

      // Tenta autorizar via gateway
      // NOTA: O receipt completo deveria vir do FiscalDocument ou ser reconstruído
      // Por enquanto usamos um placeholder
      const result = await this.gateway.authorizeNfce({
        tipo: 'NFCE',
        emitente: { razaoSocial: '', cnpj: '', endereco: { logradouro: '', numero: '', bairro: '', municipio: '', uf: 'SP', cep: '' } },
        nfce: {
          modelo: '65',
          serie: document.series,
          numero: document.number,
          chaveAcesso: document.accessKey,
          protocoloAutorizacao: '',
          dataEmissao: document.issuedAt.toISOString(),
          dataAutorizacao: '',
          ambiente: document.environment,
          qrCodeUrl: document.qrCodeUrl || '',
        },
        operador: 'queue-worker',
        pdv: 'PDV-01',
        itens: [],
        pagamentos: [],
        totalProdutos: 0,
        descontoTotal: 0,
        acrescimoTotal: 0,
        totalDocumento: 0,
      } as any);

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

      // OFFLINE ou erro temporário → agenda retry
      if (item.attempts + 1 >= item.maxAttempts) {
        await this.queueRepo.updateStatus(item.id, 'FAILED', 'Máximo de tentativas atingido');
        document.status = 'MANUAL_REVIEW';
        document.lastError = 'Máximo de tentativas atingido';
        await this.documentRepo.save(document);
        return { processed: true, item, result: 'FAILED - Máximo de tentativas' };
      }

      // Backoff progressivo: 5min, 30min, 1h, 4h, 16h
      const backoffMinutes = [5, 30, 60, 240, 960][Math.min(item.attempts, 4)];
      const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await this.queueRepo.scheduleRetry(item.id, nextRetry);
      await this.queueRepo.incrementAttempts(item.id);

      return { processed: true, item, result: `RETRY agendado em ${backoffMinutes}min` };
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido';

      if (item.attempts + 1 >= item.maxAttempts) {
        await this.queueRepo.updateStatus(item.id, 'FAILED', errorMsg);
        document.status = 'MANUAL_REVIEW';
        document.lastError = errorMsg;
        await this.documentRepo.save(document);
        return { processed: true, item, result: 'FAILED - ' + errorMsg };
      }

      const backoffMinutes = [5, 30, 60, 240, 960][Math.min(item.attempts, 4)];
      const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await this.queueRepo.scheduleRetry(item.id, nextRetry);
      await this.queueRepo.incrementAttempts(item.id);

      return { processed: true, item, result: `RETRY em ${backoffMinutes}min - ${errorMsg}` };
    }
  }
}
