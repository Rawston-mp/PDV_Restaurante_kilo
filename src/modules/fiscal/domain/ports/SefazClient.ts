import type { FiscalAuthorizationResult } from './FiscalGateway';

export interface SefazClientConfig {
  uf: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  timeoutMs?: number;
}

export interface SefazClient {
  /**
   * Transmite lote de NFC-e para o webservice NFeAutorizacao4
   */
  transmitirLote(xmlAssinado: string, loteId: string): Promise<FiscalAuthorizationResult>;

  /**
   * Consulta resultado do lote via NFeRetAutorizacao4
   */
  consultarRetornoLote(recibo: string): Promise<FiscalAuthorizationResult>;

  /**
   * Consulta status do protocolo (NFeConsultaProtocolo4)
   */
  consultarStatusChave(chaveAcesso: string): Promise<FiscalAuthorizationResult>;

  /**
   * Envia evento de cancelamento
   */
  cancelarNfce(chaveAcesso: string, justificativa: string, protocoloAutorizacao: string): Promise<{
    status: 'CANCELLED' | 'REJECTED';
    protocoloCancelamento?: string;
    cstat: string;
    xmotivo: string;
  }>;
}
