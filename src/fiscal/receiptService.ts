import type { AnyReceipt, FiscalReceipt, NonFiscalReceipt } from "./types";
import { buildFiscalReceiptText } from "./receiptFiscal";
import { buildNonFiscalReceiptText } from "./receiptNonFiscal";

const allowedNonFiscalPhrases = ["Não substitui a NFC-e"];

export function buildReceiptText(receipt: AnyReceipt): string {
  if (receipt.tipo === "NFCE") {
    return buildFiscalReceiptText(receipt as FiscalReceipt);
  }

  const text = buildNonFiscalReceiptText(receipt as NonFiscalReceipt);
  validateNonFiscalReceiptText(text);
  return text;
}

export function validateNonFiscalReceiptText(text: string): void {
  const forbiddenTerms = [
    "DANFE",
    "Cupom fiscal",
    "Chave de acesso",
    "Protocolo de autorização",
    "Autorizado pela SEFAZ",
    "Série fiscal",
    "QR Code fiscal"
  ];

  const normalizedText = allowedNonFiscalPhrases.reduce(
    (current, phrase) => current.replace(new RegExp(phrase, "gi"), ""),
    text
  );

  for (const term of forbiddenTerms) {
    if (normalizedText.toLowerCase().includes(term.toLowerCase())) {
      throw new Error(`Comprovante não fiscal contém termo proibido: ${term}`);
    }
  }
}