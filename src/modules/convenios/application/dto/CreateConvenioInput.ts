import type { ConvenioCashFlow, ConvenioPaymentMethod } from '@/modules/convenios/domain/entities/Convenio';

export type CreateConvenioInput = {
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
};
