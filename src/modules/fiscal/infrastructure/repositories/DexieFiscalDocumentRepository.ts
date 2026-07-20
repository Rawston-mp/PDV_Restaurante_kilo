import type { FiscalDocument, FiscalDocumentStatus } from '@/modules/fiscal/domain/entities/FiscalDocument';
import type { FiscalDocumentRepository } from '@/modules/fiscal/domain/ports/FiscalDocumentRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieFiscalDocumentRepository implements FiscalDocumentRepository {
  async findById(id: string) {
    return (await pdvDatabase.fiscalDocuments.get(id)) ?? null;
  }

  async list() {
    return pdvDatabase.fiscalDocuments.toArray();
  }

  async listByStatus(statuses: FiscalDocumentStatus[]) {
    const documents = await pdvDatabase.fiscalDocuments.toArray();
    return documents.filter((document) => statuses.includes(document.status));
  }

  async save(document: FiscalDocument) {
    await pdvDatabase.fiscalDocuments.put(document);
  }
}
