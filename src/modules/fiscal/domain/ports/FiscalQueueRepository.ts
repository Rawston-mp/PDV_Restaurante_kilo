import type { FiscalQueueItem, FiscalQueueItemInput, FiscalQueueStatus } from '../entities/FiscalQueueItem';

export interface FiscalQueueRepository {
  enqueue(item: FiscalQueueItemInput): Promise<FiscalQueueItem>;
  dequeue(): Promise<FiscalQueueItem | null>;
  findById(id: string): Promise<FiscalQueueItem | null>;
  findByDocumentId(documentId: string): Promise<FiscalQueueItem | null>;
  listByStatus(statuses: FiscalQueueStatus[]): Promise<FiscalQueueItem[]>;
  updateStatus(id: string, status: FiscalQueueStatus, error?: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  scheduleRetry(id: string, nextRetryAt: Date): Promise<void>;
}
