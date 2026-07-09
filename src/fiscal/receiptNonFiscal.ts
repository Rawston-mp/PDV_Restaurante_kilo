import type { NonFiscalReceipt, ReceiptPayment } from "./types";
import {
  centerText,
  formatCpfCnpj,
  formatMoney,
  formatQuantity,
  line,
  limitText,
  padLeft,
  padRight,
  thinLine
} from "./formatters";

function paymentLabel(payment: ReceiptPayment): string {
  const labels: Record<ReceiptPayment["tipo"], string> = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_CREDITO: "Cartão de crédito",
    CARTAO_DEBITO: "Cartão de débito",
    VALE: "Vale",
    OUTROS: "Outros"
  };

  return labels[payment.tipo];
}

export function buildNonFiscalReceiptText(receipt: NonFiscalReceipt): string {
  const lines: string[] = [];

  lines.push(line());
  lines.push(centerText(receipt.emitente.nomeFantasia || "PDV_RESTAURANTE_KILO"));
  lines.push(centerText(receipt.emitente.razaoSocial));
  lines.push(centerText(`CNPJ: ${formatCpfCnpj(receipt.emitente.cnpj)}`));
  lines.push(centerText(`${receipt.emitente.endereco.logradouro}, ${receipt.emitente.endereco.numero}`));
  lines.push(
    centerText(
      `${receipt.emitente.endereco.bairro}, ${receipt.emitente.endereco.municipio}, ${receipt.emitente.endereco.uf}`
    )
  );

  lines.push(line());
  lines.push(centerText("COMPROVANTE NÃO FISCAL"));
  lines.push(centerText("ORÇAMENTO / PRÉ-CONTA"));
  lines.push(centerText("NÃO É DOCUMENTO FISCAL"));
  lines.push(thinLine());

  lines.push(`Controle interno nº: ${receipt.controleInterno}`);
  lines.push(`Data: ${receipt.dataEmissao}`);

  if (receipt.comanda) {
    lines.push(`Comanda: ${receipt.comanda}`);
  }

  lines.push(`Operador: ${receipt.operador}`);
  lines.push(`PDV: ${receipt.pdv}`);
  lines.push(thinLine());

  if (receipt.consumidor?.cpfCnpj || receipt.consumidor?.nome) {
    lines.push("CONSUMIDOR");
    lines.push(`CPF/CNPJ: ${formatCpfCnpj(receipt.consumidor?.cpfCnpj)}`);

    if (receipt.consumidor?.nome) {
      lines.push(`Nome: ${receipt.consumidor.nome}`);
    }

    lines.push(thinLine());
  }

  lines.push("CÓDIGO DESCRIÇÃO        QTD UN  VL UNIT VL TOTAL");

  for (const item of receipt.itens) {
    const codigo = padRight(limitText(item.codigo, 6), 6);
    const descricao = padRight(limitText(item.descricao, 16), 16);
    const quantidade = padLeft(formatQuantity(item.quantidade), 7);
    const unidade = padRight(item.unidade, 2);
    const unitario = padLeft(formatMoney(item.valorUnitario), 8);
    const total = padLeft(formatMoney(item.valorTotal), 8);

    lines.push(`${codigo} ${descricao} ${quantidade} ${unidade} ${unitario} ${total}`);
  }

  lines.push(thinLine());
  lines.push(`Qtd. total de itens: ${receipt.itens.length}`);
  lines.push(`Subtotal: ${padLeft(formatMoney(receipt.totalProdutos), 39)}`);
  lines.push(`Desconto: ${padLeft(formatMoney(receipt.descontoTotal), 37)}`);
  lines.push(`Acréscimo: ${padLeft(formatMoney(receipt.acrescimoTotal), 36)}`);
  lines.push(`TOTAL A PAGAR: ${padLeft(formatMoney(receipt.totalDocumento), 33)}`);
  lines.push(thinLine());

  if (receipt.pagamentos && receipt.pagamentos.length > 0) {
    lines.push("FORMA DE PAGAMENTO");

    for (const payment of receipt.pagamentos) {
      lines.push(`${padRight(paymentLabel(payment), 24)} ${padLeft(formatMoney(payment.valor), 23)}`);
    }

    if (receipt.troco && receipt.troco > 0) {
      lines.push(`Troco: ${padLeft(formatMoney(receipt.troco), 41)}`);
    }
  } else {
    lines.push("Forma prevista:");
    lines.push("A DEFINIR NO CAIXA");
  }

  lines.push(thinLine());
  lines.push(centerText("Este comprovante é apenas controle interno."));
  lines.push(centerText("Não substitui a NFC-e."));
  lines.push(centerText("Solicite seu documento fiscal no caixa."));

  if (receipt.observacao) {
    lines.push(thinLine());
    lines.push(`Obs: ${receipt.observacao}`);
  }

  lines.push(line());

  return lines.join("\n");
}