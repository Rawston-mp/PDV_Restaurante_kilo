export type FiscalQueueStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'MANUAL_REVIEW'
  | 'FAILED';

export type FiscalQueueItem = {
  id: string;
  documentId: string;
  saleId: string;
  status: FiscalQueueStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date | null;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FiscalQueueItemInput = {
  documentId: string;
  saleId: string;
  maxAttempts?: number;
};
