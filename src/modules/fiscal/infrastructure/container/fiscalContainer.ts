import { RegisterPendingFiscalDocument } from '@/modules/fiscal/application/use-cases/RegisterPendingFiscalDocument';
import { RetryPendingFiscalDocuments } from '@/modules/fiscal/application/use-cases/RetryPendingFiscalDocuments';
import { MockFiscalGateway } from '@/modules/fiscal/infrastructure/gateways/MockFiscalGateway';
import { DexieFiscalDocumentRepository } from '@/modules/fiscal/infrastructure/repositories/DexieFiscalDocumentRepository';

const fiscalDocumentRepository = new DexieFiscalDocumentRepository();
const fiscalGateway = new MockFiscalGateway();

export const fiscalContainer = {
  fiscalDocumentRepository,
  fiscalGateway,
  registerPendingFiscalDocument: new RegisterPendingFiscalDocument(fiscalDocumentRepository, fiscalGateway),
  retryPendingFiscalDocuments: new RetryPendingFiscalDocuments(fiscalDocumentRepository, fiscalGateway)
};
