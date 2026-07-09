import { describe, expect, it } from "vitest";

import { buildReceiptText, validateNonFiscalReceiptText } from "@/fiscal/receiptService";
import { convertNonFiscalToMockNfce } from "@/fiscal/mockNfce";
import type { NonFiscalReceipt } from "@/fiscal/types";
import { textToEscposMock } from "@/lib/escpos";

const baseReceipt: NonFiscalReceipt = {
  tipo: "NON_FISCAL",
  emitente: {
    razaoSocial: "RAZÃO SOCIAL DO RESTAURANTE LTDA",
    nomeFantasia: "PDV_RESTAURANTE_KILO",
    cnpj: "00000000000000",
    inscricaoEstadual: "000.000.000.000",
    endereco: {
      logradouro: "Rua Exemplo",
      numero: "123",
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01001000"
    }
  },
  controleInterno: "00004567",
  dataEmissao: "09/07/2026 12:31:44",
  comanda: "025",
  operador: "BALANÇA 01",
  pdv: "TERMINAL BALANÇA A",
  itens: [
    {
      codigo: "001",
      descricao: "REFEIÇÃO POR KG",
      unidade: "KG",
      quantidade: 0.742,
      valorUnitario: 79.9,
      valorTotal: 59.29,
      ncm: "21069029",
      cfop: "5102",
      cstCsosn: "500"
    },
    {
      codigo: "002",
      descricao: "REFRIGERANTE",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 7,
      valorTotal: 7
    }
  ],
  totalProdutos: 66.29,
  descontoTotal: 0,
  acrescimoTotal: 0,
  totalDocumento: 66.29
};

describe("recibos fiscal e não fiscal", () => {
  it("gera comprovante não fiscal sem termos exclusivos de documento fiscal", () => {
    const text = buildReceiptText(baseReceipt);

    expect(text).toContain("COMPROVANTE NÃO FISCAL");
    expect(text).toContain("ORÇAMENTO / PRÉ-CONTA");
    expect(text).toContain("NÃO É DOCUMENTO FISCAL");
    expect(text).toContain("Não substitui a NFC-e");
    expect(text).toContain("Solicite seu documento fiscal no caixa");
    expect(text).not.toContain("DANFE");
    expect(text).not.toContain("Chave de acesso");
    expect(text).not.toContain("Protocolo de autorização");
    expect(text).not.toContain("Autorizado pela SEFAZ");
  });

  it("bloqueia comprovante não fiscal com termo fiscal exclusivo", () => {
    expect(() => validateNonFiscalReceiptText("Pré-conta com DANFE indevido")).toThrow(
      /termo proibido: DANFE/
    );
  });

  it("gera DANFE NFC-e mock em homologação a partir do não fiscal", () => {
    const nfce = convertNonFiscalToMockNfce({
      ...baseReceipt,
      pagamentos: [{ tipo: "PIX", valor: 66.29 }]
    });
    const text = buildReceiptText(nfce);

    expect(text).toContain("DANFE NFC-e");
    expect(text).toContain("AMBIENTE DE HOMOLOGAÇÃO");
    expect(text).toContain("SEM VALOR FISCAL");
    expect(text).toContain("35260700000000000000659000000000011000000001");
    expect(text).toContain("[QR CODE NFC-e]");
  });

  it("converte texto para ESC/POS mock com inicialização e corte", () => {
    const bytes = textToEscposMock("teste");
    const decoded = new TextDecoder().decode(bytes);

    expect(decoded.startsWith("\x1B@teste")).toBe(true);
    expect(decoded.endsWith("\x1DVB\x00")).toBe(true);
  });
});