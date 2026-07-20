import type { FiscalDocument, FiscalDocumentStatus } from '@/modules/fiscal/domain/entities/FiscalDocument';

export interface FiscalDocumentRepository {
  findById(id: string): Promise<FiscalDocument | null>;
  list(): Promise<FiscalDocument[]>;
  listByStatus(statuses: FiscalDocumentStatus[]): Promise<FiscalDocument[]>;
  save(document: FiscalDocument): Promise<void>;
}
