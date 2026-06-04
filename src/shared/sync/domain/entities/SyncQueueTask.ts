export type SyncTaskType = 'SYNC_PRODUCTS' | 'SYNC_ORDERS';

export type SyncQueueTask = {
  id: string;
  type: SyncTaskType;
  attempts: number;
  nextRetryAt: Date;
  lastError?: string;
};
