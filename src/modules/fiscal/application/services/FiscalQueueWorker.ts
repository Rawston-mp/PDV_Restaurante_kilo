import { FiscalQueueService } from './FiscalQueueService';

/**
 * FiscalQueueWorker
 *
 * Worker de background que processa a fila de emissão fiscal periodicamente.
 * Deve ser iniciado no backend (ex: no server.ts ou em um processo separado).
 *
 * Uso:
 *   const worker = new FiscalQueueWorker(queueService, 10000); // 10 segundos
 *   worker.start();
 */
export class FiscalQueueWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private queueService: FiscalQueueService,
    private pollIntervalMs: number = 10000 // 10 segundos por padrão
  ) {}

  start(): void {
    if (this.isRunning) {
      console.warn('[FiscalQueueWorker] Já está em execução');
      return;
    }

    console.log(`[FiscalQueueWorker] Iniciado (poll a cada ${this.pollIntervalMs}ms)`);
    this.isRunning = true;

    // Processa imediatamente na primeira vez
    this.processOnce();

    // Depois agenda o intervalo
    this.intervalId = setInterval(() => {
      this.processOnce();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[FiscalQueueWorker] Parado');
  }

  private async processOnce(): Promise<void> {
    try {
      const result = await this.queueService.processNext();
      if (result.processed) {
        console.log(
          `[FiscalQueueWorker] Processado item ${result.item?.id} → ${result.result}`
        );
      }
    } catch (error: any) {
      console.error('[FiscalQueueWorker] Erro ao processar fila:', error.message);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
