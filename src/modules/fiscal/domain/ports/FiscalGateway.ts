import type { FiscalReceipt } from '@/fiscal/types';

export type FiscalAuthorizationResult =
  | {
      status: 'AUTHORIZED';
      accessKey: string;
      protocol: string;
      qrCodeUrl: string;
      authorizedXml?: string;
      cstat: string;
      xmotivo: string;
      authorizedAt: Date;
    }
  | {
      status: 'REJECTED';
      cstat: string;
      xmotivo: string;
      lastError?: string;
    }
  | {
      status: 'MANUAL_REVIEW';
      cstat?: string;
      xmotivo: string;
      lastError?: string;
    }
  | {
      status: 'OFFLINE';
      lastError: string;
    };

export interface FiscalGateway {
  authorizeNfce(receipt: FiscalReceipt): Promise<FiscalAuthorizationResult>;
}
