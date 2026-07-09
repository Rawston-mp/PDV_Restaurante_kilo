import type { FiscalReceipt, ReceiptPayment } from "./types";
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

export function buildFiscalReceiptText(receipt: FiscalReceipt): string {
  const lines: string[] = [];
  const federalTax = receipt.tributosAproximados?.federal ?? 0;
  const stateTax = receipt.tributosAproximados?.estadual ?? 0;
  const cityTax = receipt.tributosAproximados?.municipal ?? 0;

  lines.push(line());
  lines.push(centerText(receipt.emitente.nomeFantasia || "PDV_RESTAURANTE_KILO"));
  lines.push(centerText(receipt.emitente.razaoSocial));
  lines.push(
    centerText(
      `CNPJ: ${formatCpfCnpj(receipt.emitente.cnpj)}${receipt.emitente.inscricaoEstadual ? `  IE: ${receipt.emitente.inscricaoEstadual}` : ""}`
    )
  );
  lines.push(
    centerText(
      `${receipt.emitente.endereco.logradouro}, ${receipt.emitente.endereco.numero}, ${receipt.emitente.endereco.bairro}, ${receipt.emitente.endereco.municipio}, ${receipt.emitente.endereco.uf}`
    )
  );

  lines.push(line());
  lines.push(centerText("DANFE NFC-e"));
  lines.push(centerText("Documento Auxiliar da Nota Fiscal"));
  lines.push(centerText("de Consumidor Eletrônica"));

  if (receipt.nfce.ambiente === "HOMOLOGACAO") {
    lines.push(thinLine());
    lines.push(centerText("AMBIENTE DE HOMOLOGAÇÃO"));
    lines.push(centerText("SEM VALOR FISCAL"));
  }

  lines.push(thinLine());
  lines.push(`NFC-e nº ${receipt.nfce.numero}   Série ${receipt.nfce.serie}`);
  lines.push(`Emissão: ${receipt.nfce.dataEmissao}`);
  lines.push("Protocolo de autorização:");
  lines.push(receipt.nfce.protocoloAutorizacao);
  lines.push(`Data autorização: ${receipt.nfce.dataAutorizacao}`);
  lines.push(thinLine());

  lines.push("CONSUMIDOR");
  lines.push(`CPF/CNPJ: ${formatCpfCnpj(receipt.consumidor?.cpfCnpj)}`);

  if (receipt.consumidor?.nome) {
    lines.push(`Nome: ${receipt.consumidor.nome}`);
  }

  lines.push(thinLine());
  lines.push("CÓDIGO   DESCRIÇÃO             QTD UN  VL UNIT  VL TOTAL");

  for (const item of receipt.itens) {
    const codigo = padRight(limitText(item.codigo, 8), 8);
    const descricao = padRight(limitText(item.descricao, 20), 20);
    const quantidade = padLeft(formatQuantity(item.quantidade), 7);
    const unidade = padRight(item.unidade, 2);
    const unitario = padLeft(formatMoney(item.valorUnitario), 7);
    const total = padLeft(formatMoney(item.valorTotal), 9);

    lines.push(`${codigo} ${descricao} ${quantidade} ${unidade} ${unitario} ${total}`);
  }

  lines.push(thinLine());
  lines.push(`Qtd. total de itens: ${receipt.itens.length}`);
  lines.push(`Valor total dos produtos: ${padLeft(formatMoney(receipt.totalProdutos), 23)}`);
  lines.push(`Desconto: ${padLeft(formatMoney(receipt.descontoTotal), 39)}`);
  lines.push(`Acréscimo: ${padLeft(formatMoney(receipt.acrescimoTotal), 38)}`);
  lines.push(`VALOR TOTAL DA NFC-e: ${padLeft(formatMoney(receipt.totalDocumento), 27)}`);
  lines.push(thinLine());

  lines.push("FORMA DE PAGAMENTO");

  for (const payment of receipt.pagamentos) {
    lines.push(`${padRight(`${paymentLabel(payment)}:`, 24)} ${padLeft(formatMoney(payment.valor), 23)}`);

    if (payment.bandeira) {
      lines.push(`Bandeira: ${payment.bandeira}`);
    }

    if (payment.nsu) {
      lines.push(`NSU: ${payment.nsu}`);
    }

    if (payment.autorizacao) {
      lines.push(`Autorização: ${payment.autorizacao}`);
    }
  }

  if (receipt.troco && receipt.troco > 0) {
    lines.push(`Troco: ${padLeft(formatMoney(receipt.troco), 41)}`);
  }

  lines.push(thinLine());
  lines.push("Tributos aproximados:");
  lines.push(
    `Federal: R$ ${formatMoney(federalTax)}  Estadual: R$ ${formatMoney(stateTax)}  Municipal: R$ ${formatMoney(cityTax)}`
  );
  lines.push("");
  lines.push(`Operador: ${receipt.operador}`);

  if (receipt.comanda) {
    lines.push(`Comanda: ${receipt.comanda}`);
  }

  lines.push(`PDV: ${receipt.pdv}`);
  lines.push(thinLine());
  lines.push("Consulte pela chave de acesso em:");
  lines.push("Portal Nacional da NFC-e");
  lines.push("CHAVE DE ACESSO:");
  lines.push(receipt.nfce.chaveAcesso);
  lines.push("");
  lines.push("[QR CODE NFC-e]");
  lines.push(receipt.nfce.qrCodeUrl);
  lines.push(thinLine());
  lines.push(`Protocolo: ${receipt.nfce.protocoloAutorizacao}`);
  lines.push(`Ambiente: ${receipt.nfce.ambiente === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGACAO"}`);
  lines.push("Emitido por PDV_Restaurante_kilo");
  lines.push(line());

  return lines.join("\n");
}