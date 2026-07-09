import type { FiscalReceipt, NonFiscalReceipt } from "./types";

export function convertNonFiscalToMockNfce(receipt: NonFiscalReceipt): FiscalReceipt {
  const now = new Date().toLocaleString("pt-BR");

  return {
    tipo: "NFCE",
    emitente: receipt.emitente,
    consumidor: receipt.consumidor,
    comanda: receipt.comanda,
    operador: receipt.operador,
    pdv: receipt.pdv,
    itens: receipt.itens,
    pagamentos: receipt.pagamentos || [],
    totalProdutos: receipt.totalProdutos,
    descontoTotal: receipt.descontoTotal,
    acrescimoTotal: receipt.acrescimoTotal,
    totalDocumento: receipt.totalDocumento,
    troco: receipt.troco,
    nfce: {
      modelo: "65",
      serie: "900",
      numero: "000000001",
      chaveAcesso: "35260700000000000000659000000000011000000001",
      protocoloAutorizacao: "13526000000000000",
      dataEmissao: now,
      dataAutorizacao: now,
      ambiente: "HOMOLOGACAO",
      qrCodeUrl: "https://www.nfce.fazenda.sp.gov.br/qrcode?p=MOCK",
      cscId: "000001"
    }
  };
}