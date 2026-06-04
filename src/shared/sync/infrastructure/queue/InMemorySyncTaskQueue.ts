import type { SyncQueueTask, SyncTaskType } from '@/shared/sync/domain/entities/SyncQueueTask';
import type { SyncTaskQueue } from '@/shared/sync/domain/ports/SyncTaskQueue';

export class InMemorySyncTaskQueue implements SyncTaskQueue {
  private readonly tasks = new Map<string, SyncQueueTask>();

  async enqueue(type: SyncTaskType): Promise<SyncQueueTask> {
    const task: SyncQueueTask = {
      id: `sync-${crypto.randomUUID()}`,
      type,
      attempts: 0,
      nextRetryAt: new Date()
    };

    this.tasks.set(task.id, task);
    return task;
  }

  async listDue(referenceDate: Date): Promise<SyncQueueTask[]> {
    return Array.from(this.tasks.values()).filter((task) => task.nextRetryAt <= referenceDate);
  }

  async markSucceeded(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async markFailed(taskId: string, error: string, baseDelayMs: number): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    const attempts = task.attempts + 1;
    const delayMs = baseDelayMs * 2 ** (attempts - 1);

    this.tasks.set(taskId, {
      ...task,
      attempts,
      lastError: error,
      nextRetryAt: new Date(Date.now() + delayMs)
    });
  }

  async listAll(): Promise<SyncQueueTask[]> {
    return Array.from(this.tasks.values());
  }
}
