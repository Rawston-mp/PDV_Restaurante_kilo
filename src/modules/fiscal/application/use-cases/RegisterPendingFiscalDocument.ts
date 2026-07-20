import type { FiscalReceipt } from '@/fiscal/types';
import type { FiscalDocument } from '@/modules/fiscal/domain/entities/FiscalDocument';
import type { FiscalDocumentRepository } from '@/modules/fiscal/domain/ports/FiscalDocumentRepository';
import type { FiscalGateway } from '@/modules/fiscal/domain/ports/FiscalGateway';

type RegisterPendingFiscalDocumentInput = {
  saleId: string;
  receipt: FiscalReceipt;
};

const nextRetryDate = (attempts: number) => {
  const minutes = Math.min(30, Math.max(1, attempts));
  return new Date(Date.now() + minutes * 60_000);
};

const parseDateOrNow = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export class RegisterPendingFiscalDocument {
  constructor(
    private readonly repository: FiscalDocumentRepository,
    private readonly gateway: FiscalGateway
  ) {}

  async execute({ saleId, receipt }: RegisterPendingFiscalDocumentInput) {
    const now = new Date();
    const document: FiscalDocument = {
      id: crypto.randomUUID(),
      saleId,
      documentType: 'NFCE',
      model: '65',
      series: receipt.nfce.serie,
      number: receipt.nfce.numero,
      environment: receipt.nfce.ambiente,
      status: 'PENDING',
      accessKey: receipt.nfce.chaveAcesso,
      protocol: receipt.nfce.protocoloAutorizacao,
      qrCodeUrl: receipt.nfce.qrCodeUrl,
      payload: receipt,
      attempts: 0,
      nextRetryAt: now,
      issuedAt: parseDateOrNow(receipt.nfce.dataEmissao),
      createdAt: now,
      updatedAt: now
    };

    await this.repository.save(document);
    return this.tryAuthorize(document);
  }

  private async tryAuthorize(document: FiscalDocument) {
    const result = await this.gateway.authorizeNfce(document.payload);
    const now = new Date();
    const attempts = document.attempts + 1;

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
        updatedAt: now
      };

      await this.repository.save(authorizedDocument);
      return authorizedDocument;
    }

    if (result.status === 'REJECTED') {
      const rejectedDocument: FiscalDocument = {
        ...document,
        status: 'REJECTED',
        attempts,
        cstat: result.cstat,
        xmotivo: result.xmotivo,
        lastError: result.lastError ?? result.xmotivo,
        nextRetryAt: nextRetryDate(attempts),
        updatedAt: now
      };

      await this.repository.save(rejectedDocument);
      return rejectedDocument;
    }

    if (result.status === 'MANUAL_REVIEW') {
      const reviewDocument: FiscalDocument = {
        ...document,
        status: 'MANUAL_REVIEW',
        attempts,
        cstat: result.cstat,
        xmotivo: result.xmotivo,
        lastError: result.lastError ?? result.xmotivo,
        nextRetryAt: nextRetryDate(attempts),
        updatedAt: now
      };

      await this.repository.save(reviewDocument);
      return reviewDocument;
    }

    const offlineDocument: FiscalDocument = {
      ...document,
      status: 'OFFLINE',
      attempts,
      lastError: result.lastError,
      nextRetryAt: nextRetryDate(attempts),
      updatedAt: now
    };

    await this.repository.save(offlineDocument);
    return offlineDocument;
  }
}
