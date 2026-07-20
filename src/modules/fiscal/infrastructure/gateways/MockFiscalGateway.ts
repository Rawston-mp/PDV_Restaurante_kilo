import type { FiscalReceipt } from '@/fiscal/types';
import type { FiscalAuthorizationResult, FiscalGateway } from '@/modules/fiscal/domain/ports/FiscalGateway';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export class MockFiscalGateway implements FiscalGateway {
  async authorizeNfce(receipt: FiscalReceipt): Promise<FiscalAuthorizationResult> {
    if (isOffline()) {
      return {
        status: 'OFFLINE',
        lastError: 'Sem internet. NFC-e registrada para envio automático quando a conexão voltar.'
      };
    }

    if (receipt.nfce.ambiente === 'PRODUCAO') {
      return {
        status: 'MANUAL_REVIEW',
        cstat: 'DEV_GATEWAY',
        xmotivo: 'Ambiente Produção selecionado, mas o emissor SEFAZ/API real ainda não está configurado.',
        lastError: 'Configure um gateway fiscal real antes de autorizar NFC-e em produção.'
      };
    }

    const authorizedAt = new Date();
    const accessKey = receipt.nfce.chaveAcesso || `MOCK-${receipt.nfce.serie}-${receipt.nfce.numero}`;
    const protocol = receipt.nfce.protocoloAutorizacao || `MOCK-${authorizedAt.getTime()}`;

    return {
      status: 'AUTHORIZED',
      accessKey,
      protocol,
      qrCodeUrl: receipt.nfce.qrCodeUrl || `https://www.nfce.fazenda.sp.gov.br/qrcode?p=MOCK-${accessKey}`,
      authorizedXml: `<mockNfce accessKey="${accessKey}" protocol="${protocol}" authorizedAt="${authorizedAt.toISOString()}" />`,
      cstat: '100',
      xmotivo: 'Autorizado o uso da NFC-e (simulação de desenvolvimento)',
      authorizedAt
    };
  }
}
