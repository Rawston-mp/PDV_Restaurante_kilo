import { DexieSyncTaskQueue } from '@/shared/sync/infrastructure/queue/DexieSyncTaskQueue';
import { InMemorySyncTaskQueue } from '@/shared/sync/infrastructure/queue/InMemorySyncTaskQueue';
import { hasIndexedDb } from '@/shared/infrastructure/runtime/hasIndexedDb';

const syncTaskQueue = hasIndexedDb() ? new DexieSyncTaskQueue() : new InMemorySyncTaskQueue();

export function getSyncTaskQueue() {
  return syncTaskQueue;
}
