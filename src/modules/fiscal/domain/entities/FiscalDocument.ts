import type { FiscalReceipt } from '@/fiscal/types';

export type FiscalDocumentStatus =
  | 'PENDING'
  | 'OFFLINE'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'MANUAL_REVIEW';

export type FiscalDocument = {
  id: string;
  saleId: string;
  documentType: 'NFCE';
  model: '65';
  series: string;
  number: string;
  environment: 'HOMOLOGACAO' | 'PRODUCAO';
  status: FiscalDocumentStatus;
  accessKey: string;
  protocol?: string;
  qrCodeUrl?: string;
  signedXml?: string;
  authorizedXml?: string;
  payload: FiscalReceipt;
  attempts: number;
  nextRetryAt: Date;
  cstat?: string;
  xmotivo?: string;
  lastError?: string;
  issuedAt: Date;
  authorizedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
