import type { FiscalReceipt } from '@/fiscal/types';
import type { DigitalCertificateSettings } from '@/shared/domain/services/digitalCertificateRules';

export interface XmlBuildResult {
  xml: string;
  accessKey: string;
  qrCodeUrl: string;
  numero: string;
  serie: string;
}

export interface XmlBuilder {
  /**
   * Monta o XML completo da NFC-e (modelo 65, layout 4.00)
   * @param receipt Dados da venda fiscal
   * @param certificateSettings Configurações do certificado e empresa
   * @param nextNumber Próximo número de NFC-e a ser usado
   */
  buildNfceXml(
    receipt: FiscalReceipt,
    certificateSettings: DigitalCertificateSettings,
    nextNumber: string
  ): Promise<XmlBuildResult>;
}
