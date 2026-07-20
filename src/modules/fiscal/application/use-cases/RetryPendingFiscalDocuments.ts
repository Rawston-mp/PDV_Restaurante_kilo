import type { FiscalDocument } from '@/modules/fiscal/domain/entities/FiscalDocument';
import type { FiscalDocumentRepository } from '@/modules/fiscal/domain/ports/FiscalDocumentRepository';
import type { FiscalGateway } from '@/modules/fiscal/domain/ports/FiscalGateway';

const nextRetryDate = (attempts: number) => {
  const minutes = Math.min(30, Math.max(1, attempts));
  return new Date(Date.now() + minutes * 60_000);
};

export class RetryPendingFiscalDocuments {
  constructor(
    private readonly repository: FiscalDocumentRepository,
    private readonly gateway: FiscalGateway
  ) {}

  async execute() {
    const now = new Date();
    const documents = await this.repository.listByStatus(['PENDING', 'OFFLINE']);
    const dueDocuments = documents.filter((document) => document.nextRetryAt <= now);
    const processed: FiscalDocument[] = [];

    for (const document of dueDocuments) {
      const result = await this.gateway.authorizeNfce(document.payload);
      const attempts = document.attempts + 1;
      const updatedAt = new Date();

      if (result.status === 'AUTHORIZED') {
        const authorizedDocument: FiscalDocument = {
          ...document,
          status: 'AUTHORIZED',
          accessKey: result.accessKey,
          protocol: result.protocol,
          qrCodeUrl: result.qrCodeUrl,
          authorizedXml: result.authorizedXml,
          attempts,
          cstat: result.cstat,
          xmotivo: result.xmotivo,
          lastError: undefined,
          authorizedAt: result.authorizedAt,
          nextRetryAt: result.authorizedAt,
          updatedAt
        };
        await this.repository.save(authorizedDocument);
        processed.push(authorizedDocument);
        continue;
      }

      const retryDocument: FiscalDocument = {
        ...document,
        status: result.status,
        attempts,
        cstat: result.status === 'REJECTED' || result.status === 'MANUAL_REVIEW' ? result.cstat : document.cstat,
        xmotivo: result.status === 'REJECTED' || result.status === 'MANUAL_REVIEW' ? result.xmotivo : document.xmotivo,
        lastError:
          result.status === 'REJECTED' || result.status === 'MANUAL_REVIEW'
            ? result.lastError ?? result.xmotivo
            : result.lastError,
        nextRetryAt: nextRetryDate(attempts),
        updatedAt
      };

      await this.repository.save(retryDocument);
      processed.push(retryDocument);
    }

    return processed;
  }
}
