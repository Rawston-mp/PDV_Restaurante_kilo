import type { SyncQueueTask, SyncTaskType } from '@/shared/sync/domain/entities/SyncQueueTask';

export interface SyncTaskQueue {
  enqueue(type: SyncTaskType): Promise<SyncQueueTask>;
  listDue(referenceDate: Date): Promise<SyncQueueTask[]>;
  markSucceeded(taskId: string): Promise<void>;
  markFailed(taskId: string, error: string, baseDelayMs: number): Promise<void>;
  listAll(): Promise<SyncQueueTask[]>;
}
