import { useState } from 'react';

import { conveniosContainer } from '@/modules/convenios/infrastructure/container/conveniosContainer';

type Input = {
  convenioCode: string;
  name: string;
  cpfCnpj?: string;
  stateRegistration?: string;
  tradeName?: string;
  personType?: 'FISICA' | 'JURIDICA';
  birthDate?: string;
  rg?: string;
  municipalRegistration?: string;
  gender?: string;
  entryOrigin?: string;
  deliveryServiceFee?: string;
  customerConvenio?: string;
  managerName?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  state?: string;
  city?: string;
  complement?: string;
  stateTaxpayerType?: string;
  activityType?: string;
  freightMode?: string;
  creditLimit?: string;
  debitLimit?: string;
  fiadoLimit?: string;
  creditCardLimit?: string;
  discountPercent?: string;
  commissionPercent?: string;
  visitDay?: string;
  visitRegion?: string;
  printLocation?: string;
  crt?: string;
  cnae?: string;
  priceTable?: string;
  cei?: string;
  constructionRegistration?: string;
  category?: string;
  suframa?: string;
  billingCondition?: string;
  carrierName?: string;
  paymentMethod: 'PIX' | 'DINHEIRO' | 'TRANSFERENCIA' | 'FIADO' | 'CARTAO' | 'OUTRO';
  cashFlow: 'ENTRADA' | 'SAIDA' | 'AMBOS';
  bankName: string;
  accountName: string;
  active: boolean;
  notes: string;
};

export function useCreateConvenio() {
  const [saving, setSaving] = useState(false);

  const createConvenio = async (input: Input) => {
    setSaving(true);
    try {
      return await conveniosContainer.createConvenio.execute({
        id: `conv-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createConvenio, saving };
}
