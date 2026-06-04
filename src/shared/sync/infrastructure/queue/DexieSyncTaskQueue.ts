import type { SyncQueueTask, SyncTaskType } from '@/shared/sync/domain/entities/SyncQueueTask';
import type { SyncTaskQueue } from '@/shared/sync/domain/ports/SyncTaskQueue';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieSyncTaskQueue implements SyncTaskQueue {
  async enqueue(type: SyncTaskType): Promise<SyncQueueTask> {
    const task: SyncQueueTask = {
      id: `sync-${crypto.randomUUID()}`,
      type,
      attempts: 0,
      nextRetryAt: new Date()
    };

    await pdvDatabase.syncQueue.put(task);
    return task;
  }

  async listDue(referenceDate: Date): Promise<SyncQueueTask[]> {
    return pdvDatabase.syncQueue.where('nextRetryAt').belowOrEqual(referenceDate).toArray();
  }

  async markSucceeded(taskId: string): Promise<void> {
    await pdvDatabase.syncQueue.delete(taskId);
  }

  async markFailed(taskId: string, error: string, baseDelayMs: number): Promise<void> {
    const task = await pdvDatabase.syncQueue.get(taskId);
    if (!task) {
      return;
    }

    const attempts = task.attempts + 1;
    const delayMs = baseDelayMs * 2 ** (attempts - 1);

    await pdvDatabase.syncQueue.put({
      ...task,
      attempts,
      lastError: error,
      nextRetryAt: new Date(Date.now() + delayMs)
    });
  }

  async listAll(): Promise<SyncQueueTask[]> {
    return pdvDatabase.syncQueue.toArray();
  }
}
