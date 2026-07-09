export type DocumentType = "NFCE" | "NON_FISCAL";

export type PaymentType =
  | "DINHEIRO"
  | "PIX"
  | "CARTAO_CREDITO"
  | "CARTAO_DEBITO"
  | "VALE"
  | "OUTROS";

export type FiscalEnvironment = "PRODUCAO" | "HOMOLOGACAO";

export type ReceiptUnit = "UN" | "KG";

export type ReceiptEmitter = {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipio: string;
    uf: "SP";
    cep: string;
  };
};

export type ReceiptCustomer = {
  nome?: string;
  cpfCnpj?: string;
};

export type ReceiptItem = {
  codigo: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade: ReceiptUnit;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  desconto?: number;
  cstCsosn?: string;
};

export type ReceiptPayment = {
  tipo: PaymentType;
  valor: number;
  autorizacao?: string;
  bandeira?: string;
  nsu?: string;
};

export type NfceInfo = {
  modelo: "65";
  serie: string;
  numero: string;
  chaveAcesso: string;
  protocoloAutorizacao: string;
  dataEmissao: string;
  dataAutorizacao: string;
  ambiente: FiscalEnvironment;
  qrCodeUrl: string;
  cscId?: string;
};

export type FiscalReceipt = {
  tipo: "NFCE";
  emitente: ReceiptEmitter;
  nfce: NfceInfo;
  consumidor?: ReceiptCustomer;
  comanda?: string;
  operador: string;
  pdv: string;
  itens: ReceiptItem[];
  pagamentos: ReceiptPayment[];
  totalProdutos: number;
  descontoTotal: number;
  acrescimoTotal: number;
  totalDocumento: number;
  troco?: number;
  tributosAproximados?: {
    federal: number;
    estadual: number;
    municipal: number;
  };
};

export type NonFiscalReceipt = {
  tipo: "NON_FISCAL";
  emitente: ReceiptEmitter;
  controleInterno: string;
  dataEmissao: string;
  consumidor?: ReceiptCustomer;
  comanda?: string;
  operador: string;
  pdv: string;
  itens: ReceiptItem[];
  pagamentos?: ReceiptPayment[];
  totalProdutos: number;
  descontoTotal: number;
  acrescimoTotal: number;
  totalDocumento: number;
  troco?: number;
  observacao?: string;
};

export type AnyReceipt = FiscalReceipt | NonFiscalReceipt;