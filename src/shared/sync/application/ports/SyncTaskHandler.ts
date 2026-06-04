import type { SyncTaskType } from '@/shared/sync/domain/entities/SyncQueueTask';

export interface SyncTaskHandler {
  readonly type: SyncTaskType;
  execute(): Promise<unknown>;
}
