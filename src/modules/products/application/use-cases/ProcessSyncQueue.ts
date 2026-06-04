import type { SyncTaskQueue } from '@/shared/sync/domain/ports/SyncTaskQueue';
import type { SyncTaskHandler } from '@/shared/sync/application/ports/SyncTaskHandler';

export type ProcessSyncQueueResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

export class ProcessSyncQueue {
  constructor(
    private readonly syncTaskQueue: SyncTaskQueue,
    private readonly handlers: SyncTaskHandler[],
    private readonly baseDelayMs = 200
  ) {}

  async execute(referenceDate = new Date()): Promise<ProcessSyncQueueResult> {
    const dueTasks = await this.syncTaskQueue.listDue(referenceDate);

    let succeeded = 0;
    let failed = 0;

    for (const task of dueTasks) {
      try {
        const handler = this.handlers.find((item) => item.type === task.type);

        if (!handler) {
          throw new Error(`Sem handler registrado para ${task.type}`);
        }

        await handler.execute();

        await this.syncTaskQueue.markSucceeded(task.id);
        succeeded += 1;
      } catch (error) {
        await this.syncTaskQueue.markFailed(
          task.id,
          error instanceof Error ? error.message : 'Falha ao processar tarefa de sincronizacao',
          this.baseDelayMs
        );
        failed += 1;
      }
    }

    return {
      processed: dueTasks.length,
      succeeded,
      failed
    };
  }
}
