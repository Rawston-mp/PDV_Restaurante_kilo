export type ConvenioPaymentMethod = 'PIX' | 'DINHEIRO' | 'TRANSFERENCIA' | 'FIADO' | 'CARTAO' | 'OUTRO';
export type ConvenioCashFlow = 'ENTRADA' | 'SAIDA' | 'AMBOS';

export type Convenio = {
  id: string;
  convenioCode: string;
  name: string;
  cpfCnpj?: string;
  paymentMethod: ConvenioPaymentMethod;
  cashFlow: ConvenioCashFlow;
  bankName: string;
  accountName: string;
  active: boolean;
  notes: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
